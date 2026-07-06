-- Migration 006: Function to fetch user profiles securely from auth.users
-- This bypasses any issues with the profiles table triggers or RLS

CREATE OR REPLACE FUNCTION get_user_profiles_by_ids(uids UUID[])
RETURNS TABLE (id UUID, full_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY 
  SELECT u.id, (u.raw_user_meta_data->>'full_name')::TEXT as full_name
  FROM auth.users u
  WHERE u.id = ANY(uids);
END;
$$;
