-- Tabela para armazenar screenshots em tempo real (apenas aba ativa)
CREATE TABLE live_screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id TEXT NOT NULL,
  screenshot_data TEXT NOT NULL,
  domain TEXT,
  url TEXT,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garantir 1 screenshot por máquina (sempre sobrescreve)
  UNIQUE(machine_id)
);

-- Índice para busca rápida
CREATE INDEX idx_live_screenshots_machine 
ON live_screenshots(machine_id, captured_at DESC);

-- RLS Policies
ALTER TABLE live_screenshots ENABLE ROW LEVEL SECURITY;

-- Admins podem visualizar
CREATE POLICY "Admins can view screenshots"
ON live_screenshots FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'superadmin')
  )
);

-- Service role pode inserir/atualizar (via edge function)
CREATE POLICY "Service can manage screenshots"
ON live_screenshots FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);