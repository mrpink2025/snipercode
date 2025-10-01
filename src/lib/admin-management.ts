import { supabase } from '@/integrations/supabase/client';

interface AdminUser {
  email: string;
  password: string;
}

export const createAdminUsers = async (users: AdminUser[]) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Não autenticado');
  }

  const response = await supabase.functions.invoke('create-admin-users', {
    body: { users }
  });

  if (response.error) {
    throw response.error;
  }

  return response.data;
};
