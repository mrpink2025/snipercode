-- Criar unique index para active_sessions(machine_id, tab_id)
-- Isso permite upsert direto via REST com onConflict
CREATE UNIQUE INDEX IF NOT EXISTS ux_active_sessions_machine_tab 
ON public.active_sessions(machine_id, tab_id);