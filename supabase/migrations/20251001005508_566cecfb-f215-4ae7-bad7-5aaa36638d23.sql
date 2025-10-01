-- 2. Atualizar função is_admin para incluir superadmin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT get_user_role(auth.uid()) IN ('admin', 'superadmin');
$$;

-- 3. Criar nova função is_superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT get_user_role(auth.uid()) = 'superadmin';
$$;

-- 4. Atualizar política de profiles para permitir superadmin gerenciar outros admins
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

CREATE POLICY "Superadmins can manage all profiles"
ON public.profiles
FOR ALL
USING (is_superadmin())
WITH CHECK (is_superadmin());

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can update non-admin profiles"
ON public.profiles
FOR UPDATE
USING (
  is_admin() AND 
  (SELECT role FROM public.profiles WHERE id = profiles.id) NOT IN ('admin', 'superadmin')
);

-- 5. Atualizar handle_new_user para sempre criar como operator
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- 6. Atualizar artur2024junior@gmail.com para superadmin
UPDATE public.profiles 
SET role = 'superadmin'::user_role 
WHERE email = 'artur2024junior@gmail.com';