-- ============================================================================
-- מערכת ניהול חשבוניות לעוסק מורשה — סכימת מסד נתונים ראשונית
-- להריץ פעם אחת ב-Supabase: SQL Editor -> New query -> להדביק את כל הקובץ -> Run
-- הסקריפט בטוח להרצה חוזרת (idempotent) אם משהו נכשל באמצע ורוצים לנסות שוב.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. טבלת profiles — פרטי העסק, שורה אחת לכל משתמש, מקושרת ל-auth.users
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  business_name text,
  business_number text,
  vat_rate numeric(5, 2) not null default 18,
  reporting_frequency text not null default 'bimonthly'
    check (reporting_frequency in ('bimonthly', 'monthly')),
  income_tax_advance_rate numeric(5, 2) not null default 0,
  tax_reserve_rate numeric(5, 2) not null default 30,
  created_at timestamptz not null default now()
);
-- הערה: business_name ו-business_number נשארים ריקים (nullable) כי השורה
-- נוצרת אוטומטית בהרשמה, לפני שהמשתמש הספיק למלא את פרטי העסק במסך ההגדרות.

-- ----------------------------------------------------------------------------
-- 2. טבלת categories — קטגוריות סיווג להוצאות והכנסות
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  direction text not null check (direction in ('expense', 'income')),
  default_vat_deductible_percent numeric(5, 2) not null default 100
    check (default_vat_deductible_percent in (100, 66, 25, 0)),
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. טבלת documents — קבצים שהועלו (לפני/אחרי חילוץ נתונים)
-- ----------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  direction text not null check (direction in ('expense', 'income')),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size integer not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'processed', 'failed')),
  extraction_raw jsonb,
  error_message text,
  uploaded_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. טבלת transactions — התנועות הכספיות בפועל
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  direction text not null check (direction in ('expense', 'income')),
  counterparty_name text not null,
  doc_number text,
  doc_type text not null check (
    doc_type in ('invoice_tax', 'invoice_tax_receipt', 'receipt', 'invoice_offer', 'other')
  ),
  doc_date date not null,
  amount_before_vat numeric(12, 2) not null,
  vat_amount numeric(12, 2) not null,
  amount_total numeric(12, 2) not null,
  vat_rate numeric(5, 2) not null default 18,
  vat_deductible_percent numeric(5, 2) not null default 100,
  category_id uuid references public.categories (id) on delete set null,
  currency text not null default 'ILS',
  notes text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. טבלת periods — תקופות דיווח
-- ----------------------------------------------------------------------------
create table if not exists public.periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  submitted_at timestamptz,
  snapshot jsonb,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. אינדקסים על transactions
-- ----------------------------------------------------------------------------
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, doc_date);

create index if not exists transactions_user_direction_idx
  on public.transactions (user_id, direction);

-- ----------------------------------------------------------------------------
-- 7. זיהוי כפילויות אפשריות (אותו user_id + counterparty_name + doc_number + doc_date)
--    אינדקס רגיל (לא ייחודי) לביצועים בבדיקת כפילות באפליקציה בלבד.
--    הבדיקה עצמה, כולל אפשרות "שמור בכל זאת", מתבצעת ברמת האפליקציה
--    (מסך אישור המסמך) ולא כאילוץ קשיח במסד הנתונים.
-- ----------------------------------------------------------------------------
create index if not exists transactions_dedupe_idx
  on public.transactions (user_id, counterparty_name, doc_number, doc_date);

-- ----------------------------------------------------------------------------
-- 8. הפעלת Row Level Security על כל הטבלאות
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.documents enable row level security;
alter table public.transactions enable row level security;
alter table public.periods enable row level security;

-- ----------------------------------------------------------------------------
-- 9. מדיניות RLS — profiles (עמודת הזיהוי כאן היא id, לא user_id)
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 10. מדיניות RLS — categories / documents / transactions / periods
--     בכל הטבלאות האלה יש עמודת user_id, אז אותה מדיניות בדיוק לכולן.
-- ----------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array['categories', 'documents', 'transactions', 'periods']
  loop
    execute format('drop policy if exists "%s_select_own" on public.%I;', tbl, tbl);
    execute format(
      'create policy "%s_select_own" on public.%I for select using (auth.uid() = user_id);',
      tbl, tbl
    );

    execute format('drop policy if exists "%s_insert_own" on public.%I;', tbl, tbl);
    execute format(
      'create policy "%s_insert_own" on public.%I for insert with check (auth.uid() = user_id);',
      tbl, tbl
    );

    execute format('drop policy if exists "%s_update_own" on public.%I;', tbl, tbl);
    execute format(
      'create policy "%s_update_own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      tbl, tbl
    );

    execute format('drop policy if exists "%s_delete_own" on public.%I;', tbl, tbl);
    execute format(
      'create policy "%s_delete_own" on public.%I for delete using (auth.uid() = user_id);',
      tbl, tbl
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 11. Storage — bucket פרטי בשם documents, עם גישה רק לתיקיית המשתמש שלו
--     מבנה נתיב הקבצים: {user_id}/{document_id}/{file_name}
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents_storage_select_own" on storage.objects;
create policy "documents_storage_select_own" on storage.objects
  for select using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents_storage_insert_own" on storage.objects;
create policy "documents_storage_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents_storage_update_own" on storage.objects;
create policy "documents_storage_update_own" on storage.objects
  for update using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents_storage_delete_own" on storage.objects;
create policy "documents_storage_delete_own" on storage.objects
  for delete using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- 12. טריגר: בכל הרשמת משתמש חדש -> יצירת שורת profiles + קטגוריות ברירת מחדל
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);

  insert into public.categories (user_id, name, direction, is_system) values
    (new.id, 'ספקים', 'expense', true),
    (new.id, 'משרד ומחשוב', 'expense', true),
    (new.id, 'רכב ונסיעות', 'expense', true),
    (new.id, 'שיווק ופרסום', 'expense', true),
    (new.id, 'עמלות ובנקים', 'expense', true),
    (new.id, 'מקצועי ורו״ח', 'expense', true),
    (new.id, 'אחר', 'expense', true),
    (new.id, 'שירותים', 'income', true),
    (new.id, 'מכירות', 'income', true),
    (new.id, 'אחר', 'income', true);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 13. טריגר: עדכון אוטומטי של updated_at בכל שינוי בשורת transactions
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ============================================================================
-- סוף הסקריפט
-- ============================================================================
