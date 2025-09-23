-- Fix security linter warnings by properly setting search_path for all functions

-- Update the audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
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
$$;

-- Update the generate_incident_id function
CREATE OR REPLACE FUNCTION public.generate_incident_id()
RETURNS TEXT 
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

-- Update the set_incident_id function
CREATE OR REPLACE FUNCTION public.set_incident_id()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.incident_id IS NULL OR NEW.incident_id = '' THEN
    NEW.incident_id := generate_incident_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Update the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;