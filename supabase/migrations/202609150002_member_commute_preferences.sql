-- Adds the profile-level commute preferences collected during onboarding.

alter table public.member_profiles
  add column current_commute_mode text check (
    current_commute_mode is null or current_commute_mode in (
      'drive-self',
      'ride-with-someone',
      'transit',
      'shared-ride',
      'rideshare-taxi',
      'walk-bike',
      'other'
    )
  ),
  add column shared_ride_role text check (
    shared_ride_role is null or shared_ride_role in (
      'rider',
      'driver',
      'either'
    )
  );
