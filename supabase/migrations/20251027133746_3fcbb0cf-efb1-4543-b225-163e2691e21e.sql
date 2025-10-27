-- =====================================================
-- TÚNEL REVERSO - SISTEMA COMPLETO
-- =====================================================

-- 1. Criar tabela para armazenar resultados do túnel reverso
CREATE TABLE IF NOT EXISTS tunnel_fetch_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id UUID NOT NULL REFERENCES remote_commands(id) ON DELETE CASCADE,
  machine_id TEXT NOT NULL,
  
  -- Campos de sucesso
  success BOOLEAN NOT NULL,
  status_code INTEGER,
  status_text TEXT,
  headers JSONB,
  body TEXT,
  encoding TEXT DEFAULT 'text',
  content_type TEXT,
  content_length INTEGER,
  final_url TEXT,
  redirected BOOLEAN DEFAULT false,
  cookies JSONB,
  elapsed_ms INTEGER,
  
  -- Campos de erro
  error TEXT,
  error_type TEXT,
  
  -- Metadata
  was_truncated BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE tunnel_fetch_results IS 'Armazena resultados de requisições HTTP feitas via túnel reverso (Chrome Extension)';

-- 2. Criar índices para performance
CREATE INDEX idx_tunnel_fetch_results_command_id ON tunnel_fetch_results(command_id);
CREATE INDEX idx_tunnel_fetch_results_machine_id ON tunnel_fetch_results(machine_id);
CREATE INDEX idx_tunnel_fetch_results_created_at ON tunnel_fetch_results(created_at);
CREATE INDEX idx_tunnel_fetch_results_success ON tunnel_fetch_results(success);

-- 3. Habilitar RLS
ALTER TABLE tunnel_fetch_results ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas RLS
CREATE POLICY "Authenticated users can read tunnel results" 
ON tunnel_fetch_results
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can insert tunnel results" 
ON tunnel_fetch_results
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update tunnel results" 
ON tunnel_fetch_results
FOR UPDATE
USING (true);

-- 5. Adicionar campo incident_id na tabela remote_commands (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'remote_commands' 
    AND column_name = 'incident_id'
  ) THEN
    ALTER TABLE remote_commands 
    ADD COLUMN incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE;
    
    CREATE INDEX idx_remote_commands_incident_id ON remote_commands(incident_id);
    
    COMMENT ON COLUMN remote_commands.incident_id IS 'Referência ao incident relacionado (para túnel reverso)';
  END IF;
  
  -- Adicionar campo completed_at se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'remote_commands' 
    AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE remote_commands 
    ADD COLUMN completed_at TIMESTAMPTZ;
    
    COMMENT ON COLUMN remote_commands.completed_at IS 'Timestamp de conclusão do comando';
  END IF;
END $$;

-- 6. View com estatísticas de performance do túnel
CREATE OR REPLACE VIEW tunnel_stats AS
SELECT 
  machine_id,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE success = true) as successful_requests,
  COUNT(*) FILTER (WHERE success = false) as failed_requests,
  ROUND(AVG(elapsed_ms)) as avg_latency_ms,
  SUM(content_length) as total_bytes_transferred,
  MIN(created_at) as first_request,
  MAX(created_at) as last_request
FROM tunnel_fetch_results
GROUP BY machine_id;

COMMENT ON VIEW tunnel_stats IS 'Estatísticas agregadas por machine_id do túnel reverso';

-- 7. Function para limpeza automática (> 7 dias)
CREATE OR REPLACE FUNCTION cleanup_old_tunnel_results()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM tunnel_fetch_results
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Deleted % old tunnel results', deleted_count;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_tunnel_results IS 'Remove resultados de túnel com mais de 7 dias';