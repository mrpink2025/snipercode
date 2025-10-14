-- Adicionar coluna para rastrear quando o incidente foi visualizado
ALTER TABLE public.incidents 
ADD COLUMN viewed_at timestamp with time zone;

-- Criar índice para melhorar performance de queries
CREATE INDEX idx_incidents_viewed_at ON public.incidents(viewed_at);

-- Comentário
COMMENT ON COLUMN public.incidents.viewed_at IS 'Timestamp de quando o site do incidente foi visualizado no navegador interativo';