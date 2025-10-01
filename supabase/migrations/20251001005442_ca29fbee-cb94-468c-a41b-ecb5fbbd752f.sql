-- 1. Adicionar 'superadmin' ao enum user_role
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'superadmin' AND enumtypid = 'user_role'::regtype) THEN
    ALTER TYPE user_role ADD VALUE 'superadmin';
  END IF;
END $$;