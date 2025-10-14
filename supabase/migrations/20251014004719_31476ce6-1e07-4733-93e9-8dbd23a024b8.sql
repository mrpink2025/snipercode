-- Fix security warnings: Add search_path to functions

-- Recreate mark_old_snapshots function with proper search_path
CREATE OR REPLACE FUNCTION mark_old_snapshots() 
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE dom_snapshots 
  SET is_latest = FALSE 
  WHERE machine_id = NEW.machine_id 
    AND tab_id = NEW.tab_id 
    AND id != NEW.id;
  RETURN NEW;
END;
$$;

-- Recreate cleanup_old_snapshots function with proper search_path
CREATE OR REPLACE FUNCTION cleanup_old_snapshots() 
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM dom_snapshots 
  WHERE id IN (
    SELECT id FROM dom_snapshots 
    WHERE is_latest = FALSE 
    ORDER BY captured_at DESC 
    OFFSET 100
  );
END;
$$;