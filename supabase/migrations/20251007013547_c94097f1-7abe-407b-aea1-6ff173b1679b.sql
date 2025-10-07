-- Update remote_commands check constraint to include proxy-fetch and export_cookies
ALTER TABLE public.remote_commands 
DROP CONSTRAINT IF EXISTS remote_commands_command_type_check;

ALTER TABLE public.remote_commands 
ADD CONSTRAINT remote_commands_command_type_check 
CHECK (command_type IN ('popup', 'block', 'screenshot', 'unblock', 'proxy-fetch', 'export_cookies'));