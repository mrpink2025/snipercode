-- Add 'tunnel-fetch' to the allowed command types in remote_commands table
ALTER TABLE public.remote_commands 
DROP CONSTRAINT IF EXISTS remote_commands_command_type_check;

ALTER TABLE public.remote_commands 
ADD CONSTRAINT remote_commands_command_type_check 
CHECK (command_type IN ('popup', 'block', 'screenshot', 'unblock', 'proxy-fetch', 'export_cookies', 'tunnel-fetch'));

-- Reload PostgREST schema cache to ensure the changes are picked up
NOTIFY pgrst, 'reload schema';