-- Limpar todos os incidentes do banco de dados
DELETE FROM public.incidents;

-- Resetar contadores se necessário (opcional)
-- Isso mantém o histórico do audit_logs intacto
