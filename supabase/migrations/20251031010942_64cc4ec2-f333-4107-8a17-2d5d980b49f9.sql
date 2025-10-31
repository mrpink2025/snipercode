-- Adicionar constraint único em live_screenshots.machine_id para permitir UPSERT correto
-- Isso garante que o edge function screenshot-stream possa fazer upsert(onConflict: 'machine_id')
ALTER TABLE public.live_screenshots
ADD CONSTRAINT live_screenshots_machine_id_unique UNIQUE (machine_id);