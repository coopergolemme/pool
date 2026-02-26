-- Minimal schema for local testing (Postgres)
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  username text unique not null,
  rating numeric default 1500,
  rd numeric default 350,
  vol numeric default 0.06,
  wins integer default 0,
  losses integer default 0,
  streak integer default 0,
  rating_9ball numeric default 1500,
  rd_9ball numeric default 350,
  vol_9ball numeric default 0.06,
  wins_9ball integer default 0,
  losses_9ball integer default 0,
  streak_9ball integer default 0,
  approved boolean not null default true,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  table_name text not null,
  format text not null check (format in ('8-ball', '8-ball-2v2', '9-ball')),
  race_to int not null default 1,
  player_a text not null,
  player_b text not null,
  winner text not null,
  score text,
  user_id uuid,
  opponent_id uuid,
  opponent_email text,
  created_at timestamptz not null default now()
);
