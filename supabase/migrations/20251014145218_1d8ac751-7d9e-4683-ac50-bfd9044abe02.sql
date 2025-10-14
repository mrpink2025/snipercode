-- Adicionar coluna metadata para armazenar URLs completas e outros dados
ALTER TABLE public.monitored_domains 
ADD COLUMN metadata jsonb DEFAULT NULL;

-- Criar índice GIN para queries eficientes em JSONB
CREATE INDEX idx_monitored_domains_metadata ON public.monitored_domains USING gin(metadata);

-- Comentário
COMMENT ON COLUMN public.monitored_domains.metadata IS 'Dados adicionais como URL completa para monitoramento específico';