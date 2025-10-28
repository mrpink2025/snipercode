-- Create cron job to cleanup stale sessions every 2 minutes
SELECT cron.schedule(
  'cleanup-stale-sessions',
  '*/2 * * * *',
  $$SELECT cleanup_old_sessions()$$
);

-- Create cron job to cleanup stale websocket connections every 2 minutes
SELECT cron.schedule(
  'cleanup-stale-websockets',
  '*/2 * * * *',
  $$SELECT cleanup_stale_websockets()$$
);