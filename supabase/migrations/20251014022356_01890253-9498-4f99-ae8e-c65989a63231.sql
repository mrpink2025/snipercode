-- Enable realtime for critical tables
ALTER TABLE public.active_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.admin_alerts REPLICA IDENTITY FULL;
ALTER TABLE public.remote_commands REPLICA IDENTITY FULL;
ALTER TABLE public.proxy_fetch_results REPLICA IDENTITY FULL;
ALTER TABLE public.incidents REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.remote_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.proxy_fetch_results;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;