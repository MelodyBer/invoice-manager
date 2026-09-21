-- Run after migration_5. Merge an approved invoice and receipt atomically.
begin;
create or replace function public.merge_approved_documents(p_invoice_id uuid,p_receipt_id uuid,p_invoice_version timestamptz,p_receipt_version timestamptz)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); inv public.transactions%rowtype; rec public.transactions%rowtype;
 locked_ids uuid[]; current_ids uuid[];
begin
 if uid is null or p_invoice_id is null or p_receipt_id is null or p_invoice_id=p_receipt_id then raise exception 'invalid_pair'; end if;
 -- Same document-before-transaction locking order as save_financial_record.
 select array_agg(d.id order by d.id) into locked_ids from public.documents d
 where d.user_id=uid and (d.transaction_id in(p_invoice_id,p_receipt_id) or d.id in(select t.document_id from public.transactions t where t.user_id=uid and t.id in(p_invoice_id,p_receipt_id)));
 perform id from public.documents where user_id=uid and id=any(locked_ids) order by id for update;
 perform id from public.transactions where user_id=uid and id in(p_invoice_id,p_receipt_id) order by id for update;
 select * into inv from public.transactions where user_id=uid and id=p_invoice_id;
 select * into rec from public.transactions where user_id=uid and id=p_receipt_id;
 if inv.id is null or rec.id is null or inv.doc_type<>'invoice_tax' or rec.doc_type<>'receipt'
 or not inv.is_verified or not rec.is_verified or inv.direction<>rec.direction
 or inv.document_id is null or rec.document_id is null or inv.document_id=rec.document_id
 or inv.currency_review_required or rec.currency_review_required then raise exception 'invalid_pair'; end if;
 if p_invoice_version is null or p_receipt_version is null or inv.updated_at<>p_invoice_version or rec.updated_at<>p_receipt_version then raise exception 'stale_pair'; end if;
 select array_agg(d.id order by d.id) into current_ids from public.documents d
 where d.user_id=uid and (d.transaction_id in(p_invoice_id,p_receipt_id) or d.id in(inv.document_id,rec.document_id));
 -- This operation joins two single-document transactions, not already merged groups.
 if cardinality(current_ids) is distinct from 2 or current_ids is distinct from locked_ids
 or not(inv.document_id=any(current_ids)) or not(rec.document_id=any(current_ids)) then raise exception 'already_grouped'; end if;
 if exists(select 1 from public.documents where user_id=uid and id=any(current_ids)
   and (dismissed_at is not null or status='processing' or direction<>inv.direction
    or (transaction_id is not null and transaction_id not in(p_invoice_id,p_receipt_id))))
 or exists(select 1 from public.transactions where user_id=uid and document_id=any(current_ids) and id not in(p_invoice_id,p_receipt_id))
 then raise exception 'document_unavailable'; end if;
 -- Legacy documents get a snapshot from their already approved transaction.
 -- Existing per-document dates, original amounts and real exchange rates stay intact.
 update public.documents d set currency=t.currency,valuation_date=t.doc_date,verified_doc_type=t.doc_type,verified_counterparty_name=t.counterparty_name,
  original_amount_before_vat=t.original_amount_before_vat,original_vat_amount=t.original_vat_amount,original_amount_total=t.original_amount_total,
  amount_before_vat=t.amount_before_vat,vat_amount=t.vat_amount,amount_total=t.amount_total,amount_total_usd=t.amount_total_usd,
  exchange_rate=t.exchange_rate,exchange_rate_date=t.exchange_rate_date
 from public.transactions t where t.user_id=uid and d.user_id=uid and t.id in(p_invoice_id,p_receipt_id) and d.id=t.document_id and d.valuation_date is null;
 -- Preserve the complete approved receipt record, including corrected document
 -- number/category/notes, without overwriting any original extraction fields.
 update public.documents set extraction_raw=coalesce(extraction_raw,'{}'::jsonb)
  || jsonb_build_object('merged_approved_transaction',to_jsonb(rec))
 where user_id=uid and id=rec.document_id;
 update public.documents set transaction_id=p_invoice_id where user_id=uid and id=any(current_ids);
 -- Preserve receipt notes before removing its separate accounting entry.
 update public.transactions set notes=case when nullif(trim(rec.notes),'') is null then notes
 else concat_ws(E'\n\n',nullif(notes,''),'[הערות הקבלה '||coalesce(rec.doc_number,'')||'] '||rec.notes) end
 where user_id=uid and id=p_invoice_id;
 delete from public.transactions where user_id=uid and id=p_receipt_id;
 return p_invoice_id;
end $$;
revoke all on function public.merge_approved_documents(uuid,uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.merge_approved_documents(uuid,uuid,timestamptz,timestamptz) to authenticated;
commit;
