-- Run once in Supabase SQL Editor. Existing documents and amounts are preserved.
begin;
alter table public.documents add column if not exists transaction_id uuid;
alter table public.documents add column if not exists dismissed_at timestamptz;
create unique index if not exists transactions_id_owner_idx on public.transactions(id,user_id);
do $$ begin
 if not exists(select 1 from pg_constraint where conname='documents_transaction_owner_fk' and conrelid='public.documents'::regclass) then
 alter table public.documents add constraint documents_transaction_owner_fk foreign key(transaction_id,user_id) references public.transactions(id,user_id);
 end if;
end $$;
create index if not exists documents_owner_transaction_idx on public.documents(user_id,transaction_id);
update public.documents d set transaction_id=t.id from public.transactions t
where t.document_id=d.id and t.user_id=d.user_id and t.is_verified=true and d.transaction_id is null
and (select count(*) from public.transactions x where x.document_id=d.id and x.user_id=d.user_id)=1;

-- INVOKER preserves RLS. Lock documents in a stable order before approving/removing.
create or replace function public.confirm_documents(p_document_ids uuid[], p_values jsonb, p_expected_updated_at timestamptz default null)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 uid uuid:=auth.uid(); doc_count int; primary_id uuid; target_id uuid; linked_count int;
 existing public.transactions%rowtype; vals public.transactions%rowtype;
begin
 if uid is null or p_document_ids is null or array_position(p_document_ids,null) is not null or cardinality(p_document_ids) not between 1 and 2 then raise exception 'invalid_documents'; end if;
 perform id from public.documents where user_id=uid and id=any(p_document_ids) order by id for update;
 select count(*) into doc_count from public.documents where user_id=uid and id=any(p_document_ids) and dismissed_at is null and status<>'processing';
 if doc_count<>cardinality(p_document_ids) then raise exception 'documents_unavailable'; end if;
 vals:=jsonb_populate_record(null::public.transactions,p_values);
 if vals.direction not in ('expense','income') or vals.direction is null or nullif(trim(vals.counterparty_name),'') is null
 or vals.doc_type not in ('invoice_tax','invoice_tax_receipt','receipt','invoice_offer','other') or vals.doc_type is null
 or vals.doc_date is null or vals.amount_total is null or vals.amount_total<=0 or vals.amount_before_vat is null or vals.amount_before_vat<0
 or vals.vat_amount is null or vals.vat_amount<0 or abs(vals.amount_before_vat+vals.vat_amount-vals.amount_total)>0.01
 or vals.vat_rate is null or vals.vat_rate<0 or vals.vat_rate>100
 or vals.vat_deductible_percent is null or vals.vat_deductible_percent not in(0,25,66,100) then raise exception 'invalid_values'; end if;
 if vals.category_id is not null and not exists(select 1 from public.categories where id=vals.category_id and user_id=uid and direction=vals.direction) then raise exception 'invalid_category'; end if;
 primary_id:=p_document_ids[1];
 if doc_count=2 then
   if (select count(distinct extraction_raw->>'doc_type') from public.documents where user_id=uid and id=any(p_document_ids) and extraction_raw->>'doc_type' in('invoice_tax','receipt'))<>2 then raise exception 'invalid_pair'; end if;
   if exists(select 1 from public.documents where user_id=uid and id=any(p_document_ids) and direction<>vals.direction) then raise exception 'invalid_direction'; end if;
   select id into primary_id from public.documents where user_id=uid and id=any(p_document_ids) and extraction_raw->>'doc_type'='invoice_tax';
   if vals.doc_type<>'invoice_tax' then raise exception 'invoice_required'; end if;
 end if;
 select count(distinct id) into linked_count from public.transactions where user_id=uid and
 (document_id=any(p_document_ids) or id in(select transaction_id from public.documents where user_id=uid and id=any(p_document_ids)));
 if linked_count>1 then raise exception 'already_separate_transactions'; end if;
 if linked_count=1 then
   select * into existing from public.transactions where user_id=uid and
   (document_id=any(p_document_ids) or id in(select transaction_id from public.documents where user_id=uid and id=any(p_document_ids))) for update;
   if p_expected_updated_at is null or existing.updated_at<>p_expected_updated_at then raise exception 'stale_transaction'; end if;
   target_id:=existing.id;
   -- Existing approved amounts are retained; attaching proof of payment must not overwrite them.
   if existing.doc_type='invoice_tax' then
     if primary_id is distinct from existing.document_id then raise exception 'different_invoice'; end if;
   elsif existing.doc_type='receipt' and doc_count=2 then
     update public.transactions set document_id=primary_id,direction=vals.direction,counterparty_name=trim(vals.counterparty_name),
     doc_number=nullif(trim(vals.doc_number),''),doc_type=vals.doc_type,doc_date=vals.doc_date,
     amount_before_vat=vals.amount_before_vat,vat_amount=vals.vat_amount,amount_total=vals.amount_total,
     vat_rate=vals.vat_rate,vat_deductible_percent=vals.vat_deductible_percent,category_id=vals.category_id,notes=vals.notes,is_verified=true
     where id=target_id and user_id=uid;
   else
     raise exception 'already_approved';
   end if;
 else
   if p_expected_updated_at is not null then raise exception 'stale_transaction'; end if;
   insert into public.transactions(user_id,document_id,direction,counterparty_name,doc_number,doc_type,doc_date,amount_before_vat,vat_amount,amount_total,vat_rate,vat_deductible_percent,category_id,currency,notes,is_verified)
   values(uid,primary_id,vals.direction,trim(vals.counterparty_name),nullif(trim(vals.doc_number),''),vals.doc_type,vals.doc_date,vals.amount_before_vat,vals.vat_amount,vals.amount_total,vals.vat_rate,vals.vat_deductible_percent,vals.category_id,'ILS',vals.notes,true)
   returning id into target_id;
 end if;
 update public.documents set transaction_id=target_id where user_id=uid and id=any(p_document_ids);
 return target_id;
end $$;

create or replace function public.dismiss_review_document(p_document_id uuid)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'not_authenticated'; end if;
 perform id from public.documents where id=p_document_id and user_id=uid for update;
 if not found then raise exception 'not_found'; end if;
 if exists(select 1 from public.transactions where user_id=uid and document_id=p_document_id)
 or exists(select 1 from public.documents where user_id=uid and id=p_document_id and transaction_id is not null) then raise exception 'already_approved'; end if;
 update public.documents set dismissed_at=now() where id=p_document_id and user_id=uid;
end $$;
revoke all on function public.confirm_documents(uuid[],jsonb,timestamptz) from public,anon;
grant execute on function public.confirm_documents(uuid[],jsonb,timestamptz) to authenticated;
revoke all on function public.dismiss_review_document(uuid) from public,anon;
grant execute on function public.dismiss_review_document(uuid) to authenticated;
commit;
