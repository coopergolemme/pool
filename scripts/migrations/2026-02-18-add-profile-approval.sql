alter table public.profiles
  add column if not exists approved boolean;

alter table public.profiles
  add column if not exists approved_at timestamptz;

update public.profiles
set approved = true
where approved is null;

alter table public.profiles
  alter column approved set default true;

alter table public.profiles
  alter column approved set not null;
