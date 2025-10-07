-- Criar tabela para resultados de proxy-fetch (separado de popup_responses)
CREATE TABLE public.proxy_fetch_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id UUID NOT NULL REFERENCES public.remote_commands(id) ON DELETE CASCADE,
  machine_id TEXT NOT NULL,
  url TEXT NOT NULL,
  html_content TEXT,
  status_code INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_proxy_fetch_command_id ON public.proxy_fetch_results(command_id);
CREATE INDEX idx_proxy_fetch_machine_id ON public.proxy_fetch_results(machine_id);
CREATE INDEX idx_proxy_fetch_created_at ON public.proxy_fetch_results(created_at DESC);

-- RLS Policies
ALTER TABLE public.proxy_fetch_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view proxy fetch results"
ON public.proxy_fetch_results FOR SELECT
TO authenticated
USING (is_admin());

CREATE POLICY "System can insert proxy fetch results"
ON public.proxy_fetch_results FOR INSERT
WITH CHECK (true);