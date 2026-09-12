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

-- ---------- public booking links ----------
-- Each account has a random booking code; its link is <app address>/#/book/<code>.
-- Someone following the link is not signed in, so Row Level Security lets them read
-- nothing. Instead they get the three narrow functions below (booking_page,
-- booking_busy, book_meeting). These run with the database's own rights, check
-- everything themselves, and expose only a name, a picture, busy times, and a way
-- to book. Never an email address, a title or a description.

alter table public.profiles add column if not exists time_zone text;
alter table public.profiles add column if not exists booking_code text;
alter table public.profiles
    alter column booking_code set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
update public.profiles set booking_code = default where booking_code is null;
alter table public.profiles alter column booking_code set not null;
alter table public.profiles drop constraint if exists profiles_booking_code_format;
alter table public.profiles add constraint profiles_booking_code_format check (booking_code ~ '^[a-z0-9]{8,32}$');
create unique index if not exists profiles_booking_code_idx on public.profiles (booking_code);

-- Who booked, for the per-email limit. Only filled in for bookings made by link.
alter table public.activities add column if not exists booked_by_email text;
create index if not exists activities_booked_by_idx
    on public.activities (user_id, booked_by_email, created_at) where booked_by_email is not null;

-- The booking rules, in one place. The booking page shows these and book_meeting
-- enforces them, so the two cannot disagree. Change the numbers here.
create or replace function public.booking_rules()
returns jsonb
language sql
immutable
set search_path = ''
as $$
    select jsonb_build_object(
        'durations',         jsonb_build_array(15, 30, 45, 60), -- meeting lengths, minutes
        'day_start',         540,                               -- 09:00, minutes past midnight
        'day_end',           1020,                              -- 17:00, the latest a meeting may end
        'workdays',          jsonb_build_array(0, 1, 2, 3, 4),  -- Monday to Friday (0 = Monday)
        'booking_days',      14,                                -- how far ahead, counting today
        'per_email_per_day', 10                                 -- bookings one email may make in 24 hours
    );
$$;

-- The account behind a code, and its time zone (UTC if unset or unknown).
-- Internal only: it returns the account id, so visitors cannot call it directly.
create or replace function public.booking_host(p_code text, out host_id uuid, out tz text)
language sql
stable
security definer
set search_path = ''
as $$
    select p.id,
           case when exists (select 1 from pg_catalog.pg_timezone_names n where n.name = p.time_zone)
                then p.time_zone else 'UTC' end
    from public.profiles p
    where p.booking_code = lower(trim(p_code));
$$;

-- What the booking page needs: the rules, plus the host's name, picture and time zone.
-- Returns null for a code that does not exist (or was replaced).
create or replace function public.booking_page(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    h record;
begin
    select * into h from public.booking_host(p_code);
    if h.host_id is null then
        return null;
    end if;
    return public.booking_rules() || (
        select jsonb_build_object(
            'name',       nullif(trim(p.display_name), ''),
            'avatar_url', p.avatar_url,
            'time_zone',  h.tz
        )
        from public.profiles p
        where p.id = h.host_id
    );
end;
$$;

-- When the host is busy on the bookable days between p_from and p_to: timed
-- activities plus the days their modules fall on. Times only, nothing else.
create or replace function public.booking_busy(p_code text, p_from date, p_to date)
returns table (day date, start_min int, end_min int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    h record;
    v_today date;
begin
    select * into h from public.booking_host(p_code);
    if h.host_id is null then
        return;
    end if;

    -- Only the bookable window, however wide a range is asked for.
    v_today := (now() at time zone h.tz)::date;
    p_from := greatest(p_from, v_today);
    p_to := least(p_to, v_today + (public.booking_rules() ->> 'booking_days')::int - 1);
    if p_from is null or p_to is null or p_from > p_to then
        return;
    end if;

    return query
        select a.date,
               (extract(hour from a.start_time) * 60 + extract(minute from a.start_time))::int,
               coalesce((extract(hour from a.end_time) * 60 + extract(minute from a.end_time))::int,
                        (extract(hour from a.start_time) * 60 + extract(minute from a.start_time))::int + 60)
        from public.activities a
        where a.user_id = h.host_id
          and a.start_time is not null
          and a.date between p_from and p_to
        union all
        select d::date,
               (extract(hour from m.start_time) * 60 + extract(minute from m.start_time))::int,
               coalesce((extract(hour from m.end_time) * 60 + extract(minute from m.end_time))::int,
                        (extract(hour from m.start_time) * 60 + extract(minute from m.start_time))::int + 60)
        from public.modules m
        cross join generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as d
        where m.user_id = h.host_id
          and m.start_time is not null
          and (extract(isodow from d)::int - 1) = any (m.days)
          and (m.repeat or m.week_start = date_trunc('week', d)::date);
end;
$$;

-- Books a meeting after checking everything again: a real code, a valid name and
-- email, an allowed length, a start on the time grid within working hours and the
-- bookable days, not in the past, still free, and under the per-email limit. Then it
-- puts "Meeting with <name>" in the host's calendar, typed "Meeting" (created in
-- orange if the host has no type of that name). Errors carry a readable message.
create or replace function public.book_meeting(
    p_code text,
    p_name text,
    p_email text,
    p_about text,
    p_date date,
    p_start text,
    p_duration int
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    rules   jsonb := public.booking_rules();
    h       record;
    v_local timestamp;
    v_today date;
    v_now   int;
    v_start int;
    v_end   int;
    v_name  text := left(trim(coalesce(p_name, '')), 80);
    v_email text := lower(trim(coalesce(p_email, '')));
    v_about text := left(trim(coalesce(p_about, '')), 1000);
    v_type  uuid;
begin
    select * into h from public.booking_host(p_code);
    if h.host_id is null then
        raise exception 'This booking link does not work.';
    end if;

    -- One booking at a time per calendar, so two visitors cannot take the same slot.
    perform pg_advisory_xact_lock(hashtext(h.host_id::text));

    if v_name = '' then
        raise exception 'Enter your name.';
    end if;
    if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        raise exception 'Enter a valid email address.';
    end if;
    if p_duration is null or not (rules -> 'durations') @> to_jsonb(p_duration) then
        raise exception 'Choose how long the meeting should be.';
    end if;
    if p_start is null or p_start !~ '^[0-9]{2}:[0-9]{2}$' then
        raise exception 'Choose a time.';
    end if;

    v_start := split_part(p_start, ':', 1)::int * 60 + split_part(p_start, ':', 2)::int;
    v_end := v_start + p_duration;
    v_local := now() at time zone h.tz;
    v_today := v_local::date;
    v_now := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;

    if p_date is null
       or p_date < v_today
       or p_date > v_today + (rules ->> 'booking_days')::int - 1
       or not (rules -> 'workdays') @> to_jsonb(extract(isodow from p_date)::int - 1)
       or v_start < (rules ->> 'day_start')::int
       or v_end > (rules ->> 'day_end')::int
       or (v_start - (rules ->> 'day_start')::int) % least(p_duration, 30) <> 0 then
        raise exception 'That time cannot be booked. Choose one of the times shown.';
    end if;
    if p_date = v_today and v_start <= v_now then
        raise exception 'That time has already passed. Choose another.';
    end if;
    if exists (
        select 1 from public.booking_busy(p_code, p_date, p_date) b
        where v_start < b.end_min and v_end > b.start_min
    ) then
        raise exception 'That time is no longer free. Choose another.';
    end if;
    if (
        select count(*) from public.activities a
        where a.user_id = h.host_id
          and a.booked_by_email = v_email
          and a.created_at > now() - interval '1 day'
    ) >= (rules ->> 'per_email_per_day')::int then
        raise exception 'This email address has made too many bookings today. Try again tomorrow.';
    end if;

    select t.id into v_type
    from public.types t
    where t.user_id = h.host_id and lower(t.name) = 'meeting'
    limit 1;
    if v_type is null then
        insert into public.types (user_id, name, color)
        values (h.host_id, 'Meeting', '#f97316')
        returning id into v_type;
    end if;

    insert into public.activities (user_id, title, date, start_time, end_time, description, type_id, booked_by_email)
    values (
        h.host_id,
        'Meeting with ' || v_name,
        p_date,
        make_time(v_start / 60, v_start % 60, 0),
        make_time(v_end / 60, v_end % 60, 0),
        case when v_about <> '' then v_about || E'\n\n' else '' end
            || 'Booked by ' || v_name || ' (' || v_email || ')',
        v_type,
        v_email
    );

    return jsonb_build_object(
        'date',      p_date,
        'start',     p_start,
        'end',       to_char(make_time(v_end / 60, v_end % 60, 0), 'HH24:MI'),
        'duration',  p_duration,
        'name',      v_name,
        'email',     v_email,
        'about',     v_about,
        'time_zone', h.tz
    );
end;
$$;

-- Visitors may call the three public functions and nothing else.
revoke execute on function public.booking_host(text) from public, anon, authenticated;
grant execute on function public.booking_page(text) to anon, authenticated;
grant execute on function public.booking_busy(text, date, date) to anon, authenticated;
grant execute on function public.book_meeting(text, text, text, text, date, text, int) to anon, authenticated;
