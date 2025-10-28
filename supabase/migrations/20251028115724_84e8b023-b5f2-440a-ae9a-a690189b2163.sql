-- Habilitar extensão pg_cron se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Modificar função cleanup_old_sessions para threshold de 2 minutos
CREATE OR REPLACE FUNCTION public.cleanup_old_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Marcar sessões inativas se sem heartbeat por 2 minutos (antes era 5min)
  UPDATE public.active_sessions 
  SET is_active = false 
  WHERE last_activity < now() - interval '2 minutes' 
  AND is_active = true;
  
  -- Deletar sessões muito antigas (mais de 24 horas)
  DELETE FROM public.active_sessions 
  WHERE created_at < now() - interval '24 hours';
END;
$function$;