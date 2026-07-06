-- Migration 003: Net Worth Snapshots tracking
-- Run this in your Supabase SQL Editor

create table public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  total_assets numeric(12, 2) not null default 0,
  total_liabilities numeric(12, 2) not null default 0,
  net_worth numeric(12, 2) not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.net_worth_snapshots enable row level security;

create policy "Users can view their own net worth snapshots"
  on public.net_worth_snapshots for select
  using (auth.uid() = user_id);

create policy "Users can insert their own net worth snapshots"
  on public.net_worth_snapshots for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own net worth snapshots"
  on public.net_worth_snapshots for delete
  using (auth.uid() = user_id);
