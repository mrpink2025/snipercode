-- Create enums for better type safety
CREATE TYPE public.incident_status AS ENUM ('new', 'in-progress', 'blocked', 'approved', 'resolved');
CREATE TYPE public.incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.user_role AS ENUM ('admin', 'operator', 'approver');
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
CREATE TYPE public.audit_action AS ENUM ('create', 'update', 'delete', 'approve', 'reject', 'block', 'unblock');

-- Profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  department TEXT,
  role user_role NOT NULL DEFAULT 'operator',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Incidents table - core security incidents
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id TEXT UNIQUE NOT NULL, -- Human readable ID like INC-169234
  host TEXT NOT NULL,
  machine_id TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  tab_url TEXT,
  severity incident_severity NOT NULL DEFAULT 'medium',
  status incident_status NOT NULL DEFAULT 'new',
  cookie_excerpt TEXT NOT NULL,
  full_cookie_data JSONB,
  is_red_list BOOLEAN NOT NULL DEFAULT false,
  assigned_to UUID REFERENCES public.profiles(id),
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Blocked domains table
CREATE TABLE public.blocked_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  reason TEXT NOT NULL,
  blocked_by UUID REFERENCES public.profiles(id) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Raw cookie requests table
CREATE TABLE public.raw_cookie_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES public.incidents(id) NOT NULL,
  requested_by UUID REFERENCES public.profiles(id) NOT NULL,
  justification TEXT NOT NULL,
  approval_status approval_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Approvals workflow table
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL, -- 'incident', 'cookie_request', 'domain_block'
  resource_id UUID NOT NULL,
  requested_by UUID REFERENCES public.profiles(id) NOT NULL,
  approver_id UUID REFERENCES public.profiles(id),
  approval_status approval_status NOT NULL DEFAULT 'pending',
  comments TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Audit logs table - immutable audit trail
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  action audit_action NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_cookie_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer functions for role checking
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS user_role
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = user_uuid;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT get_user_role(auth.uid()) = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.is_operator_or_above()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT get_user_role(auth.uid()) IN ('operator', 'approver', 'admin');
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all active profiles" ON public.profiles
  FOR SELECT USING (is_active = true AND is_operator_or_above());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (is_admin());

-- RLS Policies for incidents
CREATE POLICY "Operators can view all incidents" ON public.incidents
  FOR SELECT USING (is_operator_or_above());

CREATE POLICY "Operators can create incidents" ON public.incidents
  FOR INSERT WITH CHECK (is_operator_or_above());

CREATE POLICY "Operators can update incidents" ON public.incidents
  FOR UPDATE USING (is_operator_or_above());

CREATE POLICY "Only admins can delete incidents" ON public.incidents
  FOR DELETE USING (is_admin());

-- RLS Policies for blocked_domains
CREATE POLICY "Operators can view blocked domains" ON public.blocked_domains
  FOR SELECT USING (is_operator_or_above());

CREATE POLICY "Operators can create domain blocks" ON public.blocked_domains
  FOR INSERT WITH CHECK (is_operator_or_above() AND blocked_by = auth.uid());

CREATE POLICY "Operators can update own blocks" ON public.blocked_domains
  FOR UPDATE USING (blocked_by = auth.uid() OR is_admin());

CREATE POLICY "Only admins can delete blocks" ON public.blocked_domains
  FOR DELETE USING (is_admin());

-- RLS Policies for raw_cookie_requests
CREATE POLICY "Users can view own cookie requests" ON public.raw_cookie_requests
  FOR SELECT USING (requested_by = auth.uid() OR is_admin());

CREATE POLICY "Operators can create cookie requests" ON public.raw_cookie_requests
  FOR INSERT WITH CHECK (is_operator_or_above() AND requested_by = auth.uid());

CREATE POLICY "Approvers can update cookie requests" ON public.raw_cookie_requests
  FOR UPDATE USING (get_user_role(auth.uid()) IN ('approver', 'admin'));

-- RLS Policies for approvals
CREATE POLICY "Users can view relevant approvals" ON public.approvals
  FOR SELECT USING (requested_by = auth.uid() OR approver_id = auth.uid() OR is_admin());

CREATE POLICY "Operators can create approvals" ON public.approvals
  FOR INSERT WITH CHECK (is_operator_or_above() AND requested_by = auth.uid());

CREATE POLICY "Approvers can update approvals" ON public.approvals
  FOR UPDATE USING (get_user_role(auth.uid()) IN ('approver', 'admin'));

-- RLS Policies for audit_logs
CREATE POLICY "Admins can view all audit logs" ON public.audit_logs
  FOR SELECT USING (is_admin());

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true); -- Allow system to insert

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blocked_domains_updated_at
  BEFORE UPDATE ON public.blocked_domains
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_raw_cookie_requests_updated_at
  BEFORE UPDATE ON public.raw_cookie_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_approvals_updated_at
  BEFORE UPDATE ON public.approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values
  ) VALUES (
    auth.uid(),
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'create'::audit_action
      WHEN TG_OP = 'UPDATE' THEN 'update'::audit_action
      WHEN TG_OP = 'DELETE' THEN 'delete'::audit_action
    END,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit triggers to key tables
CREATE TRIGGER audit_profiles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER audit_incidents_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER audit_blocked_domains_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.blocked_domains
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Create function to generate incident IDs
CREATE OR REPLACE FUNCTION public.generate_incident_id()
RETURNS TEXT AS $$
DECLARE
  counter INTEGER;
  new_id TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(incident_id FROM 5) AS INTEGER)), 169000) + 1
  INTO counter
  FROM public.incidents
  WHERE incident_id ~ '^INC-[0-9]+$';
  
  new_id := 'INC-' || counter::TEXT;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate incident IDs
CREATE OR REPLACE FUNCTION public.set_incident_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.incident_id IS NULL OR NEW.incident_id = '' THEN
    NEW.incident_id := generate_incident_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_incident_id_trigger
  BEFORE INSERT ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_incident_id();

-- Create indexes for better performance
CREATE INDEX idx_incidents_status ON public.incidents(status);
CREATE INDEX idx_incidents_severity ON public.incidents(severity);
CREATE INDEX idx_incidents_created_at ON public.incidents(created_at DESC);
CREATE INDEX idx_incidents_user_id ON public.incidents(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_blocked_domains_domain ON public.blocked_domains(domain);
CREATE INDEX idx_approvals_status ON public.approvals(approval_status);
CREATE INDEX idx_approvals_expires_at ON public.approvals(expires_at);