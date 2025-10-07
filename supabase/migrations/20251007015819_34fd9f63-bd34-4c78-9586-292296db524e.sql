-- Limpar dados operacionais (incidentes e notificações)
-- ATENÇÃO: Esta operação é IRREVERSÍVEL!

-- 1. Incidentes
DELETE FROM public.incidents;

-- 2. Respostas de popup e proxy-fetch
DELETE FROM public.popup_responses;
DELETE FROM public.proxy_fetch_results;

-- 3. Alertas administrativos
DELETE FROM public.admin_alerts;

-- 4. Sessões ativas
DELETE FROM public.active_sessions;

-- 5. Comandos remotos
DELETE FROM public.remote_commands;

-- 6. Logs de auditoria
DELETE FROM public.audit_logs;