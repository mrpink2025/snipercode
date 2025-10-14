import { supabase } from '@/integrations/supabase/client';

export const getUnacknowledgedAlertsCount = async (): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('admin_alerts')
      .select('*', { count: 'exact', head: true })
      .is('acknowledged_at', null);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error fetching unacknowledged alerts count:', error);
    return 0;
  }
};
