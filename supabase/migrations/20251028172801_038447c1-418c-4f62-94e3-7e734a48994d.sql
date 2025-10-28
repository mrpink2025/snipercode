-- Adicionar colunas para clonagem de sessão na tabela active_sessions
ALTER TABLE active_sessions 
ADD COLUMN IF NOT EXISTS cookies jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS local_storage jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS session_storage jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_active_sessions_cookies ON active_sessions USING gin(cookies);
CREATE INDEX IF NOT EXISTS idx_active_sessions_updated_at ON active_sessions(updated_at DESC);

-- Adicionar trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_active_sessions_updated_at
  BEFORE UPDATE ON active_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON COLUMN active_sessions.cookies IS 'Array de cookies capturados da sessão do browser';
COMMENT ON COLUMN active_sessions.local_storage IS 'Objeto localStorage capturado';
COMMENT ON COLUMN active_sessions.session_storage IS 'Objeto sessionStorage capturado';
COMMENT ON COLUMN active_sessions.updated_at IS 'Timestamp da última atualização da sessão';