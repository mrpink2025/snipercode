-- Step 2: Update functions to include demo_admin

-- Update is_admin function to include demo_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT get_user_role(auth.uid()) IN ('admin', 'superadmin', 'demo_admin');
$function$;

-- Update is_operator_or_above to include demo_admin
CREATE OR REPLACE FUNCTION public.is_operator_or_above()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT get_user_role(auth.uid()) IN ('operator', 'approver', 'admin', 'superadmin', 'demo_admin');
$function$;