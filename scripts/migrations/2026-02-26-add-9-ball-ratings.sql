  alter table public.profiles
    add column if not exists rating_9ball numeric default 1500,
    add column if not exists rd_9ball numeric default 350,
    add column if not exists vol_9ball numeric default 0.06,
    add column if not exists wins_9ball integer default 0,
    add column if not exists losses_9ball integer default 0,
    add column if not exists streak_9ball integer default 0;

  alter table public.games
    drop constraint if exists games_format_check;

  alter table public.games
    add constraint games_format_check
    check (format in ('8-ball', '8-ball-2v2', '9-ball'));
