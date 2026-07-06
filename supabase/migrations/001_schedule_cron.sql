-- Migration 001: Schedule recurring transactions cron job
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Step 1: Enable pg_cron extension (may already be enabled)
create extension if not exists pg_cron;

-- Step 2: Schedule process_recurring_transactions() to run every day at midnight UTC
select cron.schedule(
  'process-recurring-transactions',   -- job name (must be unique)
  '0 0 * * *',                        -- cron expression: midnight every day
  'select process_recurring_transactions();'
);

-- Step 3: Optional safety net — schedule budget-alerts check daily at 8am UTC
-- (This calls the edge function for all projects; requires service role in edge function)
-- Uncomment if you want a daily email sweep:
-- select cron.schedule(
--   'daily-budget-alerts',
--   '0 8 * * *',
--   $$select net.http_post(url := current_setting('app.edge_functions_url') || '/budget-alerts', headers := '{"Content-Type":"application/json"}', body := '{}');$$
-- );

-- Verify: To check scheduled jobs, run:
-- select * from cron.job;
