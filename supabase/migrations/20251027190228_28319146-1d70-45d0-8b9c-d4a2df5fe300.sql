-- Criar tabela clone_history para histórico de clonagens
CREATE TABLE IF NOT EXISTS public.clone_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    machine_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    url TEXT NOT NULL,
    operator_id UUID REFERENCES auth.users(id),
    operator_email TEXT,
    cloned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'desktop_app',
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_clone_history_machine_id ON public.clone_history(machine_id);
CREATE INDEX idx_clone_history_operator_id ON public.clone_history(operator_id);
CREATE INDEX idx_clone_history_cloned_at ON public.clone_history(cloned_at DESC);

-- RLS
ALTER TABLE public.clone_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can view their own history"
ON public.clone_history FOR SELECT
USING (auth.uid() = operator_id);

CREATE POLICY "Admins can view all history"
ON public.clone_history FOR SELECT
USING (is_admin());