-- WorkMore database schema.
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste all of this -> Run.
-- Safe to run again; it only creates what is missing and replaces the policies.
--
-- Every table has Row Level Security on: a signed-in user can only read and change
-- their own rows, and signed-out visitors (the public key alone) can read nothing.

-- ---------- profiles: one row per account, filled in automatically on sign-up ----------

create table if not exists public.profiles (
    id           uuid primary key references auth.users (id) on delete cascade,
    display_name text,
    avatar_url   text,
    created_at   timestamptz not null default now()
);

-- ---------- types: a name and a color, e.g. "Intervals" in green ----------

create table if not exists public.types (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
    name       text not null check (char_length(name) between 1 and 40),
    color      text not null check (color ~ '^#[0-9a-f]{6}$'),
    created_at timestamptz not null default now(),
    -- lets modules/activities reference a type together with its owner (see below)
    unique (id, user_id)
);

-- Names are unique per user, ignoring case, matching the check in the Types view.
create unique index if not exists types_user_name_idx on public.types (user_id, lower(name));

-- ---------- modules: reusable activities placed on chosen weekdays ----------

create table if not exists public.modules (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
    title       text not null check (char_length(title) >= 1),
    type_id     uuid,
    description text not null default '',
    days        smallint[] not null
                check (cardinality(days) between 1 and 7 and days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
    start_time  time,
    end_time    time,
    repeat      boolean not null default false,
    week_start  date,
    created_at  timestamptz not null default now(),
    unique (id, user_id),
    check (end_time is null or start_time is null or end_time > start_time),
    check (repeat or week_start is not null),
    -- A type can only be one of the same user's types. Deleting the type clears
    -- type_id and keeps the module (the same cleanup the app did by hand).
    foreign key (type_id, user_id) references public.types (id, user_id) on delete set null (type_id)
);

create index if not exists modules_user_idx on public.modules (user_id);

-- ---------- activities: one-off entries and module placements on a date ----------

create table if not exists public.activities (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
    title       text not null check (char_length(title) >= 1),
    date        date not null,
    start_time  time,
    end_time    time,
    description text not null default '',
    type_id     uuid,
    module_id   uuid,
    created_at  timestamptz not null default now(),
    check (end_time is null or start_time is null or end_time > start_time),
    foreign key (type_id, user_id) references public.types (id, user_id) on delete set null (type_id),
    -- Deleting a module unlinks its activities rather than deleting them.
    foreign key (module_id, user_id) references public.modules (id, user_id) on delete set null (module_id)
);

create index if not exists activities_user_date_idx on public.activities (user_id, date);

-- ---------- Row Level Security ----------

alter table public.profiles   enable row level security;
alter table public.types      enable row level security;
alter table public.modules    enable row level security;
alter table public.activities enable row level security;

drop policy if exists "Own profile: read"   on public.profiles;
drop policy if exists "Own profile: insert" on public.profiles;
drop policy if exists "Own profile: update" on public.profiles;
create policy "Own profile: read" on public.profiles
    for select to authenticated using (id = (select auth.uid()));
-- Normally the sign-up trigger below creates the row; this covers accounts that
-- somehow have none, so saving a profile picture can create it.
create policy "Own profile: insert" on public.profiles
    for insert to authenticated with check (id = (select auth.uid()));
create policy "Own profile: update" on public.profiles
    for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "Own types" on public.types;
create policy "Own types" on public.types
    for all to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Own modules" on public.modules;
create policy "Own modules" on public.modules
    for all to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Own activities" on public.activities;
create policy "Own activities" on public.activities
    for all to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- create the profile row whenever someone signs up ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
    insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- ---------- profile pictures (Supabase Storage) ----------
-- Each account keeps its picture at avatars/<user id>/avatar.jpg. The bucket is
-- public-read, so a picture shows for anyone holding its URL (which contains the
-- account's random id); only the owner can add, replace or remove files in their
-- own folder. The app shrinks pictures to 256px JPEGs, well under the 2 MB limit.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatars: read own"   on storage.objects;
drop policy if exists "Avatars: upload own" on storage.objects;
drop policy if exists "Avatars: update own" on storage.objects;
drop policy if exists "Avatars: delete own" on storage.objects;

-- Replacing a picture (upsert) needs read, insert and update on one's own files.
create policy "Avatars: read own" on storage.objects
    for select to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Avatars: upload own" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Avatars: update own" on storage.objects
    for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Avatars: delete own" on storage.objects
    for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
