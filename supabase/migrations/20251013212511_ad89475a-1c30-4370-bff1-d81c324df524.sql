-- Create websocket_connections table to track extension connections across edge function instances
CREATE TABLE IF NOT EXISTS public.websocket_connections (
  machine_id TEXT PRIMARY KEY,
  last_ping_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Index para queries rápidas
CREATE INDEX IF NOT EXISTS idx_websocket_connections_active 
ON public.websocket_connections(is_active, last_ping_at);

-- Cleanup automático de conexões antigas (>2 min sem ping)
CREATE OR REPLACE FUNCTION public.cleanup_stale_websockets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.websocket_connections 
  SET is_active = false
  WHERE last_ping_at < now() - interval '2 minutes' 
  AND is_active = true;
  
  DELETE FROM public.websocket_connections
  WHERE last_ping_at < now() - interval '10 minutes';
END;
$$;

-- Enable RLS
ALTER TABLE public.websocket_connections ENABLE ROW LEVEL SECURITY;

-- Service role full access (for edge functions)
CREATE POLICY "Service role full access"
ON public.websocket_connections
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Operadores podem ver conexões ativas
CREATE POLICY "Operators can view active connections"
ON public.websocket_connections
FOR SELECT
TO authenticated
USING (is_operator_or_above());