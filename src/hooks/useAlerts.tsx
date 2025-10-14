import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Alert {
  id: string;
  alert_type: string;
  domain: string;
  machine_id: string;
  url: string;
  triggered_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  metadata: {
    is_critical?: boolean;
    alert_type?: string;
    title?: string;
    full_url_match?: string;
  } | null;
}

interface UseAlertsOptions {
  acknowledged?: boolean;
  domain?: string;
  limit?: number;
}

export const useAlerts = (options: UseAlertsOptions = {}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('admin_alerts')
        .select('*')
        .order('triggered_at', { ascending: false });

      if (options.acknowledged !== undefined) {
        if (options.acknowledged) {
          query = query.not('acknowledged_at', 'is', null);
        } else {
          query = query.is('acknowledged_at', null);
        }
      }

      if (options.domain) {
        query = query.eq('domain', options.domain);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setAlerts((data || []) as Alert[]);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching alerts:', err);
      setError(err.message);
      toast.error('Erro ao carregar alertas');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnacknowledgedCount = async () => {
    try {
      const { count, error: countError } = await supabase
        .from('admin_alerts')
        .select('*', { count: 'exact', head: true })
        .is('acknowledged_at', null);

      if (countError) throw countError;
      setUnacknowledgedCount(count || 0);
    } catch (err) {
      console.error('Error fetching unacknowledged count:', err);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: updateError } = await supabase
        .from('admin_alerts')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user.id
        })
        .eq('id', alertId);

      if (updateError) throw updateError;

      toast.success('Alerta reconhecido');
      await fetchAlerts();
      await fetchUnacknowledgedCount();
    } catch (err: any) {
      console.error('Error acknowledging alert:', err);
      toast.error('Erro ao reconhecer alerta');
    }
  };

  const acknowledgeAllAlerts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: updateError } = await supabase
        .from('admin_alerts')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user.id
        })
        .is('acknowledged_at', null);

      if (updateError) throw updateError;

      toast.success('Todos os alertas foram reconhecidos');
      await fetchAlerts();
      await fetchUnacknowledgedCount();
    } catch (err: any) {
      console.error('Error acknowledging all alerts:', err);
      toast.error('Erro ao reconhecer alertas');
    }
  };

  useEffect(() => {
    fetchAlerts();
    fetchUnacknowledgedCount();

    // Set up realtime subscription
    const channel = supabase
      .channel('admin-alerts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_alerts'
        },
        () => {
          fetchAlerts();
          fetchUnacknowledgedCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.acknowledged, options.domain, options.limit]);

  return {
    alerts,
    loading,
    error,
    unacknowledgedCount,
    refetch: fetchAlerts,
    acknowledgeAlert,
    acknowledgeAllAlerts
  };
};
