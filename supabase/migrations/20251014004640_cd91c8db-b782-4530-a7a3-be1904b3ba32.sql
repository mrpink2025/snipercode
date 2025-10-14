-- Create dom_snapshots table for storing client-side DOM captures
CREATE TABLE dom_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id TEXT NOT NULL,
  tab_id TEXT NOT NULL,
  session_id UUID REFERENCES active_sessions(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  html_content TEXT NOT NULL,
  resources JSONB,
  viewport JSONB,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  is_latest BOOLEAN DEFAULT TRUE
);

-- Create indexes for fast lookups
CREATE INDEX idx_dom_snapshots_session ON dom_snapshots(session_id, captured_at DESC);
CREATE INDEX idx_dom_snapshots_machine_tab ON dom_snapshots(machine_id, tab_id, captured_at DESC);
CREATE INDEX idx_dom_snapshots_latest ON dom_snapshots(machine_id, tab_id, is_latest) WHERE is_latest = TRUE;

-- Trigger to mark old snapshots as non-latest
CREATE OR REPLACE FUNCTION mark_old_snapshots() 
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dom_snapshots 
  SET is_latest = FALSE 
  WHERE machine_id = NEW.machine_id 
    AND tab_id = NEW.tab_id 
    AND id != NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mark_old_snapshots
AFTER INSERT ON dom_snapshots
FOR EACH ROW EXECUTE FUNCTION mark_old_snapshots();

-- Enable Row Level Security
ALTER TABLE dom_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view snapshots" ON dom_snapshots
  FOR SELECT USING (is_admin());

CREATE POLICY "Extensions can insert snapshots" ON dom_snapshots
  FOR INSERT WITH CHECK (TRUE);

-- Function to cleanup old snapshots (keep only last 100)
CREATE OR REPLACE FUNCTION cleanup_old_snapshots() 
RETURNS void AS $$
BEGIN
  DELETE FROM dom_snapshots 
  WHERE id IN (
    SELECT id FROM dom_snapshots 
    WHERE is_latest = FALSE 
    ORDER BY captured_at DESC 
    OFFSET 100
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for dom_snapshots
ALTER TABLE dom_snapshots REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE dom_snapshots;