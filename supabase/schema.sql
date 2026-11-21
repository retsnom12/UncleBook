-- Run this once in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.photos (
  id          uuid primary key default gen_random_uuid(),
  image_path  text not null,
  caption     text not null default '',
  score       int  not null check (score between 0 and 100),
  verdict     text not null default '',
  likes       int  not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists photos_created_at_idx on public.photos (created_at desc);

-- All access goes through the Next.js API routes using the service role key.
-- RLS on + no policies = the public anon key can touch nothing directly.
alter table public.photos enable row level security;

-- Atomic like counter (no read-modify-write race under load).
create or replace function public.increment_likes(photo_id uuid)
returns int
language sql
security definer
set search_path = public
as $$
  update public.photos set likes = likes + 1 where id = photo_id returning likes;
$$;

revoke all on function public.increment_likes(uuid) from public, anon, authenticated;
grant execute on function public.increment_likes(uuid) to service_role;

-- Public bucket for the photos themselves (reads are public, writes are server-only).
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;
