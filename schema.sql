-- Supabase Schema for TrackYourBudget v2

-- Enable pgcron for scheduling
create extension if not exists pg_cron;

-- 1. Profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text default 'user', -- 'user' | 'admin'
  created_at timestamptz default now()
);

-- Trigger to create a profile on signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'user');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  currency text default 'USD',
  total_budget numeric,
  created_at timestamptz default now()
);

-- 3. Project Members
create table public.project_members (
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member', -- 'owner' | 'member'
  primary key (project_id, user_id)
);

-- Trigger to automatically add owner as member
create or replace function public.add_owner_to_members()
returns trigger as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_project_created
  after insert on public.projects
  for each row execute procedure public.add_owner_to_members();

-- 4. Transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  amount numeric not null,
  category text default 'General',
  paid_by text,
  is_recurring boolean default false,
  recurrence_frequency text check (recurrence_frequency in ('daily','weekly','monthly','yearly')),
  recurrence_end_date date,
  next_occurrence date,
  parent_recurring_id uuid references public.transactions(id) on delete cascade,
  created_at timestamptz default now()
);

-- 5. Savings Goals
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  target_amount numeric not null,
  current_amount numeric default 0,
  created_at timestamptz default now()
);

-- 6. Category Budgets
create table public.category_budgets (
  project_id uuid references public.projects(id) on delete cascade,
  category text,
  budget_limit numeric,
  primary key (project_id, category)
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.transactions enable row level security;
alter table public.savings_goals enable row level security;
alter table public.category_budgets enable row level security;

-- Helper function to check membership without triggering RLS loops
create or replace function public.is_project_member(_project_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.project_members
    where project_id = _project_id and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- Profiles: Users can read their own profile. Admins can read all.
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Admins can view all profiles" on public.profiles for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Projects
create policy "Users can view projects they are members of" on public.projects for select using (
  auth.uid() = owner_id or public.is_project_member(id)
);
create policy "Users can insert projects" on public.projects for insert with check (auth.uid() = owner_id);
create policy "Owners can update projects" on public.projects for update using (auth.uid() = owner_id);
create policy "Owners can delete projects" on public.projects for delete using (auth.uid() = owner_id);

-- Project Members
create policy "Users can view members of their projects" on public.project_members for select using (
  public.is_project_member(project_id)
);
create policy "Owners can manage members" on public.project_members for all using (
  exists (select 1 from public.projects where id = project_members.project_id and owner_id = auth.uid())
);

-- Transactions
create policy "Users can view transactions in their projects" on public.transactions for select using (
  public.is_project_member(project_id)
);
create policy "Users can insert transactions in their projects" on public.transactions for insert with check (
  public.is_project_member(project_id)
);
create policy "Users can update transactions in their projects" on public.transactions for update using (
  public.is_project_member(project_id)
);
create policy "Users can delete transactions in their projects" on public.transactions for delete using (
  public.is_project_member(project_id)
);

-- Savings Goals & Category Budgets (Same as transactions)
create policy "Users can manage savings goals in their projects" on public.savings_goals for all using (
  exists (select 1 from public.project_members where project_id = savings_goals.project_id and user_id = auth.uid())
);

create policy "Users can manage category budgets in their projects" on public.category_budgets for all using (
  exists (select 1 from public.project_members where project_id = category_budgets.project_id and user_id = auth.uid())
);

-- ==========================================
-- RECURRING TRANSACTIONS CRON JOB
-- ==========================================

create or replace function process_recurring_transactions()
returns void as $$
declare
  r record;
  next_date date;
begin
  for r in 
    select * from public.transactions 
    where is_recurring = true 
      and next_occurrence <= current_date 
      and (recurrence_end_date is null or next_occurrence <= recurrence_end_date)
  loop
    -- Insert the new transaction
    insert into public.transactions (
      project_id, user_id, name, amount, category, paid_by, is_recurring, parent_recurring_id, created_at
    ) values (
      r.project_id, r.user_id, r.name, r.amount, r.category, r.paid_by, false, r.id, current_timestamp
    );

    -- Calculate next occurrence date
    if r.recurrence_frequency = 'daily' then
      next_date := r.next_occurrence + interval '1 day';
    elsif r.recurrence_frequency = 'weekly' then
      next_date := r.next_occurrence + interval '1 week';
    elsif r.recurrence_frequency = 'monthly' then
      next_date := r.next_occurrence + interval '1 month';
    elsif r.recurrence_frequency = 'yearly' then
      next_date := r.next_occurrence + interval '1 year';
    end if;

    -- Update the parent's next occurrence
    update public.transactions
    set next_occurrence = next_date
    where id = r.id;
  end loop;
end;
$$ language plpgsql;

-- Uncomment the following line to schedule the job (requires pg_cron extension and appropriate permissions in Supabase)
-- select cron.schedule('process-recurring-transactions', '0 0 * * *', 'select process_recurring_transactions();');
