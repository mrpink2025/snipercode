-- Fix remote_commands status constraint to include all valid statuses
-- This resolves the 500 error when proxy-fetch-result tries to update status

-- 1) Remove old constraint if exists
ALTER TABLE remote_commands 
DROP CONSTRAINT IF EXISTS remote_commands_status_check;

-- 2) Add constraint including all valid statuses (including 'executed' and 'completed')
ALTER TABLE remote_commands
ADD CONSTRAINT remote_commands_status_check 
CHECK (status IN ('pending', 'queued', 'processing', 'executed', 'completed', 'failed'));