-- Migration 005: RPC for Invite Links
-- This allows bypassing RLS so non-members can look up projects by token
-- and automatically join them.

CREATE OR REPLACE FUNCTION get_project_by_token(token UUID)
RETURNS TABLE (id UUID, name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT p.id, p.name FROM public.projects p WHERE p.invite_token = token;
END;
$$;

CREATE OR REPLACE FUNCTION join_project_by_token(token UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_user_id UUID;
BEGIN
  -- Get the current authenticated user's ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find the project by token
  SELECT p.id INTO v_project_id FROM public.projects p WHERE p.invite_token = token;
  
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite token';
  END IF;

  -- Check if already a member to avoid duplicate inserts
  IF NOT EXISTS (SELECT 1 FROM public.project_members WHERE project_id = v_project_id AND user_id = v_user_id) THEN
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (v_project_id, v_user_id, 'member');
  END IF;

  RETURN v_project_id;
END;
$$;
