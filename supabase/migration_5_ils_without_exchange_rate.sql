-- Run once after migration_4, BEFORE deploying the ILS fast path.
-- Only replaces the pure validation helper; no row updates, RLS or grants change.
begin;
create or replace function public.valid_currency_values(v jsonb, document_date date)
returns boolean language plpgsql immutable set search_path=public,pg_temp as $$
declare c text:=v->>'currency'; r numeric:=(v->>'exchange_rate')::numeric;
 b numeric:=(v->>'original_amount_before_vat')::numeric; vat numeric:=(v->>'original_vat_amount')::numeric;
 total numeric:=(v->>'original_amount_total')::numeric; converted numeric; converted_before numeric;
begin
 -- ILS records do not require a USD valuation. Keep the legacy rate path below
 -- for existing clients that still send a real rate and USD amount.
 if c='ILS' and v->>'exchange_rate' is null and v->>'exchange_rate_date' is null and v->>'amount_total_usd' is null then
  return coalesce(document_date is not null and b>=0 and vat>=0 and total>0
   and b<10000000000 and vat<10000000000 and total<10000000000
   and b=round(b,2) and vat=round(vat,2) and total=round(total,2)
   and abs(b+vat-total)<=0.01
   and (v->>'amount_before_vat')::numeric=b
   and (v->>'amount_total')::numeric=total
   and (v->>'vat_amount')::numeric=total-b,false);
 end if;
 if c is null or c not in('ILS','USD') or r is null or r<=0 or r>1000 or document_date is null
 or (v->>'exchange_rate_date')::date is null or (v->>'exchange_rate_date')::date>document_date
 or b is null or vat is null or total is null or b<0 or vat<0 or total<=0 or abs(b+vat-total)>0.01 then return false; end if;
 converted:=case when c='USD' then round(total*r,2) else total end;
 converted_before:=case when c='USD' then round(b*r,2) else b end;
 return coalesce((v->>'amount_total')::numeric=converted and (v->>'amount_before_vat')::numeric=converted_before
 and (v->>'vat_amount')::numeric=converted-converted_before
 and (v->>'amount_total_usd')::numeric=case when c='USD' then total else round(total/r,2) end,false);
end $$;

-- Pure validation checks. A failure rolls back the function replacement.
do $checks$
declare v jsonb := '{"currency":"ILS","original_amount_before_vat":100,"original_vat_amount":18,"original_amount_total":118,"amount_before_vat":100,"vat_amount":18,"amount_total":118,"exchange_rate":null,"exchange_rate_date":null,"amount_total_usd":null}'::jsonb;
begin
 if not public.valid_currency_values(v,'2026-02-08') then raise exception 'ILS_without_rate_rejected'; end if;
 if public.valid_currency_values(v || '{"amount_total":119}'::jsonb,'2026-02-08') then raise exception 'inconsistent_ILS_accepted'; end if;
 if public.valid_currency_values(v || '{"currency":"USD"}'::jsonb,'2026-02-08') then raise exception 'USD_without_rate_accepted'; end if;
 if public.valid_currency_values(v || '{"exchange_rate":3.125}'::jsonb,'2026-02-08') then raise exception 'partial_rate_accepted'; end if;
 if not public.valid_currency_values(v || '{"exchange_rate":3.125,"exchange_rate_date":"2026-02-06","amount_total_usd":37.76}'::jsonb,'2026-02-08') then raise exception 'legacy_ILS_rejected'; end if;
 if not public.valid_currency_values(v || '{"currency":"USD","exchange_rate":3.125,"exchange_rate_date":"2026-02-06","amount_before_vat":312.50,"vat_amount":56.25,"amount_total":368.75,"amount_total_usd":118}'::jsonb,'2026-02-08') then raise exception 'USD_with_rate_rejected'; end if;
end $checks$;
commit;
