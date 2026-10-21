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
    check (role in ('none','super_admin','admin','accountant','teacher','parent')),
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
  using (id = auth.uid() or public.is_admin());
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
    execute format('create policy "%1$s_admin" on public.%1$I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;

  -- প্রকাশিত হলে সবাই দেখবে, অ্যাডমিন সব দেখবে ও বদলাবে
  foreach t in array array['notices','events','gallery','public_teachers'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_read" on public.%1$I', t);
    execute format('create policy "%1$s_read" on public.%1$I for select using (published or public.is_admin())', t);
    execute format('drop policy if exists "%1$s_admin" on public.%1$I', t);
    execute format('create policy "%1$s_admin" on public.%1$I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

alter table public.integrations enable row level security;
drop policy if exists "integrations_admin" on public.integrations;
create policy "integrations_admin" on public.integrations for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.admission_applications enable row level security;
drop policy if exists "applications_insert" on public.admission_applications;
create policy "applications_insert" on public.admission_applications for insert
  to anon, authenticated with check (status = 'new');
drop policy if exists "applications_admin" on public.admission_applications;
create policy "applications_admin" on public.admission_applications for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.contact_messages enable row level security;
drop policy if exists "messages_insert" on public.contact_messages;
create policy "messages_insert" on public.contact_messages for insert
  to anon, authenticated with check (is_read = false);
drop policy if exists "messages_admin" on public.contact_messages;
create policy "messages_admin" on public.contact_messages for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- ছবি রাখার বাকেট ----------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media_read" on storage.objects;
create policy "media_read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media_admin_write" on storage.objects;
create policy "media_admin_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());
drop policy if exists "media_admin_update" on storage.objects;
create policy "media_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin());
drop policy if exists "media_admin_delete" on storage.objects;
create policy "media_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());
