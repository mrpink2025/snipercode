-- Create enum for update channels
CREATE TYPE public.update_channel AS ENUM ('stable', 'beta', 'dev');

-- Create system_settings table for extension configuration
-- Using a single row table pattern with fixed ID
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid PRIMARY KEY,
  extension_update_url TEXT,
  extension_version TEXT,
  auto_update_enabled BOOLEAN NOT NULL DEFAULT true,
  update_channel update_channel NOT NULL DEFAULT 'stable'::update_channel,
  force_update_version TEXT,
  rollback_version TEXT,
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT single_settings_row CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage system settings
CREATE POLICY "Only admins can manage system settings" 
ON public.system_settings 
FOR ALL 
USING (is_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings with fixed ID
INSERT INTO public.system_settings (
  id,
  extension_update_url,
  extension_version,
  auto_update_enabled,
  update_channel
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'https://vxvcquifgwtbjghrcjbp.supabase.co/functions/v1/extension-update-server',
  '1.0.0',
  true,
  'stable'
);