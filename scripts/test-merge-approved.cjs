const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),ts=require("typescript");
const root=path.resolve(__dirname,"..");
function load(file,mocks={}){const output=ts.transpileModule(fs.readFileSync(path.join(root,file),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const mod={exports:{}};const local=name=>{if(name in mocks)return mocks[name];if(name==="server-only")return {};if(name.startsWith("@/"))return load("src/"+name.slice(2)+".ts",mocks);if(name.startsWith("./"))return load(path.join(path.dirname(file),name+".ts"),mocks);return require(name);};new Function("exports","module","require",output)(mod.exports,mod,local);return mod.exports;}

function database(source,searchError=null){
 const calls=[];return {calls,from(table){const filters=[];calls.push({table,filters});const q={};for(const method of ["select","eq","not","or","order","limit"])q[method]=(...args)=>{filters.push([method,...args]);return q;};q.maybeSingle=async()=>({data:source,error:null});q.then=(resolve,reject)=>Promise.resolve({data:[],error:searchError}).then(resolve,reject);return q;},rpc:async(name,args)=>{calls.push({rpc:name,args});return {data:searchError?null:"invoice",error:searchError};}};
}
(async()=>{
 for(const kind of ["invoice_tax","receipt"]){
 const db=database({doc_type:kind,direction:"expense"});
 const actions=load("src/lib/transactions/merge-approved.ts",{"next/cache":{revalidatePath(){}},"./load-range":{userContext:async()=>({supabase:db,userId:"owner"})}});
 assert.deepEqual(await actions.searchApprovedComplement("source",""),{transactions:[]});
 assert.equal(db.calls.length,2);
 for(const call of db.calls)assert.ok(call.filters.some(f=>f[0]==="eq"&&f[1]==="user_id"&&f[2]==="owner"));
 const filters=db.calls[1].filters;
 assert.ok(filters.some(f=>f[0]==="eq"&&f[1]==="doc_type"&&f[2]===(kind==="receipt"?"invoice_tax":"receipt")));
 assert.ok(filters.some(f=>f[0]==="eq"&&f[1]==="is_verified"&&f[2]===true));
 assert.ok(filters.some(f=>f[0]==="eq"&&f[1]==="direction"&&f[2]==="expense"));
 assert.deepEqual(await actions.mergeApprovedDocuments("invoice","receipt","iv","rv"),{id:"invoice"});
 assert.deepEqual(db.calls[2],{rpc:"merge_approved_documents",args:{p_invoice_id:"invoice",p_receipt_id:"receipt",p_invoice_version:"iv",p_receipt_version:"rv"}});
 }
 const missing=database(null);
 const actions=load("src/lib/transactions/merge-approved.ts",{"next/cache":{revalidatePath(){}},"./load-range":{userContext:async()=>({supabase:missing,userId:"owner"})}});
 assert.ok((await actions.searchApprovedComplement("foreign","")).error);assert.equal(missing.calls.length,1);
 const failed=database(null,{message:"stale_pair"});
 const failedActions=load("src/lib/transactions/merge-approved.ts",{"next/cache":{revalidatePath(){}},"./load-range":{userContext:async()=>({supabase:failed,userId:"owner"})}});
 assert.ok((await failedActions.mergeApprovedDocuments("invoice","receipt","old","old")).error);
 console.log("Passed: bidirectional search, owner and direction filters, approved-only results, missing source, atomic RPC arguments with both versions and failure propagation. PostgreSQL merge/RLS and authenticated UI still require live testing.");
})().catch(error=>{console.error(error);process.exitCode=1;});
