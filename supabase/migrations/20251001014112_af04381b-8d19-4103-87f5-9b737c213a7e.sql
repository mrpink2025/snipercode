-- Update is_operator_or_above function to include superadmin
CREATE OR REPLACE FUNCTION public.is_operator_or_above()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT get_user_role(auth.uid()) IN ('operator', 'approver', 'admin', 'superadmin');
$function$;