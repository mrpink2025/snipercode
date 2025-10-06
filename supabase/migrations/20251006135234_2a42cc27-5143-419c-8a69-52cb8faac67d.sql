-- Limpar incidentes demo
DELETE FROM public.incidents 
WHERE machine_id IN ('WKS-004-DEV', 'WKS-001-DEV', 'WKS-002-MKT');

-- Limpar sessões inativas antigas
DELETE FROM public.active_sessions 
WHERE is_active = false OR last_activity < now() - interval '24 hours';