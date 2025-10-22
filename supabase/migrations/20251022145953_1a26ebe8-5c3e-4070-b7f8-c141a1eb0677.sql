-- Add client_ip column to incidents and active_sessions tables
-- This will store the original client's public IP address

-- Add client_ip to incidents table
ALTER TABLE public.incidents 
ADD COLUMN client_ip INET;

-- Add client_ip to active_sessions table
ALTER TABLE public.active_sessions 
ADD COLUMN client_ip INET;

-- Create indexes for efficient querying by IP
CREATE INDEX idx_incidents_client_ip ON public.incidents(client_ip);
CREATE INDEX idx_sessions_client_ip ON public.active_sessions(client_ip);

-- Add comment for documentation
COMMENT ON COLUMN public.incidents.client_ip IS 'Original public IP address of the client machine where the incident was detected';
COMMENT ON COLUMN public.active_sessions.client_ip IS 'Original public IP address of the client machine for this session';