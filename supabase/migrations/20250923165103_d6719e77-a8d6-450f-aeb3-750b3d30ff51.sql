-- Update the existing handle_new_user function to automatically set artur2024junior@gmail.com as admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
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
    CASE 
      WHEN NEW.email = 'artur2024junior@gmail.com' THEN 'admin'::user_role
      ELSE 'operator'::user_role
    END
  );
  RETURN NEW;
END;
$$;