-- Currency support. Run after migration_3. Existing amounts are not converted automatically.
begin;
alter table public.documents add column if not exists currency text;
alter table public.documents add column if not exists valuation_date date;
alter table public.documents add column if not exists verified_doc_type text;
alter table public.documents add column if not exists verified_counterparty_name text;
alter table public.transactions add column if not exists currency_review_required boolean not null default false;
do $block$
declare tbl text;
begin
 foreach tbl in array array['documents','transactions'] loop
  execute format('alter table public.%I add column if not exists original_amount_before_vat numeric(12,2)',tbl);
  execute format('alter table public.%I add column if not exists original_vat_amount numeric(12,2)',tbl);
  execute format('alter table public.%I add column if not exists original_amount_total numeric(12,2)',tbl);
  execute format('alter table public.%I add column if not exists amount_total_usd numeric(12,2)',tbl);
  execute format('alter table public.%I add column if not exists exchange_rate numeric(18,8)',tbl);
  execute format('alter table public.%I add column if not exists exchange_rate_date date',tbl);
 end loop;
end $block$;
alter table public.documents add column if not exists amount_before_vat numeric(12,2);
alter table public.documents add column if not exists vat_amount numeric(12,2);
alter table public.documents add column if not exists amount_total numeric(12,2);
update public.transactions t set currency_review_required=true
where exchange_rate is null and (currency<>'ILS' or exists(select 1 from public.documents d where d.id=t.document_id and d.user_id=t.user_id and upper(d.extraction_raw->>'currency') not in('ILS','NIS')));
update public.transactions set original_amount_before_vat=amount_before_vat,original_vat_amount=vat_amount,original_amount_total=amount_total
where currency='ILS' and not currency_review_required and original_amount_total is null;

create or replace function public.valid_currency_values(v jsonb, document_date date)
returns boolean language plpgsql immutable set search_path=public,pg_temp as $$
declare c text:=v->>'currency'; r numeric:=(v->>'exchange_rate')::numeric;
 b numeric:=(v->>'original_amount_before_vat')::numeric; vat numeric:=(v->>'original_vat_amount')::numeric;
 total numeric:=(v->>'original_amount_total')::numeric; converted numeric; converted_before numeric;
begin
 if c is null or c not in('ILS','USD') or r is null or r<=0 or r>1000 or document_date is null
 or (v->>'exchange_rate_date')::date is null or (v->>'exchange_rate_date')::date>document_date
 or b is null or vat is null or total is null or b<0 or vat<0 or total<=0 or abs(b+vat-total)>0.01 then return false; end if;
 converted:=case when c='USD' then round(total*r,2) else total end;
 converted_before:=case when c='USD' then round(b*r,2) else b end;
 return coalesce((v->>'amount_total')::numeric=converted and (v->>'amount_before_vat')::numeric=converted_before
 and (v->>'vat_amount')::numeric=converted-converted_before
 and (v->>'amount_total_usd')::numeric=case when c='USD' then total else round(total/r,2) end,false);
end $$;

create or replace function public.save_financial_record(p_values jsonb, p_document_values jsonb default '{}'::jsonb,
 p_transaction_id uuid default null,p_expected_updated_at timestamptz default null,p_attach_only boolean default false)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); target uuid:=p_transaction_id; vals public.transactions%rowtype;
 old public.transactions%rowtype; ids uuid[]; k text; v jsonb; n int; primary_id uuid;
begin
 if uid is null or p_attach_only is null or p_document_values is null or jsonb_typeof(p_document_values)<>'object' then raise exception 'invalid_request'; end if;
 select coalesce(array_agg(key::uuid order by key),array[]::uuid[]) into ids from jsonb_object_keys(p_document_values) key;
 if cardinality(ids)>2 then raise exception 'too_many_documents'; end if;
 perform id from public.documents where user_id=uid and id=any(ids) order by id for update;
 select count(*) into n from public.documents where user_id=uid and id=any(ids) and dismissed_at is null and status<>'processing';
 if n<>cardinality(ids) then raise exception 'document_unavailable'; end if;
 if exists(select 1 from public.documents where user_id=uid and id=any(ids) and transaction_id is not null and (target is null or transaction_id<>target))
 or exists(select 1 from public.transactions where user_id=uid and document_id=any(ids) and (target is null or id<>target)) then raise exception 'document_already_linked'; end if;
 if target is not null then
  select * into old from public.transactions where user_id=uid and id=target for update;
  if not found or p_expected_updated_at is null or old.updated_at<>p_expected_updated_at then raise exception 'stale_transaction'; end if;
 end if;
 vals:=jsonb_populate_record(null::public.transactions,p_values);
 if p_attach_only then
  if target is null or old.doc_type<>'invoice_tax' or not old.is_verified or cardinality(ids)<>1 then raise exception 'invalid_attachment'; end if;
  if old.currency_review_required then raise exception 'invoice_currency_review_required'; end if;
  primary_id:=old.document_id;
 else
  if not public.valid_currency_values(p_values,vals.doc_date) then raise exception 'invalid_currency_values'; end if;
  if vals.direction is null or vals.direction not in('income','expense') or nullif(trim(vals.counterparty_name),'') is null
   or vals.doc_type is null or vals.doc_type not in('invoice_tax','invoice_tax_receipt','receipt','invoice_offer','other')
   or vals.vat_rate is null or vals.vat_rate not between 0 and 100 or vals.vat_deductible_percent is null or vals.vat_deductible_percent not in(0,25,66,100)
   then raise exception 'invalid_values'; end if;
  if vals.category_id is not null and not exists(select 1 from public.categories where user_id=uid and id=vals.category_id and direction=vals.direction) then raise exception 'invalid_category'; end if;
  primary_id:=vals.document_id;
  if primary_id is not null and not(primary_id=any(ids)) then raise exception 'primary_document_missing'; end if;
  if cardinality(ids)=2 and (vals.doc_type<>'invoice_tax'
    or (select count(*) from jsonb_each(p_document_values) e where e.value->>'verified_doc_type'='receipt')<>1
    or (p_document_values->primary_id::text->>'verified_doc_type')<>'invoice_tax') then raise exception 'invalid_pair'; end if;
 end if;
 for k,v in select * from jsonb_each(p_document_values) loop
  if not p_attach_only and v->>'direction' is distinct from vals.direction then raise exception 'invalid_document_direction'; end if;
  if not public.valid_currency_values(v,(v->>'valuation_date')::date) or v->>'verified_doc_type' not in('invoice_tax','invoice_tax_receipt','receipt','invoice_offer','other') or v->>'verified_doc_type' is null then raise exception 'invalid_document_values'; end if;
  if p_attach_only and (v->>'verified_doc_type'<>'receipt' or v->>'direction' is distinct from old.direction) then raise exception 'invalid_receipt'; end if;
 end loop;
 if not p_attach_only then
  if target is null then
   insert into public.transactions(user_id,document_id,direction,counterparty_name,doc_number,doc_type,doc_date,amount_before_vat,vat_amount,amount_total,vat_rate,vat_deductible_percent,category_id,currency,notes,is_verified,
    original_amount_before_vat,original_vat_amount,original_amount_total,amount_total_usd,exchange_rate,exchange_rate_date,currency_review_required)
   values(uid,primary_id,vals.direction,trim(vals.counterparty_name),nullif(trim(vals.doc_number),''),vals.doc_type,vals.doc_date,vals.amount_before_vat,vals.vat_amount,vals.amount_total,vals.vat_rate,vals.vat_deductible_percent,vals.category_id,vals.currency,vals.notes,true,
    vals.original_amount_before_vat,vals.original_vat_amount,vals.original_amount_total,vals.amount_total_usd,vals.exchange_rate,vals.exchange_rate_date,false) returning id into target;
  else
   update public.transactions set document_id=primary_id,direction=vals.direction,counterparty_name=trim(vals.counterparty_name),doc_number=nullif(trim(vals.doc_number),''),doc_type=vals.doc_type,doc_date=vals.doc_date,
    amount_before_vat=vals.amount_before_vat,vat_amount=vals.vat_amount,amount_total=vals.amount_total,vat_rate=vals.vat_rate,vat_deductible_percent=vals.vat_deductible_percent,category_id=vals.category_id,currency=vals.currency,notes=vals.notes,
    original_amount_before_vat=vals.original_amount_before_vat,original_vat_amount=vals.original_vat_amount,original_amount_total=vals.original_amount_total,amount_total_usd=vals.amount_total_usd,exchange_rate=vals.exchange_rate,exchange_rate_date=vals.exchange_rate_date,currency_review_required=false
    where id=target and user_id=uid;
  end if;
 end if;
 for k,v in select * from jsonb_each(p_document_values) loop
  update public.documents set transaction_id=target,currency=v->>'currency',valuation_date=(v->>'valuation_date')::date,verified_doc_type=v->>'verified_doc_type',verified_counterparty_name=v->>'verified_counterparty_name',
   original_amount_before_vat=(v->>'original_amount_before_vat')::numeric,original_vat_amount=(v->>'original_vat_amount')::numeric,original_amount_total=(v->>'original_amount_total')::numeric,
   amount_before_vat=(v->>'amount_before_vat')::numeric,vat_amount=(v->>'vat_amount')::numeric,amount_total=(v->>'amount_total')::numeric,amount_total_usd=(v->>'amount_total_usd')::numeric,
   exchange_rate=(v->>'exchange_rate')::numeric,exchange_rate_date=(v->>'exchange_rate_date')::date
   where id=k::uuid and user_id=uid;
 end loop;
 return target;
end $$;
revoke all on function public.save_financial_record(jsonb,jsonb,uuid,timestamptz,boolean) from public,anon;
grant execute on function public.save_financial_record(jsonb,jsonb,uuid,timestamptz,boolean) to authenticated;
commit;
