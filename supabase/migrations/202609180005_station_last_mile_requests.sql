-- Skip the Bus: secure MARTA station-to-home request foundation.
-- Exact street addresses and exact home coordinates are never stored.

create table public.station_last_mile_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  home_zip text not null check (home_zip ~ '^[0-9]{5}$'),
  origin_zone_lat numeric(5, 2) not null check (origin_zone_lat between -90 and 90),
  origin_zone_lng numeric(6, 2) not null check (origin_zone_lng between -180 and 180),
  origin_zone_label text not null check (char_length(origin_zone_label) between 3 and 80),
  origin_precision_miles numeric(3, 1) not null check (
    origin_precision_miles between 0.5 and 9.9
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
  shift_end time not null,
  station_node_code text not null check (station_node_code ~ '^MARTA-[A-Z0-9-]+$'),
  station_name text not null check (char_length(station_name) between 3 and 100),
  station_lat numeric(8, 5) not null check (station_lat between -90 and 90),
  station_lng numeric(8, 5) not null check (station_lng between -180 and 180),
  station_arrival_time time not null,
  arrival_flex_minutes smallint not null check (
    arrival_flex_minutes in (5, 10, 15, 20, 30)
  ),
  work_days text[] not null check (
    cardinality(work_days) between 1 and 7
    and work_days <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]
  ),
  last_mile_mode text not null check (
    last_mile_mode in ('coworker_ride', 'rideshare_split', 'either')
  ),
  ride_role text not null check (ride_role in ('rider', 'driver', 'either')),
  seats_available smallint check (seats_available between 1 and 6),
  max_wait_minutes smallint not null check (
    max_wait_minutes in (5, 10, 15, 20, 30)
  ),
  status text not null default 'active'
    check (status in ('active', 'paused', 'matched', 'closed')),
  consent_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (ride_role = 'rider' and seats_available is null)
    or (ride_role in ('driver', 'either') and seats_available is not null)
  ),
  check (
    last_mile_mode <> 'rideshare_split'
    or (ride_role = 'rider' and seats_available is null)
  )
);

comment on table public.station_last_mile_requests is
  'Private member requests for a shared trip from a public MARTA station to an anonymous home zone.';
comment on column public.station_last_mile_requests.origin_zone_lat is
  'Rounded latitude for anonymous last-mile matching; never an exact address coordinate.';
comment on column public.station_last_mile_requests.origin_zone_lng is
  'Rounded longitude for anonymous last-mile matching; never an exact address coordinate.';

create trigger station_last_mile_requests_set_updated_at
before update on public.station_last_mile_requests
for each row execute function public.set_updated_at();

create index station_last_mile_match_idx
  on public.station_last_mile_requests (
    status,
    station_node_code,
    station_arrival_time,
    last_mile_mode,
    ride_role
  );

create index station_last_mile_work_days_idx
  on public.station_last_mile_requests using gin (work_days);

alter table public.station_last_mile_requests enable row level security;

revoke all on table public.station_last_mile_requests from public, anon, authenticated;
grant select, insert, update, delete
  on table public.station_last_mile_requests to authenticated;

create policy "Members can read their own station ride request"
on public.station_last_mile_requests for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Members can create their own station ride request"
on public.station_last_mile_requests for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Members can update their own station ride request"
on public.station_last_mile_requests for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Members can delete their own station ride request"
on public.station_last_mile_requests for delete
to authenticated
using ((select auth.uid()) = user_id);
