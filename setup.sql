
-- ===== Play Performance Acquisition Centre: database setup =====
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text, email text, phone text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.docs (
  path text primary key,
  col text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists docs_col_idx on public.docs(col);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, phone)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name',''), coalesce(new.raw_user_meta_data->>'phone',''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.docs enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid()));

drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select using (
  (col = 'vehicles' and (coalesce(data->>'status','available') not in ('draft','hidden') or public.is_admin()))
  or col = 'claims'
  or public.is_admin()
  or (auth.uid() is not null and (
       path = 'purchases/' || auth.uid()::text
    or path like 'data/users/' || auth.uid()::text || '/%'
    or path = 'threads/' || auth.uid()::text
    or path like 'threads/' || auth.uid()::text || '/%'))
);
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert with check (
  public.is_admin()
  or (auth.uid() is not null and (
       (col = 'claims' and data->>'buyer' = auth.uid()::text
         and exists (select 1 from public.docs v where v.path = 'vehicles/' || split_part(docs.path,'/',2)
                     and coalesce(v.data->>'status','available') = 'available'))
    or path = 'purchases/' || auth.uid()::text
    or path like 'data/users/' || auth.uid()::text || '/%'
    or path = 'threads/' || auth.uid()::text
    or (path like 'threads/' || auth.uid()::text || '/m/%' and data->>'from' = 'buyer')))
);
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update using (
  public.is_admin()
  or (auth.uid() is not null and (path = 'purchases/' || auth.uid()::text or path like 'data/users/' || auth.uid()::text || '/%' or path = 'threads/' || auth.uid()::text))
) with check (
  public.is_admin()
  or (auth.uid() is not null and (path = 'purchases/' || auth.uid()::text or path like 'data/users/' || auth.uid()::text || '/%' or path = 'threads/' || auth.uid()::text))
);
drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete using (
  public.is_admin() or (auth.uid() is not null and path like 'data/users/' || auth.uid()::text || '/%')
);

grant usage on schema public to anon, authenticated;
grant select on public.docs to anon, authenticated;
grant insert, update, delete on public.docs to authenticated;
grant select, update on public.profiles to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- live updates
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- photo storage (public read, admin upload)
insert into storage.buckets (id, name, public) values ('photos','photos', true) on conflict (id) do nothing;
drop policy if exists photos_admin_insert on storage.objects;
create policy photos_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_admin());
drop policy if exists photos_admin_delete on storage.objects;
create policy photos_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.is_admin());


-- ===== Update: sign-in required to view stock; extra sign-up details =====
alter table public.profiles add column if not exists suburb text;
alter table public.profiles add column if not exists state text;
alter table public.profiles add column if not exists looking_for text;
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, phone, suburb, state, looking_for)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'name',''), coalesce(new.raw_user_meta_data->>'phone',''),
    coalesce(new.raw_user_meta_data->>'suburb',''), coalesce(new.raw_user_meta_data->>'state',''),
    coalesce(new.raw_user_meta_data->>'looking_for',''))
  on conflict (id) do nothing;
  return new;
end $$;
drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select using (
  public.is_admin()
  or (auth.uid() is not null and (
       (col = 'vehicles' and coalesce(data->>'status','available') not in ('draft','hidden'))
    or col = 'claims'
    or path = 'purchases/' || auth.uid()::text
    or path like 'data/users/' || auth.uid()::text || '/%'
    or path = 'threads/' || auth.uid()::text
    or path like 'threads/' || auth.uid()::text || '/%'))
);
revoke select on public.docs from anon;

-- ===== Update: dealership + licence on sign-up =====
alter table public.profiles add column if not exists dealership text;
alter table public.profiles add column if not exists licence text;
-- handle_new_user() now also stores raw_user_meta_data->>'dealership' and ->>'licence'
