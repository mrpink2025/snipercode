-- Tornar user_id nullable na tabela incidents para permitir incidentes da extensão
ALTER TABLE public.incidents 
ALTER COLUMN user_id DROP NOT NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.incidents.user_id IS 'User ID - nullable para incidentes gerados automaticamente pela extensão';