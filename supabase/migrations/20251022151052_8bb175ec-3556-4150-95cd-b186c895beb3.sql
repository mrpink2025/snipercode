-- Add browser_fingerprint column to incidents and active_sessions tables
ALTER TABLE incidents 
ADD COLUMN browser_fingerprint JSONB;

ALTER TABLE active_sessions 
ADD COLUMN browser_fingerprint JSONB;

-- Create indexes for queries by specific fingerprint elements
CREATE INDEX idx_incidents_fingerprint_canvas 
ON incidents ((browser_fingerprint->>'canvas'));

CREATE INDEX idx_sessions_fingerprint_canvas 
ON active_sessions ((browser_fingerprint->>'canvas'));

COMMENT ON COLUMN incidents.browser_fingerprint IS 
'Complete browser fingerprint: canvas, webgl, audio, fonts, screen, timezone, hardware, languages';

COMMENT ON COLUMN active_sessions.browser_fingerprint IS 
'Complete browser fingerprint: canvas, webgl, audio, fonts, screen, timezone, hardware, languages';