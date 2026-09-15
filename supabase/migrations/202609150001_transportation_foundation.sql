-- Airport Employee Community Platform
-- Transportation interest and member profile foundation.
-- Run in a separate Supabase project for this platform.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 80),
  airport_code text not null default 'ATL' check (airport_code ~ '^[A-Z]{3}$'),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.transportation_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  home_zip text not null check (home_zip ~ '^[0-9]{5}$'),
  home_county text check (
    home_county is null or char_length(home_county) between 2 and 100
  ),
  airport_destination text not null check (
    airport_destination in (
      'Domestic Terminal',
      'International Terminal',
      'Delta TechOps',
      'Delta G.O.',
      'North Cargo Area',
      'South Cargo Area',
      'Rental Car Center',
      'Other Airport Area'
    )
  ),
  shift_start time not null,
  shift_end time not null,
  work_days text[] not null check (
    cardinality(work_days) between 1 and 7
    and work_days <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]
  ),
  ride_role text not null check (ride_role in ('rider', 'driver', 'either')),
  shared_mode text not null check (shared_mode in ('carpool', 'vanpool', 'either')),
  frequency text not null check (frequency in ('regular', 'some-days', 'backup')),
  notification_preference text not null check (
    notification_preference in ('in-app', 'email', 'text')
  ),
  status text not null default 'active'
    check (status in ('active', 'paused', 'matched', 'closed')),
  consent_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger member_profiles_set_updated_at
before update on public.member_profiles
for each row execute function public.set_updated_at();

create trigger transportation_interests_set_updated_at
before update on public.transportation_interests
for each row execute function public.set_updated_at();

create index transportation_interests_match_idx
  on public.transportation_interests (
    status,
    home_zip,
    airport_destination,
    shift_start,
    shift_end
  );

create index transportation_interests_work_days_idx
  on public.transportation_interests using gin (work_days);

alter table public.member_profiles enable row level security;
alter table public.transportation_interests enable row level security;

revoke all on table public.member_profiles from public, anon, authenticated;
revoke all on table public.transportation_interests from public, anon, authenticated;

grant select, insert, update, delete on table public.member_profiles to authenticated;
grant select, insert, update, delete on table public.transportation_interests to authenticated;

create policy "Members can read their own profile"
on public.member_profiles for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Members can create their own profile"
on public.member_profiles for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Members can update their own profile"
on public.member_profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Members can delete their own profile"
on public.member_profiles for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Members can read their own transportation interest"
on public.transportation_interests for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Members can create their own transportation interest"
on public.transportation_interests for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Members can update their own transportation interest"
on public.transportation_interests for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Members can delete their own transportation interest"
on public.transportation_interests for delete
to authenticated
using ((select auth.uid()) = user_id);
