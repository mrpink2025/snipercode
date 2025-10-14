-- Adicionar coluna booleana 'acknowledged' para facilitar filtros
ALTER TABLE admin_alerts 
ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN 
GENERATED ALWAYS AS (acknowledged_at IS NOT NULL) STORED;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_admin_alerts_acknowledged 
ON admin_alerts(acknowledged);