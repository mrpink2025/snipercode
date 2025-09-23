-- Add unique constraint to email in profiles table
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- Create admin user profile for artur2024junior@gmail.com
INSERT INTO public.profiles (id, email, full_name, role, is_active)
VALUES (
  gen_random_uuid(),
  'artur2024junior@gmail.com',
  'Artur Junior',
  'admin'::user_role,
  true
);

-- Create function to automatically set this user as admin when they sign up
CREATE OR REPLACE FUNCTION public.set_artur_as_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'artur2024junior@gmail.com' THEN
    UPDATE public.profiles 
    SET role = 'admin'::user_role
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to automatically set admin role when Artur signs up
CREATE OR REPLACE TRIGGER on_artur_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  WHEN (NEW.email = 'artur2024junior@gmail.com')
  EXECUTE FUNCTION public.set_artur_as_admin();