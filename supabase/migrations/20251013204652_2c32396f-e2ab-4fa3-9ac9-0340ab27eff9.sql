-- Add local_storage and session_storage columns to incidents table for session authentication
ALTER TABLE public.incidents 
ADD COLUMN IF NOT EXISTS local_storage JSONB,
ADD COLUMN IF NOT EXISTS session_storage JSONB;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_incidents_local_storage ON public.incidents USING GIN (local_storage);
CREATE INDEX IF NOT EXISTS idx_incidents_session_storage ON public.incidents USING GIN (session_storage);

-- Add comment
COMMENT ON COLUMN public.incidents.local_storage IS 'Captured localStorage data from the browser tab for session authentication';
COMMENT ON COLUMN public.incidents.session_storage IS 'Captured sessionStorage data from the browser tab for session authentication';