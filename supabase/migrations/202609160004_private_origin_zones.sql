-- Stores only a rounded commute-origin zone. Raw addresses are never stored.

alter table public.transportation_interests
  add column origin_zone_lat numeric(5, 2) check (
    origin_zone_lat is null or origin_zone_lat between -90 and 90
  ),
  add column origin_zone_lng numeric(6, 2) check (
    origin_zone_lng is null or origin_zone_lng between -180 and 180
  ),
  add column origin_zone_label text check (
    origin_zone_label is null or char_length(origin_zone_label) between 3 and 80
  ),
  add column origin_precision_miles numeric(3, 1) check (
    origin_precision_miles is null or origin_precision_miles between 0.5 and 9.9
  );

comment on column public.transportation_interests.origin_zone_lat is
  'Rounded latitude for anonymous commute matching; never an exact address coordinate.';
comment on column public.transportation_interests.origin_zone_lng is
  'Rounded longitude for anonymous commute matching; never an exact address coordinate.';

create index transportation_interests_private_origin_idx
  on public.transportation_interests (
    status,
    airport_destination,
    origin_zone_lat,
    origin_zone_lng
  );
