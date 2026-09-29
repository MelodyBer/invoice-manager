-- הוספת תור ייבוא אישי מ־Gmail; אין שינוי בתנועות קיימות.
begin;
create table if not exists public.gmail_import_items (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 mailbox text not null,
 message_id text not null,
 part_id text not null,
 file_name text not null,
 mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
 file_size integer not null check (file_size > 0 and file_size <= 10485760),
 received_on date not null,
 state text not null default 'pending' check (state in ('pending','processing','review','ignored','duplicate','imported','failed')),
 recipient_name text,
 reason text,
 storage_path text,
 content_hash text,
 extraction_raw jsonb,
 document_id uuid,
 claim_token uuid,
 claimed_at timestamptz,
 created_at timestamptz not null default now(),
 unique (user_id, mailbox, message_id, part_id),
 check (storage_path is null or split_part(storage_path,'/',1) = user_id::text),
 check (content_hash is null or content_hash ~ '^[a-f0-9]{64}$')
);
create unique index if not exists gmail_import_hash_unique on public.gmail_import_items(user_id, content_hash) where content_hash is not null;
create index if not exists gmail_import_queue on public.gmail_import_items(user_id, created_at desc, id);
alter table public.gmail_import_items enable row level security;
drop policy if exists own_gmail_imports on public.gmail_import_items;
create policy own_gmail_imports on public.gmail_import_items for all to authenticated
 using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.gmail_import_items from anon;
grant select, insert, update, delete on public.gmail_import_items to authenticated;

-- נעילה ושמירה אטומית: שני ניסיונות אישור יוצרים מסמך אחד בלבד.
create or replace function public.import_gmail_document(p_item_id uuid) returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare item public.gmail_import_items%rowtype; result_id uuid;
begin
 select * into item from public.gmail_import_items where id=p_item_id and user_id=auth.uid() for update;
 if not found then raise exception 'פריט הייבוא לא נמצא'; end if;
 if item.state='imported' then return item.document_id; end if;
 if item.state <> 'review' or item.storage_path is null then raise exception 'המסמך אינו מוכן לייבוא'; end if;
 insert into public.documents(id,user_id,direction,storage_path,file_name,mime_type,file_size,status,extraction_raw)
 values(item.id,auth.uid(),'expense',item.storage_path,item.file_name,item.mime_type,item.file_size,
 case when item.extraction_raw is null then 'pending' else 'processed' end,item.extraction_raw)
 returning id into result_id;
 update public.gmail_import_items set state='imported',document_id=result_id,reason='הועבר למסמכים לאישור',claim_token=null
 where id=item.id and user_id=auth.uid();
 return result_id;
end $$;
revoke all on function public.import_gmail_document(uuid) from public, anon;
grant execute on function public.import_gmail_document(uuid) to authenticated;
commit;
