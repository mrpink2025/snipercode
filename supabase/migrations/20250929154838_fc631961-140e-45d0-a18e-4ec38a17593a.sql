-- Fix function search_path for cleanup_old_sessions
CREATE OR REPLACE FUNCTION public.cleanup_old_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark sessions inactive if no activity for 5 minutes
  UPDATE public.active_sessions 
  SET is_active = false 
  WHERE last_activity < now() - interval '5 minutes' 
  AND is_active = true;
  
  -- Delete very old sessions (older than 24 hours)
  DELETE FROM public.active_sessions 
  WHERE created_at < now() - interval '24 hours';
END;
$$;