-- Add unique constraint to active_sessions for UPSERT to work
ALTER TABLE public.active_sessions
ADD CONSTRAINT active_sessions_machine_tab_unique UNIQUE (machine_id, tab_id);