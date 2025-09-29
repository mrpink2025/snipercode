-- Create active_sessions table for real-time session tracking
CREATE TABLE public.active_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    machine_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    tab_id TEXT NOT NULL,
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create monitored_domains table
CREATE TABLE public.monitored_domains (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,
    added_by UUID NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    alert_type TEXT NOT NULL DEFAULT 'sound',
    alert_frequency INTEGER NOT NULL DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create popup_templates table
CREATE TABLE public.popup_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT,
    html_content TEXT NOT NULL,
    css_styles TEXT,
    created_by UUID NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create remote_commands table
CREATE TABLE public.remote_commands (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    command_type TEXT NOT NULL CHECK (command_type IN ('popup', 'block', 'screenshot', 'unblock')),
    target_machine_id TEXT NOT NULL,
    target_tab_id TEXT,
    target_domain TEXT,
    payload JSONB,
    executed_by UUID NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'executed', 'failed')),
    response JSONB
);

-- Create admin_alerts table
CREATE TABLE public.admin_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_type TEXT NOT NULL DEFAULT 'domain_access',
    machine_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    url TEXT NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB
);

-- Enable Row Level Security
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitored_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popup_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remote_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for active_sessions
CREATE POLICY "Operators can view all sessions" 
ON public.active_sessions FOR SELECT 
USING (is_operator_or_above());

CREATE POLICY "Extensions can manage sessions" 
ON public.active_sessions FOR ALL 
USING (true);

-- RLS Policies for monitored_domains
CREATE POLICY "Admins can manage monitored domains" 
ON public.monitored_domains FOR ALL 
USING (is_admin());

CREATE POLICY "Operators can view monitored domains" 
ON public.monitored_domains FOR SELECT 
USING (is_operator_or_above());

-- RLS Policies for popup_templates
CREATE POLICY "Admins can manage popup templates" 
ON public.popup_templates FOR ALL 
USING (is_admin());

CREATE POLICY "Operators can view popup templates" 
ON public.popup_templates FOR SELECT 
USING (is_operator_or_above());

-- RLS Policies for remote_commands
CREATE POLICY "Admins can manage remote commands" 
ON public.remote_commands FOR ALL 
USING (is_admin());

CREATE POLICY "Operators can view commands they executed" 
ON public.remote_commands FOR SELECT 
USING (executed_by = auth.uid() OR is_admin());

-- RLS Policies for admin_alerts
CREATE POLICY "Admins can manage alerts" 
ON public.admin_alerts FOR ALL 
USING (is_admin());

CREATE POLICY "Operators can view alerts" 
ON public.admin_alerts FOR SELECT 
USING (is_operator_or_above());

-- Indexes for performance
CREATE INDEX idx_active_sessions_machine_domain ON public.active_sessions(machine_id, domain);
CREATE INDEX idx_active_sessions_last_activity ON public.active_sessions(last_activity);
CREATE INDEX idx_monitored_domains_domain ON public.monitored_domains(domain) WHERE is_active = true;
CREATE INDEX idx_remote_commands_status ON public.remote_commands(status, executed_at);
CREATE INDEX idx_admin_alerts_triggered ON public.admin_alerts(triggered_at);

-- Trigger for updated_at
CREATE TRIGGER update_monitored_domains_updated_at
BEFORE UPDATE ON public.monitored_domains
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_popup_templates_updated_at
BEFORE UPDATE ON public.popup_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to clean old sessions
CREATE OR REPLACE FUNCTION public.cleanup_old_sessions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Mark sessions inactive if no activity for 5 minutes
  UPDATE public.active_sessions 
  SET is_active = false 
  WHERE last_activity < now() - interval '5 minutes' 
  AND is_active = true;
  
  -- Delete very old sessions (older than 24 hours)
  DELETE FROM public.active_sessions 
  WHERE created_at < now() - interval '24 hours';
END;
$$;