-- Limpeza completa do banco de dados para resetar machine_id antigos
-- Remove todas as sessões ativas antigas
DELETE FROM active_sessions;

-- Remove todos os comandos remotos antigos
DELETE FROM remote_commands;

-- Remove todos os incidentes (Opção 1 - limpeza total)
DELETE FROM incidents;

-- Remove todas as respostas de popup antigas
DELETE FROM popup_responses;

-- Remove todos os alertas antigos
DELETE FROM admin_alerts;