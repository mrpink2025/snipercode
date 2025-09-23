-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    'operator'::user_role
  );
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create profile on user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert demo users for testing (optional)
INSERT INTO public.profiles (id, email, full_name, role, department, is_active)
VALUES 
  (gen_random_uuid(), 'admin@corp.com', 'Admin Sistema', 'admin', 'TI', true),
  (gen_random_uuid(), 'aprovador@corp.com', 'João Aprovador', 'approver', 'Segurança', true),
  (gen_random_uuid(), 'operador@corp.com', 'Maria Operadora', 'operator', 'Operações', true)
ON CONFLICT (id) DO NOTHING;