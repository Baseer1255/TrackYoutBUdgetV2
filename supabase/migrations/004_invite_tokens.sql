-- Migration 004: Invite Tokens
-- Run this in your Supabase SQL Editor

-- Add invite_token column to projects
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS invite_token UUID UNIQUE;

-- Create an index on invite_token for faster lookups when joining via link
CREATE INDEX IF NOT EXISTS idx_projects_invite_token ON public.projects(invite_token);
