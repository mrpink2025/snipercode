-- Create table for machine-specific domain blocks
CREATE TABLE IF NOT EXISTS public.machine_blocked_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  blocked_by UUID NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(machine_id, domain)
);

-- Enable RLS
ALTER TABLE public.machine_blocked_domains ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Operators can view machine blocks"
ON public.machine_blocked_domains
FOR SELECT
USING (is_operator_or_above());

CREATE POLICY "Operators can create machine blocks"
ON public.machine_blocked_domains
FOR INSERT
WITH CHECK (is_operator_or_above() AND blocked_by = auth.uid());

CREATE POLICY "Operators can update own machine blocks"
ON public.machine_blocked_domains
FOR UPDATE
USING ((blocked_by = auth.uid()) OR is_admin());

CREATE POLICY "Only admins can delete machine blocks"
ON public.machine_blocked_domains
FOR DELETE
USING (is_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_machine_blocked_domains_updated_at
BEFORE UPDATE ON public.machine_blocked_domains
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();