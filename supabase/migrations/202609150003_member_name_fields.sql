-- Stores the private name parts used to build a privacy-safe public name.

alter table public.member_profiles
  add column first_name text check (
    first_name is null or char_length(trim(first_name)) between 1 and 60
  ),
  add column last_initial text check (
    last_initial is null or (
      char_length(trim(last_initial)) = 1
      and trim(last_initial) ~ '^[[:alpha:]]$'
    )
  );
