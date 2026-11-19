
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

-- ===== Stock from playperformance.com =====
insert into public.docs (path, col, data) values
('vehicles/pp-ranger', 'vehicles', '{"year": "2021", "make": "Ford", "model": "Ranger Wildtrak", "badge": "Wildtrak", "bodyType": "Ute", "colour": "White", "doors": "4", "transmission": "Automatic", "driveType": "4WD", "fuelType": "Diesel", "cylinders": "5", "odometer": "82730", "price": "51950", "highlights": "Brand new aftermarket wheels\nBrand new aftermarket tyres\nRoller shutter\nLeather interior\nReverse camera\nTinted windows\nPush button start", "photos": ["https://playperformance.com/wp-content/uploads/2026/11/PP67281-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67275-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67276-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67277-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67279-1-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67278-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67280-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67283-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67284-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67285-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67286-1024x683.jpg"], "status": "available", "createdAt": 1795064400000, "updatedAt": 1795064400000, "publishedAt": 1795064400000, "leather": "Yes", "wheels": "Brand new aftermarket"}'::jsonb),
('vehicles/pp-hilux', 'vehicles', '{"year": "2023", "make": "Toyota", "model": "HiLux SR5", "badge": "SR5", "bodyType": "Ute", "colour": "Blue", "transmission": "Automatic", "driveType": "4WD", "fuelType": "Diesel", "cylinders": "4", "odometer": "49528", "price": "69950", "highlights": "Brand new aftermarket wheels\nBrand new aftermarket tyres\nHard lid\nLeather seats\nReverse camera\nTinted windows\nPush button start", "photos": ["https://playperformance.com/wp-content/uploads/2026/11/PP67270-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67263-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67264-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67265-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67266-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67267-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67268-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67271-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67272-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67273-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67274-1024x683.jpg"], "status": "available", "createdAt": 1795060800000, "updatedAt": 1795060800000, "publishedAt": 1795060800000, "leather": "Yes", "wheels": "Brand new aftermarket"}'::jsonb),
('vehicles/pp-86', 'vehicles', '{"year": "2016", "make": "Toyota", "model": "86 Coupe", "bodyType": "Coupe", "colour": "White", "doors": "2", "transmission": "Manual", "driveType": "RWD", "fuelType": "Petrol", "cylinders": "4", "odometer": "89150", "price": "36950", "highlights": "Manual\nAftermarket duck lip wing\nBluetooth\nReverse camera\nTinted windows", "photos": ["https://playperformance.com/wp-content/uploads/2026/11/PP67166-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67159-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67160-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67162-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67163-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67164-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67165-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67168-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67170-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67171-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67172-1024x683.jpg"], "status": "available", "createdAt": 1795057200000, "updatedAt": 1795057200000, "publishedAt": 1795057200000}'::jsonb),
('vehicles/pp-storm', 'vehicles', '{"year": "2014", "make": "Holden", "model": "VF SS Storm Ute", "badge": "SS Storm", "bodyType": "Ute", "colour": "Blue", "doors": "2", "transmission": "Manual", "driveType": "RWD", "fuelType": "Petrol", "cylinders": "8", "wheels": "Aftermarket", "odometer": "104648", "price": "49950", "highlights": "Aftermarket wheels\nLeather interior\nProfessionally lowered\nAftermarket lip kit\nAftermarket exhaust\nReverse camera\nTinted windows", "photos": ["https://playperformance.com/wp-content/uploads/2026/11/PP67115-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67109-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67110-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67111-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67112-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67113-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67114-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67117-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67118-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67119-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67120-1024x683.jpg"], "status": "available", "createdAt": 1795053600000, "updatedAt": 1795053600000, "publishedAt": 1795053600000, "leather": "Yes", "upgrades": "Professionally lowered, aftermarket lip kit, aftermarket exhaust"}'::jsonb),
('vehicles/pp-navara', 'vehicles', '{"year": "2021", "make": "Nissan", "model": "Navara ST-X", "badge": "ST-X", "bodyType": "Ute", "colour": "Black", "transmission": "Automatic", "driveType": "RWD", "fuelType": "Diesel", "cylinders": "4", "odometer": "121350", "price": "70950", "highlights": "Brand new aftermarket wheels and tyres\nAftermarket bullbar\nLadder rack, toolboxes and tray\nRoof racks\nLeather seats\nReverse camera\nPush button start", "photos": ["https://playperformance.com/wp-content/uploads/2026/11/PP67079-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67070-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67071-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67072-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67073-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67077-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67078-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67081-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67082-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67083-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67084-1024x683.jpg"], "status": "available", "createdAt": 1795050000000, "updatedAt": 1795050000000, "publishedAt": 1795050000000, "leather": "Yes", "wheels": "Brand new aftermarket", "tradesmanExtras": "Bullbar, ladder rack, toolboxes, tray, roof racks"}'::jsonb),
('vehicles/pp-c200', 'vehicles', '{"year": "2021", "make": "Mercedes-Benz", "model": "C200 Sedan", "badge": "C200", "bodyType": "Sedan", "colour": "Silver", "doors": "4", "transmission": "Automatic", "driveType": "RWD", "fuelType": "Petrol", "cylinders": "4", "odometer": "59203", "price": "54950", "highlights": "Panorama roof\nHead-up display\nLeather interior\nMemory seats\nPaddle shift\nReverse camera\nPush button start", "photos": ["https://playperformance.com/wp-content/uploads/2026/11/PP67093-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67085-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67087-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67089-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67090-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67091-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67092-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67094-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67095-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67096-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67097-1024x683.jpg"], "status": "available", "createdAt": 1795046400000, "updatedAt": 1795046400000, "publishedAt": 1795046400000, "leather": "Yes", "sunroof": "Yes"}'::jsonb),
('vehicles/pp-cla-sedan', 'vehicles', '{"year": "2018", "make": "Mercedes-Benz", "model": "CLA45 AMG Sedan", "badge": "CLA45 AMG", "bodyType": "Sedan", "colour": "Grey", "doors": "4", "transmission": "Automatic", "driveType": "AWD", "fuelType": "Petrol", "cylinders": "4", "odometer": "160715", "price": "43950", "highlights": "Panorama roof\nLeather interior\nMemory seats\nPaddle shift\nReverse camera\nTinted windows", "photos": ["https://playperformance.com/wp-content/uploads/2026/11/PP67064-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67055-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67056-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67057-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67061-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67062-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67063-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67066-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67067-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67069-1024x683.jpg"], "status": "available", "createdAt": 1795042800000, "updatedAt": 1795042800000, "publishedAt": 1795042800000, "leather": "Yes", "sunroof": "Yes"}'::jsonb),
('vehicles/pp-cla-wagon', 'vehicles', '{"year": "2015", "make": "Mercedes-Benz", "model": "CLA45 AMG Shooting Brake", "badge": "CLA45 AMG", "bodyType": "Wagon", "colour": "Silver", "doors": "5", "transmission": "Automatic", "driveType": "AWD", "fuelType": "Petrol", "cylinders": "4", "odometer": "116001", "price": "41950", "highlights": "Panorama roof\nHead-up display\nLeather interior\nMemory seats\nPaddle shift\nReverse camera", "photos": ["https://playperformance.com/wp-content/uploads/2026/11/PP67048-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67042-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67043-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67044-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67045-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67046-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67047-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67050-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67051-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67052-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67053-1024x683.jpg"], "status": "available", "createdAt": 1795039200000, "updatedAt": 1795039200000, "publishedAt": 1795039200000, "leather": "Yes", "sunroof": "Yes"}'::jsonb),
('vehicles/pp-hsv', 'vehicles', '{"year": "2012", "make": "HSV", "model": "Clubsport R8 Sedan", "badge": "R8", "bodyType": "Sedan", "colour": "Red", "doors": "4", "transmission": "Automatic", "driveType": "RWD", "fuelType": "Petrol", "cylinders": "8", "odometer": "173408", "price": "64950", "highlights": "Leather seats\nReverse camera\nTinted windows\nFresh full professional detail", "photos": ["https://playperformance.com/wp-content/uploads/2026/11/PP67036-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67030-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67031-1-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67032-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67033-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67034-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67035-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67038-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67039-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67040-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP67041-1024x683.jpg"], "status": "available", "createdAt": 1795035600000, "updatedAt": 1795035600000, "publishedAt": 1795035600000, "leather": "Yes"}'::jsonb),
('vehicles/pp-vf-wagon', 'vehicles', '{"year": "2017", "make": "Holden", "model": "VF SS Commodore Wagon", "badge": "SS", "bodyType": "Wagon", "colour": "Silver", "doors": "5", "transmission": "Automatic", "driveType": "RWD", "fuelType": "Petrol", "cylinders": "8", "odometer": "155912", "price": "57950", "highlights": "LS3 V8\nHead-up display\nLeather interior\nReverse camera\nBluetooth\nPush button start", "photos": ["https://playperformance.com/wp-content/uploads/2026/11/PP66993-1-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66986-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66987-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66989-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66990-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66991-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66992-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66995-1-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66996-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66997-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66998-1024x683.jpg"], "status": "available", "createdAt": 1795032000000, "updatedAt": 1795032000000, "publishedAt": 1795032000000, "leather": "Yes", "engineSize": "6.2L LS3 V8"}'::jsonb),
('vehicles/pp-evoque', 'vehicles', '{"year": "2017", "make": "Range Rover", "model": "Evoque", "bodyType": "SUV", "colour": "White", "doors": "5", "transmission": "Automatic", "driveType": "AWD", "fuelType": "Diesel", "cylinders": "4", "odometer": "153292", "price": "38950", "highlights": "Panorama roof\nLeather interior\nPaddle shift\nReverse camera\nBluetooth\nPush button start", "photos": ["https://playperformance.com/wp-content/uploads/2026/11/PP66968-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66961-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66962-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66963-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66964-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66965-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66966-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66970-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66971-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66972-1024x683.jpg", "https://playperformance.com/wp-content/uploads/2026/11/PP66973-1024x683.jpg"], "status": "available", "createdAt": 1795028400000, "updatedAt": 1795028400000, "publishedAt": 1795028400000, "leather": "Yes", "sunroof": "Yes"}'::jsonb)
on conflict (path) do update set data = excluded.data, updated_at = now();
