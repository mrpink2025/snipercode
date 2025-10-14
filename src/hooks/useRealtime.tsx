import { useEffect, useRef, useState, useCallback } from 'react';
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
  const [retryCount, setRetryCount] = useState(0);
  const channelRef = useRef<any>(null);
  const onEventRef = useRef(onEvent);
  const reconnectTimeoutRef = useRef<any>(null);
  const { user } = useAuth();

  // Update onEvent ref without causing re-subscription
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!user) {
      console.log('⚠️ Realtime: No user, skipping connection');
      return;
    }

    // Prevent rapid reconnections
    if (channelRef.current) {
      console.log('⚠️ Realtime: Channel already exists, skipping');
      return;
    }

    console.log('🔄 Setting up realtime connection... (attempt', retryCount + 1, ')');

    const channelName = `db-changes-${Date.now()}`;
    
    // Create a channel for database changes
    const channel = supabase
      .channel(channelName)
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
          if (onEventRef.current) {
            onEventRef.current(event);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          setRetryCount(0); // Reset retry count on successful connection
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ Realtime connection error:', status);
          
          // Implement exponential backoff
          const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 30000);
          console.log(`🔄 Retrying in ${backoffTime}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setRetryCount(prev => prev + 1);
            channelRef.current = null;
          }, backoffTime);
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('🔌 Disconnecting realtime...');
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [user, table, filter, retryCount]);

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