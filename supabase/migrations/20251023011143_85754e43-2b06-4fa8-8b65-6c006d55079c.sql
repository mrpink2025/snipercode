-- Limpeza completa de dados de incidentes e relacionados
BEGIN;

-- Log inicial de contagens
DO $$
DECLARE
  incident_count INTEGER;
  phishing_count INTEGER;
  snapshot_count INTEGER;
  popup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO incident_count FROM public.incidents;
  SELECT COUNT(*) INTO phishing_count FROM public.phishing_analysis;
  SELECT COUNT(*) INTO snapshot_count FROM public.dom_snapshots;
  SELECT COUNT(*) INTO popup_count FROM public.popup_responses;
  
  RAISE NOTICE 'Deletando: % incidentes, % phishing analysis, % snapshots, % popup responses', 
    incident_count, phishing_count, snapshot_count, popup_count;
END $$;

-- Deletar análises de phishing (referencia incidents.id via incident_id)
DELETE FROM public.phishing_analysis;

-- Deletar respostas de popup
DELETE FROM public.popup_responses;

-- Deletar snapshots DOM
DELETE FROM public.dom_snapshots;

-- Deletar todos os incidentes
DELETE FROM public.incidents;

-- Log final de confirmação
DO $$
DECLARE
  incident_count INTEGER;
  phishing_count INTEGER;
  snapshot_count INTEGER;
  popup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO incident_count FROM public.incidents;
  SELECT COUNT(*) INTO phishing_count FROM public.phishing_analysis;
  SELECT COUNT(*) INTO snapshot_count FROM public.dom_snapshots;
  SELECT COUNT(*) INTO popup_count FROM public.popup_responses;
  
  RAISE NOTICE 'Após limpeza: % incidentes, % phishing analysis, % snapshots, % popup responses', 
    incident_count, phishing_count, snapshot_count, popup_count;
END $$;

COMMIT;