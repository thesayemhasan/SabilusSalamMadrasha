-- ============================================================
-- সাবিলুস সালাম মাদরাসা — ধাপ ১ ডাটাবেস স্কিমা
-- Supabase > SQL Editor এ পুরোটা পেস্ট করে একবার Run করুন।
-- ============================================================

-- ---------- ব্যবহারকারী ও ভূমিকা ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'none'
    check (role in ('none','super_admin','admin','accountant','staff','teacher','parent')),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles
    where id = auth.uid() and role in ('super_admin','admin'));
$$;

create or replace function public.is_super() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin');
$$;


-- ---------- ফিচার তালিকা ও অনুমতি (সুপার অ্যাডমিন ঠিক করে) ----------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('none','super_admin','admin','accountant','staff','teacher','parent'));

create table if not exists public.features (
  key text primary key,
  area text not null check (area in ('inbox','people','finance','cms','system','custom')),
  grp text not null,
  name_bn text not null,
  name_en text,
  sort int not null default 100,
  builtin boolean not null default true
);

insert into public.features (key, area, grp, name_bn, name_en, sort) values
  ('applications','inbox','ইনবক্স','ভর্তির আবেদন','Admission applications',10),
  ('messages','inbox','ইনবক্স','যোগাযোগের বার্তা','Contact messages',11),
  ('students','people','ছাত্র ও হাজিরা','ছাত্র-ছাত্রী','Students',20),
  ('classes','people','ছাত্র ও হাজিরা','শ্রেণি ও হালকা','Classes',21),
  ('staff','people','ছাত্র ও হাজিরা','শিক্ষক ও কর্মচারী','Teachers & staff',22),
  ('attendance','people','ছাত্র ও হাজিরা','হাজিরা','Attendance',23),
  ('att_setup','people','ছাত্র ও হাজিরা','আবাসিক ধরন ও হাজিরার সময়','Residence & sessions',24),
  ('fees','finance','ফি ও হিসাব','ফি আদায় ও রসিদ','Fee collection & receipts',30),
  ('billing','finance','ফি ও হিসাব','বিল তৈরি','Billing',31),
  ('fee_setup','finance','ফি ও হিসাব','ফি-র ধরন ও পরিমাণ','Fee setup',32),
  ('income','finance','ফি ও হিসাব','দান ও অন্যান্য আয়','Donations & income',33),
  ('expense','finance','ফি ও হিসাব','ব্যয়','Expenses',34),
  ('salary','finance','ফি ও হিসাব','শিক্ষক-কর্মচারীর বেতন','Salary',35),
  ('reports','finance','ফি ও হিসাব','হিসাব ও রিপোর্ট','Reports',36),
  ('account_setup','finance','ফি ও হিসাব','খাত ও পেমেন্ট মাধ্যম','Accounts setup',37),
  ('audit','finance','ফি ও হিসাব','আর্থিক লগ','Financial log',38),
  ('texts','cms','ওয়েবসাইট','সাইটের লেখা','Site texts',40),
  ('slides','cms','ওয়েবসাইট','হোম স্লাইড','Home slides',41),
  ('departments','cms','ওয়েবসাইট','বিভাগসমূহ','Departments',42),
  ('home_blocks','cms','ওয়েবসাইট','হোম সেকশন','Home sections',43),
  ('notices','cms','ওয়েবসাইট','নোটিশ','Notices',44),
  ('events','cms','ওয়েবসাইট','ইভেন্ট ও টাইমার','Events',45),
  ('gallery','cms','ওয়েবসাইট','গ্যালারি','Gallery',46),
  ('teachers','cms','ওয়েবসাইট','শিক্ষকবৃন্দ (পাবলিক)','Public teachers',47),
  ('admission_form','cms','ওয়েবসাইট','ভর্তি ফরম','Admission form',48),
  ('modules','system','সিস্টেম','মডিউল সুইচ','Module switches',60),
  ('integrations','system','সিস্টেম','মেশিন ও বাইরের সেবা','Integrations',61),
  ('settings','system','সিস্টেম','সাইটের সেটিংস','Site settings',62)
on conflict (key) do update set area = excluded.area, grp = excluded.grp,
  name_bn = excluded.name_bn, name_en = excluded.name_en, sort = excluded.sort;

-- এলাকা অনুযায়ী অনুমতি। অনুমতি ফাঁকা থাকলে (পুরনো ব্যবহারকারী): অ্যাডমিন = সব, হিসাবরক্ষক = ফি ও হিসাব।
create or replace function public.has_area(a text) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (
      p.role = 'super_admin'
      or (p.role in ('admin','accountant','staff') and (
        (p.permissions = '{}'::jsonb and (
          p.role = 'admin' or (p.role = 'accountant' and a = 'finance')))
        or exists (select 1 from public.features f
                   where f.area = a and (p.permissions ->> f.key) = 'true')
      ))
    )
  );
$$;

alter table public.features enable row level security;
drop policy if exists "features_read" on public.features;
create policy "features_read" on public.features for select to authenticated using (true);
drop policy if exists "features_super" on public.features;
create policy "features_super" on public.features for all
  using (public.is_super()) with check (public.is_super());

-- ---------- সুপার অ্যাডমিনের ব্যবহারকারী তৈরি / পাসওয়ার্ড বদল ----------
-- পাসওয়ার্ড কখনো লেখা অবস্থায় সংরক্ষিত থাকে না (শুধু হ্যাশ); সুপার অ্যাডমিন যেকোনো সময় নতুন পাসওয়ার্ড বসাতে পারে।
create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_create_user(
  p_email text, p_password text, p_name text, p_role text, p_perms jsonb
) returns uuid
language plpgsql security definer set search_path = public, auth, extensions as $$
declare uid uuid := gen_random_uuid(); em text := lower(trim(p_email));
begin
  if not public.is_super() then raise exception 'শুধু সুপার অ্যাডমিন পারে'; end if;
  if em is null or em = '' then raise exception 'ইমেইল দিন'; end if;
  if length(coalesce(p_password,'')) < 6 then raise exception 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে'; end if;
  if p_role not in ('none','admin','accountant','staff') then raise exception 'ভূমিকা সঠিক নয়'; end if;
  if exists (select 1 from auth.users where lower(email) = em) then raise exception 'এই ইমেইলে আগেই অ্যাকাউন্ট আছে'; end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
    crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', coalesce(nullif(trim(p_name),''), em)), now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true),
    'email', uid::text, now(), now(), now());

  update public.profiles set role = p_role, permissions = coalesce(p_perms, '{}'::jsonb),
    full_name = coalesce(nullif(trim(p_name),''), em) where id = uid;
  return uid;
end; $$;

create or replace function public.admin_set_password(p_user uuid, p_password text) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not public.is_super() then raise exception 'শুধু সুপার অ্যাডমিন পারে'; end if;
  if length(coalesce(p_password,'')) < 6 then raise exception 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_user;
end; $$;

create or replace function public.admin_set_email(p_user uuid, p_email text) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
declare em text := lower(trim(p_email));
begin
  if not public.is_super() then raise exception 'শুধু সুপার অ্যাডমিন পারে'; end if;
  if em = '' then raise exception 'ইমেইল দিন'; end if;
  if exists (select 1 from auth.users where lower(email) = em and id <> p_user) then raise exception 'এই ইমেইল অন্য অ্যাকাউন্টে আছে'; end if;
  update auth.users set email = em, updated_at = now() where id = p_user;
  update auth.identities set identity_data = identity_data || jsonb_build_object('email', em) where user_id = p_user and provider = 'email';
  update public.profiles set email = em where id = p_user;
end; $$;

revoke all on function public.admin_create_user(text,text,text,text,jsonb) from public, anon;
revoke all on function public.admin_set_password(uuid,text) from public, anon;
revoke all on function public.admin_set_email(uuid,text) from public, anon;
grant execute on function public.admin_create_user(text,text,text,text,jsonb) to authenticated;
grant execute on function public.admin_set_password(uuid,text) to authenticated;
grant execute on function public.admin_set_email(uuid,text) to authenticated;

-- প্রথম যে ব্যবহারকারী তৈরি হবে সে নিজে থেকে super_admin হবে; পরেরা 'none' (কোনো অ্যাক্সেস নেই)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case when not exists (select 1 from public.profiles) then 'super_admin' else 'none' end);
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or public.is_super());
drop policy if exists "profiles_update_super" on public.profiles;
create policy "profiles_update_super" on public.profiles for update
  using (public.is_super()) with check (public.is_super());
drop policy if exists "profiles_delete_super" on public.profiles;
create policy "profiles_delete_super" on public.profiles for delete
  using (public.is_super() and id <> auth.uid());

-- ---------- সাইটের লেখা, সেটিংস, মডিউল সুইচ ----------
create table if not exists public.site_texts (
  key text primary key,
  bn text, ar text, en text,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.modules (
  key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

-- সিক্রেট তথ্য (মেশিন, এসএমএস, পেমেন্ট) — শুধু অ্যাডমিন দেখতে পারে
create table if not exists public.integrations (
  key text primary key,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- পাবলিক কনটেন্ট ----------
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title_bn text, title_ar text, title_en text,
  body_bn text, body_ar text, body_en text,
  date date not null default current_date,
  pinned boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title_bn text, title_ar text, title_en text,
  desc_bn text, desc_ar text, desc_en text,
  event_date date not null default current_date,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  caption_bn text, caption_ar text, caption_en text,
  image_url text not null,
  sort int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.public_teachers (
  id uuid primary key default gen_random_uuid(),
  name_bn text, name_ar text, name_en text,
  designation_bn text, designation_ar text, designation_en text,
  photo_url text,
  sort int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);


-- ---------- মাদরাসার বিভাগ (অ্যাডমিন থেকে যোগ/সম্পাদনা/মুছা যাবে) ----------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name_bn text, name_en text,
  text_bn text, text_en text,
  icon text default 'book',
  sort int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- ভর্তির আবেদন ও যোগাযোগ ----------
create table if not exists public.admission_applications (
  id uuid primary key default gen_random_uuid(),
  student_name text not null check (char_length(student_name) between 2 and 120),
  father_name text check (char_length(father_name) <= 120),
  mother_name text check (char_length(mother_name) <= 120),
  phone text not null check (char_length(phone) between 6 and 20),
  department text check (char_length(department) <= 60),
  class_name text check (char_length(class_name) <= 60),
  address text check (char_length(address) <= 400),
  note text check (char_length(note) <= 1000),
  status text not null default 'new' check (status in ('new','contacted','admitted','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  phone text check (char_length(phone) <= 20),
  message text not null check (char_length(message) between 2 and 2000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- ধাপ ১ ফাইনাল ডিজাইনের নতুন অংশ (আবার চালালেও ক্ষতি নেই) ----------

-- হোম স্লাইডের নিজস্ব ছবি (১২০০×৬০০)
create table if not exists public.hero_slides (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  title_bn text, title_en text,
  sub_bn text, sub_en text,
  link text,
  sort int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- হোমপেইজের যেকোনো নতুন রো/বিজ্ঞপ্তি (ঘোষণা বার, কার্ড, লেখা, ছবি+লেখা)
create table if not exists public.home_blocks (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'text' check (kind in ('announce','text','cards','image_text')),
  place text not null default 'after_why',
  title_bn text, title_en text,
  body_bn text, body_en text,
  btn_bn text, btn_en text,
  link text,
  image_url text,
  items jsonb not null default '[]'::jsonb,
  sort int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- ভর্তি ফরমের ঘর (অ্যাডমিন যোগ/বাদ দিতে পারেন)
create table if not exists public.admission_fields (
  id uuid primary key default gen_random_uuid(),
  field_key text not null,
  label_bn text, label_en text,
  type text not null default 'text' check (type in ('text','textarea','phone','email','date','number','select','file')),
  options_bn text, options_en text,
  required boolean not null default false,
  map_to text,
  sort int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- পুরনো টেবিলে নতুন কলাম
alter table public.admission_applications alter column student_name drop not null;
alter table public.admission_applications alter column phone drop not null;
alter table public.admission_applications add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.gallery alter column image_url drop not null;
alter table public.gallery add column if not exists kind text not null default 'image';
alter table public.gallery add column if not exists video_url text;
alter table public.events add column if not exists start_at timestamptz;
alter table public.events add column if not exists end_at timestamptz;
alter table public.events add column if not exists show_start_timer boolean not null default false;
alter table public.events add column if not exists show_end_timer boolean not null default false;
alter table public.public_teachers add column if not exists facebook text;
alter table public.public_teachers add column if not exists whatsapp text;
alter table public.public_teachers add column if not exists phone text;
alter table public.public_teachers add column if not exists call_msg_bn text;
alter table public.public_teachers add column if not exists call_msg_en text;

-- ---------- RLS ----------
do $$
declare t text;
begin
  -- সবাই পড়তে পারবে, শুধু অ্যাডমিন বদলাতে পারবে
  foreach t in array array['site_texts','site_settings','modules'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_read" on public.%1$I', t);
    execute format('create policy "%1$s_read" on public.%1$I for select using (true)', t);
    execute format('drop policy if exists "%1$s_admin" on public.%1$I', t);
    execute format('create policy "%1$s_admin" on public.%1$I for all using (public.has_area(case when ''%1$s'' = ''site_texts'' then ''cms'' else ''system'' end)) with check (public.has_area(case when ''%1$s'' = ''site_texts'' then ''cms'' else ''system'' end))', t);
  end loop;

  -- প্রকাশিত হলে সবাই দেখবে, অ্যাডমিন সব দেখবে ও বদলাবে
  foreach t in array array['notices','events','gallery','public_teachers','hero_slides','home_blocks','admission_fields','departments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_read" on public.%1$I', t);
    execute format('create policy "%1$s_read" on public.%1$I for select using (published or public.has_area(''cms''))', t);
    execute format('drop policy if exists "%1$s_admin" on public.%1$I', t);
    execute format('create policy "%1$s_admin" on public.%1$I for all using (public.has_area(''cms'')) with check (public.has_area(''cms''))', t);
  end loop;
end $$;

alter table public.integrations enable row level security;
drop policy if exists "integrations_admin" on public.integrations;
create policy "integrations_admin" on public.integrations for all
  using (public.has_area('system')) with check (public.has_area('system'));

alter table public.admission_applications enable row level security;
drop policy if exists "applications_insert" on public.admission_applications;
create policy "applications_insert" on public.admission_applications for insert
  to anon, authenticated with check (status = 'new');
drop policy if exists "applications_admin" on public.admission_applications;
create policy "applications_admin" on public.admission_applications for all
  using (public.has_area('inbox')) with check (public.has_area('inbox'));

alter table public.contact_messages enable row level security;
drop policy if exists "messages_insert" on public.contact_messages;
create policy "messages_insert" on public.contact_messages for insert
  to anon, authenticated with check (is_read = false);
drop policy if exists "messages_admin" on public.contact_messages;
create policy "messages_admin" on public.contact_messages for all
  using (public.has_area('inbox')) with check (public.has_area('inbox'));

-- ---------- ছবি রাখার বাকেট ----------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media_read" on storage.objects;
create policy "media_read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media_admin_write" on storage.objects;
create policy "media_admin_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.has_area('cms'));
drop policy if exists "media_admin_update" on storage.objects;
create policy "media_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.has_area('cms'));
drop policy if exists "media_admin_delete" on storage.objects;
create policy "media_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.has_area('cms'));

-- ---------- ভর্তির কাগজপত্র (ছবি, জন্ম সনদ) রাখার ব্যক্তিগত বাকেট: সর্বোচ্চ ৫ MB, শুধু ছবি ও PDF; শুধু অ্যাডমিন দেখতে পারেন ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('applications', 'applications', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists "applications_upload" on storage.objects;
create policy "applications_upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'applications');
drop policy if exists "applications_admin_read" on storage.objects;
create policy "applications_admin_read" on storage.objects for select to authenticated
  using (bucket_id = 'applications' and public.has_area('inbox'));
drop policy if exists "applications_admin_delete" on storage.objects;
create policy "applications_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'applications' and public.has_area('inbox'));

-- ---------- শুরুর তিনটি বিভাগ (শুধু টেবিল ফাঁকা থাকলে একবার বসবে) ----------
insert into public.departments (name_bn, name_en, text_bn, text_en, icon, sort)
select * from (values
 ('হিফজ বিভাগ','Hifz department','সবক, সাত সবক ও আমুখতা নিয়মিত তত্ত্বাবধানে পূর্ণ কুরআন হিফজ।','Complete Quran memorisation with regular supervision of sabaq, sabaqi and manzil.','book',1),
 ('কওমি বিভাগ','Qawmi department','আরবি, ফিকহ, হাদিস ও তাফসিরসহ কওমি ধারার পূর্ণাঙ্গ পাঠ্যক্রম।','The full Qawmi curriculum including Arabic, Fiqh, Hadith and Tafsir.','books',2),
 ('মহিলা মাদরাসা','Mohila Madrasa','পর্দার পরিবেশে ছাত্রীদের জন্য কুরআন ও দ্বীনি শিক্ষার আলাদা শাখা।','A separate section for Quran and religious education for girls in a modest environment.','lotus',3)
) as v(name_bn,name_en,text_bn,text_en,icon,sort)
where not exists (select 1 from public.departments);

-- =====================================================================
-- ধাপ ২: ছাত্র, শ্রেণি, শিক্ষক-কর্মচারী, হাজিরা, মেশিন (আবার চালালেও ক্ষতি নেই)
-- এই সব তথ্য শুধু অ্যাডমিন দেখতে ও বদলাতে পারবে
-- =====================================================================

-- তালিকার ধরন (আবাসিক/অনাবাসিক, হাজিরার সময়/ওয়াক্ত ইত্যাদি) — অ্যাডমিন বদলাতে পারবে
create table if not exists public.lookups (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                 -- 'residence' | 'session'
  code text,
  name_bn text, name_en text,
  sort int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create sequence if not exists public.student_seq;
create sequence if not exists public.staff_seq;

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  staff_no text,
  name_bn text, name_en text,
  photo_url text,
  kind text not null default 'teacher',   -- teacher | staff
  designation_bn text, designation_en text,
  phone text, address text, nid text,
  join_date date,
  device_user_id text,                    -- হাজিরা মেশিনে এই মানুষের আইডি
  status text not null default 'active',  -- active | inactive | left
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name_bn text, name_en text,
  department_id uuid references public.departments(id) on delete set null,
  teacher_id uuid references public.staff(id) on delete set null,
  sort int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_no text,
  name_bn text, name_en text,
  photo_url text,
  gender text,                            -- male | female
  dob date,
  father_name text, mother_name text,
  guardian_phone text, phone2 text,
  address text,
  department_id uuid references public.departments(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  residence text,                         -- lookups(kind='residence') এর নাম
  admission_date date default current_date,
  device_user_id text,                    -- হাজিরা মেশিনে এই ছাত্রের আইডি
  application_id uuid,
  status text not null default 'active',  -- active | inactive | left | graduated
  note text,
  created_at timestamptz not null default now()
);
create index if not exists students_class_idx on public.students(class_id);
create index if not exists students_dept_idx on public.students(department_id);

create or replace function public.set_person_no() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'students' and coalesce(new.student_no, '') = '' then
    new.student_no := to_char(coalesce(new.admission_date, current_date), 'YY') || lpad(nextval('public.student_seq')::text, 4, '0');
  elsif tg_table_name = 'staff' and coalesce(new.staff_no, '') = '' then
    new.staff_no := 'T' || lpad(nextval('public.staff_seq')::text, 3, '0');
  end if;
  return new;
end $$;
drop trigger if exists students_no on public.students;
create trigger students_no before insert on public.students for each row execute function public.set_person_no();
drop trigger if exists staff_no on public.staff;
create trigger staff_no before insert on public.staff for each row execute function public.set_person_no();

-- হাজিরা: একজন মানুষ, একদিন, একটি সময় = একটি সারি
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  person_type text not null check (person_type in ('student','staff')),
  person_id uuid not null,
  date date not null,
  session text not null default 'day',
  status text not null default 'present' check (status in ('present','absent','late','leave')),
  in_time timestamptz,
  out_time timestamptz,
  source text not null default 'manual',  -- manual | device
  note text,
  created_at timestamptz not null default now(),
  unique (person_type, person_id, date, session)
);
create index if not exists attendance_date_idx on public.attendance(date);

-- মেশিনের কাঁচা পাঞ্চ লগ
create table if not exists public.device_punches (
  id uuid primary key default gen_random_uuid(),
  serial_no text,
  device_user_id text,
  punched_at timestamptz not null,
  matched_type text,
  matched_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists punches_time_idx on public.device_punches(punched_at desc);

-- সবকিছু শুধু অ্যাডমিনের জন্য
do $$
declare t text;
begin
  foreach t in array array['lookups','staff','classes','students','attendance','device_punches'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_admin" on public.%1$I', t);
    execute format('create policy "%1$s_admin" on public.%1$I for all using (public.has_area(''people'')) with check (public.has_area(''people''))', t);
  end loop;
end $$;

-- ZKTeco: মেশিন/ব্রিজ প্রোগ্রাম এই ফাংশন ডেকে পাঞ্চ পাঠালে হাজিরা নিজে থেকে বসে যায়।
-- শর্ত: অ্যাডমিন > "মেশিন ও বাইরের সেবা" এ ZKTeco "চালু" এবং "পুশ সার্ভার কী" দেওয়া থাকতে হবে।
create or replace function public.ingest_device_punch(p_key text, p_serial text, p_user text, p_time timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare cfg jsonb; en boolean; pid uuid; ptype text; d date;
begin
  select enabled, config into en, cfg from public.integrations where key = 'zkteco';
  if en is not true or coalesce(cfg->>'push_key', '') = '' or cfg->>'push_key' <> p_key then
    return 'denied';
  end if;
  d := (p_time at time zone 'Asia/Dhaka')::date;
  select id into pid from public.students where device_user_id = p_user and status = 'active' limit 1;
  if pid is not null then ptype := 'student'; else
    select id into pid from public.staff where device_user_id = p_user and status = 'active' limit 1;
    if pid is not null then ptype := 'staff'; end if;
  end if;
  insert into public.device_punches (serial_no, device_user_id, punched_at, matched_type, matched_id)
  values (p_serial, p_user, p_time, ptype, pid);
  if pid is null then return 'unmatched'; end if;
  insert into public.attendance (person_type, person_id, date, session, status, in_time, source)
  values (ptype, pid, d, 'day', 'present', p_time, 'device')
  on conflict (person_type, person_id, date, session) do update set
    status = case when public.attendance.status = 'leave' then 'leave' else 'present' end,
    in_time = least(coalesce(public.attendance.in_time, excluded.in_time), excluded.in_time),
    out_time = case when excluded.in_time > coalesce(public.attendance.in_time, excluded.in_time) + interval '10 minutes'
                    then greatest(coalesce(public.attendance.out_time, excluded.in_time), excluded.in_time)
                    else public.attendance.out_time end,
    source = 'device';
  return 'ok';
end $$;
revoke all on function public.ingest_device_punch(text, text, text, timestamptz) from public;
grant execute on function public.ingest_device_punch(text, text, text, timestamptz) to anon, authenticated;

-- শুরুর তালিকা (শুধু ফাঁকা থাকলে একবার)
insert into public.lookups (kind, code, name_bn, name_en, sort)
select * from (values
  ('residence', null, 'আবাসিক', 'Resident', 1),
  ('residence', null, 'অনাবাসিক', 'Non-resident', 2),
  ('residence', null, 'ডে-কেয়ার', 'Day care', 3)
) v(kind, code, name_bn, name_en, sort)
where not exists (select 1 from public.lookups where kind = 'residence');

insert into public.lookups (kind, code, name_bn, name_en, sort)
select 'session', 'day', 'দৈনিক', 'Daily', 1
where not exists (select 1 from public.lookups where kind = 'session');

-- =====================================================================
-- ধাপ ৩: ফি, আদায়, রসিদ, দান, আয়-ব্যয়, বেতন, রিপোর্ট, লগ (আবার চালালেও ক্ষতি নেই)
-- আর্থিক তথ্য শুধু সুপার অ্যাডমিন, অ্যাডমিন ও হিসাবরক্ষক দেখতে/লিখতে পারবে
-- আদায়, আয়-ব্যয় ও বেতনের এন্ট্রি মোছা যায় না; ভুল হলে "বাতিল" করা যায় (কারণসহ, লগে থাকে)
-- =====================================================================

create or replace function public.is_finance() returns boolean
language sql security definer set search_path = public stable as $$
  select public.has_area('finance');
$$;

alter table public.students add column if not exists blood_group text;
alter table public.staff add column if not exists salary numeric not null default 0;
alter table public.lookups add column if not exists opening numeric not null default 0;

-- ফি-র ধরন (মাসিক বেতন, খাবার, ভর্তি ফি ইত্যাদি)
create table if not exists public.fee_heads (
  id uuid primary key default gen_random_uuid(),
  name_bn text, name_en text,
  kind text not null default 'monthly',      -- monthly | one_time
  default_amount numeric not null default 0,
  sort int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- পরিমাণ: শ্রেণি / বিভাগ / আবাসিক ধরন অনুযায়ী (যেটা বেশি নির্দিষ্ট সেটাই প্রযোজ্য)
create table if not exists public.fee_rates (
  id uuid primary key default gen_random_uuid(),
  head_id uuid not null references public.fee_heads(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  department_id uuid references public.departments(id) on delete cascade,
  residence text,
  amount numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ছাত্রভিত্তিক আলাদা পরিমাণ / ছাড় / অব্যাহতি
create table if not exists public.student_fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  head_id uuid not null references public.fee_heads(id) on delete cascade,
  amount numeric,                            -- ফাঁকা হলে সাধারণ পরিমাণ
  discount numeric not null default 0,
  exempt boolean not null default false,     -- এই ফি প্রযোজ্য নয়
  note text,
  created_at timestamptz not null default now(),
  unique (student_id, head_id)
);

-- বিল
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  head_id uuid references public.fee_heads(id) on delete set null,
  period text not null default '',           -- 2026-01 অথবা এককালীন লেবেল
  title text,
  amount numeric not null default 0,
  paid numeric not null default 0,
  cancelled boolean not null default false,
  cancel_reason text,
  created_at timestamptz not null default now(),
  unique (student_id, head_id, period)
);
create index if not exists invoices_student_idx on public.invoices(student_id);
create index if not exists invoices_period_idx on public.invoices(period);

create sequence if not exists public.receipt_seq;

-- আদায় (রসিদ)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  receipt_no text,
  student_id uuid references public.students(id) on delete restrict,
  payer text,
  method text not null default 'cash',
  amount numeric not null check (amount > 0),
  txn_ref text,
  paid_at date not null default current_date,
  note text,
  void boolean not null default false,
  void_reason text,
  voided_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists payments_date_idx on public.payments(paid_at);
create index if not exists payments_student_idx on public.payments(student_id);

create table if not exists public.payment_items (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount numeric not null check (amount > 0)
);
create index if not exists pitems_inv_idx on public.payment_items(invoice_id);

-- আয়-ব্যয়ের খাত
create table if not exists public.ledger_categories (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('income','expense')),
  name_bn text, name_en text,
  sort int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- দান/চাঁদা (আয়) ও খরচ (ব্যয়)
create table if not exists public.ledger (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('income','expense')),
  category_id uuid references public.ledger_categories(id) on delete set null,
  category_name text,
  amount numeric not null check (amount > 0),
  method text not null default 'cash',
  date date not null default current_date,
  party text,                                -- দাতা / যাকে দেওয়া হয়েছে
  phone text,
  receipt_no text,
  voucher_url text,
  note text,
  void boolean not null default false,
  void_reason text,
  voided_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists ledger_date_idx on public.ledger(date);

-- শিক্ষক-কর্মচারীর অগ্রিম
create table if not exists public.staff_advances (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete restrict,
  amount numeric not null check (amount > 0),
  method text not null default 'cash',
  date date not null default current_date,
  note text,
  void boolean not null default false,
  void_reason text,
  voided_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- মাসিক বেতন প্রদান
create table if not exists public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete restrict,
  period text not null,                      -- 2026-01
  base numeric not null default 0,
  deduction numeric not null default 0,      -- অনুপস্থিতি/অন্য কর্তন
  advance_deduct numeric not null default 0, -- অগ্রিম কাটা
  bonus numeric not null default 0,
  net numeric not null default 0,
  method text not null default 'cash',
  paid_at date not null default current_date,
  note text,
  void boolean not null default false,
  void_reason text,
  voided_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists salary_once on public.salary_payments(staff_id, period) where not void;

-- আর্থিক লগ: কে, কখন, কী করল
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text, action text, row_id uuid,
  who uuid default auth.uid(),
  data jsonb,
  created_at timestamptz not null default now()
);

-- রসিদ নম্বর নিজে নিজে (আদায়: R-, দান/আয়: D-)
create or replace function public.set_receipt_no() returns trigger language plpgsql as $$
begin
  if coalesce(new.receipt_no, '') = '' then
    new.receipt_no := 'R-' || to_char(current_date, 'YY') || lpad(nextval('public.receipt_seq')::text, 5, '0');
  end if;
  return new;
end $$;
create or replace function public.set_ledger_receipt_no() returns trigger language plpgsql as $$
begin
  if new.kind = 'income' and coalesce(new.receipt_no, '') = '' then
    new.receipt_no := 'D-' || to_char(current_date, 'YY') || lpad(nextval('public.receipt_seq')::text, 5, '0');
  end if;
  return new;
end $$;
drop trigger if exists payments_receipt on public.payments;
create trigger payments_receipt before insert on public.payments for each row execute function public.set_receipt_no();
drop trigger if exists ledger_receipt on public.ledger;
create trigger ledger_receipt before insert on public.ledger for each row execute function public.set_ledger_receipt_no();

-- আর্থিক এন্ট্রির শুধু "বাতিল" ঘরগুলো বদলানো যায়, টাকার অঙ্ক বা অন্য কিছু নয়
create or replace function public.lock_financial() returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) - 'void' - 'void_reason' - 'voided_at') <> (to_jsonb(old) - 'void' - 'void_reason' - 'voided_at') then
    raise exception 'আর্থিক এন্ট্রি বদলানো যাবে না। ভুল হলে বাতিল করে নতুন এন্ট্রি দিন।';
  end if;
  if old.void and not new.void then
    raise exception 'বাতিল এন্ট্রি ফিরিয়ে আনা যাবে না।';
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['payments','ledger','staff_advances','salary_payments'] loop
    execute format('drop trigger if exists %1$s_lock on public.%1$I', t);
    execute format('create trigger %1$s_lock before update on public.%1$I for each row execute function public.lock_financial()', t);
  end loop;
end $$;

-- বিলের জমা (paid) নিজে নিজে হিসাব হয়
create or replace function public.recalc_invoice(p_inv uuid) returns void language sql security definer set search_path = public as $$
  update public.invoices i set paid = coalesce((
    select sum(pi.amount) from public.payment_items pi join public.payments p on p.id = pi.payment_id
    where pi.invoice_id = i.id and not p.void), 0)
  where i.id = p_inv;
$$;
create or replace function public.pitems_changed() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalc_invoice(coalesce(new.invoice_id, old.invoice_id));
  return null;
end $$;
drop trigger if exists pitems_recalc on public.payment_items;
create trigger pitems_recalc after insert on public.payment_items for each row execute function public.pitems_changed();
create or replace function public.payment_voided() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.void and not old.void then
    for r in select invoice_id from public.payment_items where payment_id = new.id loop
      perform public.recalc_invoice(r.invoice_id);
    end loop;
  end if;
  return null;
end $$;
drop trigger if exists payments_void_recalc on public.payments;
create trigger payments_void_recalc after update on public.payments for each row execute function public.payment_voided();

-- লগ
create or replace function public.audit_fn() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (table_name, action, row_id, data)
  values (tg_table_name, tg_op, new.id, to_jsonb(new));
  return null;
end $$;
do $$
declare t text;
begin
  foreach t in array array['payments','ledger','staff_advances','salary_payments','invoices'] loop
    execute format('drop trigger if exists %1$s_audit on public.%1$I', t);
    execute format('create trigger %1$s_audit after insert or update on public.%1$I for each row execute function public.audit_fn()', t);
  end loop;
end $$;

-- নিরাপত্তা (RLS)
do $$
declare t text;
begin
  -- বদলানো ও মোছা যায় এমন টেবিল
  foreach t in array array['fee_heads','fee_rates','student_fees','ledger_categories'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_fin" on public.%1$I', t);
    execute format('create policy "%1$s_fin" on public.%1$I for all using (public.is_finance()) with check (public.is_finance())', t);
  end loop;
  -- মোছা যায় না এমন টেবিল (শুধু দেখা, যোগ, বদলানো)
  foreach t in array array['invoices','payments','payment_items','ledger','staff_advances','salary_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_fin" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_sel" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_ins" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_upd" on public.%1$I', t);
    execute format('create policy "%1$s_sel" on public.%1$I for select using (public.is_finance())', t);
    execute format('create policy "%1$s_ins" on public.%1$I for insert with check (public.is_finance())', t);
    execute format('create policy "%1$s_upd" on public.%1$I for update using (public.is_finance()) with check (public.is_finance())', t);
  end loop;
  alter table public.audit_log enable row level security;
  drop policy if exists "audit_sel" on public.audit_log;
  create policy "audit_sel" on public.audit_log for select using (public.is_finance());
  -- হিসাবরক্ষক ছাত্র, শিক্ষক-কর্মচারী, শ্রেণি, হাজিরা ও তালিকা দেখতে পারবে (বদলাতে নয়)
  foreach t in array array['students','staff','classes','lookups','attendance'] loop
    execute format('drop policy if exists "%1$s_fin_read" on public.%1$I', t);
    execute format('create policy "%1$s_fin_read" on public.%1$I for select using (public.is_finance())', t);
  end loop;
end $$;

-- আয়ের খাত শুরুর তালিকা
insert into public.ledger_categories (kind, name_bn, name_en, sort)
select * from (values
  ('income','দান / সদকা','Donation / Sadaqah',1), ('income','যাকাত','Zakat',2), ('income','মাসিক চাঁদা','Monthly subscription',3),
  ('income','ফিতরা','Fitrah',4), ('income','কোরবানির চামড়া','Qurbani hides',5), ('income','অন্যান্য আয়','Other income',9),
  ('expense','খাবার / বাজার','Food / groceries',1), ('expense','ভাড়া','Rent',2), ('expense','বিদ্যুৎ-পানি-গ্যাস','Utilities',3),
  ('expense','মেরামত','Repairs',4), ('expense','শিক্ষা উপকরণ','Teaching materials',5), ('expense','যাতায়াত','Transport',6), ('expense','অন্যান্য ব্যয়','Other expenses',9)
) v(kind, name_bn, name_en, sort)
where not exists (select 1 from public.ledger_categories);

-- ফি-র ধরন শুরুর তালিকা
insert into public.fee_heads (name_bn, name_en, kind, default_amount, sort)
select * from (values
  ('মাসিক বেতন','Monthly tuition','monthly',0,1), ('খাবার ও থাকা (আবাসিক)','Boarding & meals','monthly',0,2),
  ('ভর্তি ফি','Admission fee','one_time',0,3), ('পরীক্ষা ফি','Exam fee','one_time',0,4)
) v(name_bn, name_en, kind, default_amount, sort)
where not exists (select 1 from public.fee_heads);

-- পেমেন্ট মাধ্যম শুরুর তালিকা (শুরুর জমা সহ; অ্যাডমিন বদলাতে পারবে)
insert into public.lookups (kind, code, name_bn, name_en, sort)
select * from (values
  ('method','cash','হাতে নগদ','Cash in hand',1), ('method','bkash','বিকাশ','bKash',2),
  ('method','nagad','নগদ (Nagad)','Nagad',3), ('method','bank','ব্যাংক','Bank',4)
) v(kind, code, name_bn, name_en, sort)
where not exists (select 1 from public.lookups where kind = 'method');

-- নতুন টেবিল/কলাম সঙ্গে সঙ্গে চালু করতে (স্কিমা ক্যাশ রিফ্রেশ)

-- =====================================================================
-- ধাপ ৪: পরীক্ষা ও ফলাফল, হিফজ ট্র্যাকিং, আইডি কার্ড (আবার চালালেও ক্ষতি নেই)
-- =====================================================================
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  name_bn text, name_en text,
  year text,
  date_from date, date_to date,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_subjects (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  name_bn text, name_en text,
  full_marks numeric not null default 100,
  pass_marks numeric not null default 33,
  sort int not null default 0
);
create index if not exists exam_subjects_idx on public.exam_subjects(exam_id, class_id);

create table if not exists public.exam_marks (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject_id uuid not null references public.exam_subjects(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  marks numeric,
  absent boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (subject_id, student_id)
);
create index if not exists exam_marks_exam_idx on public.exam_marks(exam_id);

-- হিফজ: kind = sabaq (সবক) | sabaqi (সাত সবক) | manzil (আমুখতা/শবিনা)
create table if not exists public.hifz_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  log_date date not null default current_date,
  kind text not null check (kind in ('sabaq','sabaqi','manzil')),
  para int check (para between 1 and 30),
  detail text,
  pages numeric not null default 0,
  quality text check (quality in ('excellent','good','average','weak')),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists hifz_student_idx on public.hifz_logs(student_id, log_date desc);

do $$
declare t text;
begin
  foreach t in array array['exams','exam_subjects','exam_marks','hifz_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_admin" on public.%1$I', t);
    execute format('create policy "%1$s_admin" on public.%1$I for all using (public.has_area(''people'')) with check (public.has_area(''people''))', t);
  end loop;
end $$;

insert into public.features (key, area, grp, name_bn, name_en, sort) values
  ('exams','people','পরীক্ষা ও হিফজ','পরীক্ষা ও ফলাফল','Exams & results',25),
  ('hifz','people','পরীক্ষা ও হিফজ','হিফজ ট্র্যাকিং','Hifz tracking',26),
  ('idcards','people','পরীক্ষা ও হিফজ','আইডি কার্ড','ID cards',27)
on conflict (key) do update set area = excluded.area, grp = excluded.grp, name_bn = excluded.name_bn, name_en = excluded.name_en, sort = excluded.sort;

notify pgrst, 'reload schema';
