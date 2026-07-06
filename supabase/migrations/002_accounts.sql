-- Migration 002: Net Worth / Accounts tracking
-- Run this in your Supabase SQL Editor AFTER migration 001

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('asset', 'liability')),
  balance numeric not null default 0,
  currency text default 'USD',
  created_at timestamptz default now()
);

-- RLS: users can only see and manage their own accounts
alter table public.accounts enable row level security;

create policy "Users can manage their own accounts" on public.accounts
  for all using (auth.uid() = user_id);
