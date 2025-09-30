import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface RealtimeEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: any;
  old?: any;
  table: string;
  commit_timestamp: string;
}

interface UseRealtimeOptions {
  table?: string;
  filter?: string;
  onEvent?: (event: RealtimeEvent) => void;
}

export const useRealtime = (options: UseRealtimeOptions = {}) => {
  const { table = '*', filter, onEvent } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const channelRef = useRef<any>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    console.log('🔄 Setting up realtime connection...');

    // Create a channel for database changes
    const channel = supabase
      .channel('db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table === '*' ? undefined : table,
          filter: filter
        },
        (payload) => {
          console.log('📡 Realtime event received:', payload);
          
          const event: RealtimeEvent = {
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            new: payload.new,
            old: payload.old,
            table: payload.table,
            commit_timestamp: payload.commit_timestamp
          };

          setLastEvent(event);
          
          // Handle notifications
          if (payload.eventType === 'INSERT') {
            if (payload.table === 'incidents') {
              toast.info('🚨 Novo incidente detectado!', {
                description: `Host: ${payload.new?.host}`,
                action: {
                  label: 'Ver',
                  onClick: () => window.location.reload()
                }
              });
            }
          }

          if (payload.eventType === 'UPDATE') {
            if (payload.table === 'incidents' && payload.old?.status !== payload.new?.status) {
              const statusMessages = {
                'in-progress': 'em andamento',
                'blocked': 'bloqueado',
                'approved': 'aprovado',
                'resolved': 'resolvido'
              };
              
              toast.success('✅ Status do incidente atualizado!', {
                description: `${payload.new?.incident_id} agora está ${statusMessages[payload.new?.status as keyof typeof statusMessages] || payload.new?.status}`
              });
            }
          }

          // Call custom event handler
          if (onEvent) {
            onEvent(event);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      console.log('🔌 Disconnecting realtime...');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      setIsConnected(false);
    };
  }, [user, table, filter, onEvent]);

  const sendRealtimeMessage = async (eventType: string, payload: any) => {
    if (channelRef.current) {
      const response = await channelRef.current.send({
        type: 'broadcast',
        event: eventType,
        payload
      });
      console.log('📤 Sent realtime message:', response);
      return response;
    }
  };

  return {
    isConnected,
    lastEvent,
    sendRealtimeMessage
  };
};