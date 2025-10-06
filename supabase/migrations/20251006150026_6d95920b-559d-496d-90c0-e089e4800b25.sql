-- Cleanup orphaned active_sessions records without valid machine_id
-- This prevents "machine offline" errors when trying to send remote commands

DELETE FROM active_sessions 
WHERE machine_id IS NULL 
   OR machine_id = 'unknown' 
   OR machine_id = '';

-- Add comment to document the cleanup
COMMENT ON TABLE active_sessions IS 'Active user sessions. machine_id must always be valid (not null, not empty, not unknown).';