import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealtime } from '@/hooks/useRealtime';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  created_at: string;
  action_url?: string;
  metadata?: any;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'created_at'>) => void;
}

export const useNotifications = (): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  // Set up realtime listener for new incidents and events
  useRealtime({
    table: 'incidents',
    onEvent: (event) => {
      if (event.eventType === 'INSERT' && event.new) {
        addNotification({
          title: '🚨 Novo Incidente Detectado',
          message: `Host bloqueado: ${event.new.host}`,
          type: 'warning',
          action_url: `/incidents/${event.new.id}`,
          metadata: { incident_id: event.new.incident_id }
        });
      }

      if (event.eventType === 'UPDATE' && event.old?.status !== event.new?.status) {
        const statusMessages = {
          'blocked': { title: '🔒 Incidente Bloqueado', type: 'error' as const },
          'approved': { title: '✅ Incidente Aprovado', type: 'success' as const },
          'resolved': { title: '✨ Incidente Resolvido', type: 'success' as const }
        };

        const statusInfo = statusMessages[event.new?.status as keyof typeof statusMessages];
        if (statusInfo) {
          addNotification({
            title: statusInfo.title,
            message: `${event.new.incident_id} - ${event.new.host}`,
            type: statusInfo.type,
            action_url: `/incidents/${event.new.id}`,
            metadata: { incident_id: event.new.incident_id }
          });
        }
      }
    }
  });


  const generateMockNotifications = (): Notification[] => {
    const now = new Date();
    return [
      {
        id: '1',
        title: '🚨 Incidente de Alta Severidade',
        message: 'Acesso não autorizado detectado em facebook.com',
        type: 'error',
        read: false,
        created_at: new Date(now.getTime() - 5 * 60000).toISOString(), // 5 min ago
        action_url: '/incidents/1',
        metadata: { severity: 'high' }
      },
      {
        id: '3',
        title: '✅ Domínio Bloqueado com Sucesso',
        message: 'twitter.com foi adicionado à lista de bloqueio',
        type: 'success',
        read: true,
        created_at: new Date(now.getTime() - 30 * 60000).toISOString(), // 30 min ago
        action_url: '/blocked-domains',
        metadata: { domain: 'twitter.com' }
      },
      {
        id: '4',
        title: '🔄 Sistema Atualizado',
        message: 'Nova versão do agente de monitoramento foi instalada',
        type: 'info',
        read: true,
        created_at: new Date(now.getTime() - 60 * 60000).toISOString(), // 1 hour ago
        metadata: { version: '2.1.0' }
      },
      {
        id: '5',
        title: '⚠️ Certificado SSL Expirado',
        message: 'O certificado para api.internal.com expira em 7 dias',
        type: 'warning',
        read: false,
        created_at: new Date(now.getTime() - 2 * 60 * 60000).toISOString(), // 2 hours ago
        metadata: { expires_in_days: 7 }
      }
    ];
  };

  useEffect(() => {
    // For now, we'll use mock data since we don't have a notifications table
    // In a real system, you'd fetch from a notifications table
    const mockNotifications = generateMockNotifications();
    setNotifications(mockNotifications);
    setLoading(false);
  }, [profile]);

  const addNotification = (notificationData: Omit<Notification, 'id' | 'read' | 'created_at'>) => {
    const newNotification: Notification = {
      ...notificationData,
      id: `notification-${Date.now()}-${Math.random()}`,
      read: false,
      created_at: new Date().toISOString()
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 99)]); // Keep last 100
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  const markAllAsRead = async () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  const clearAll = async () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    clearAll,
    addNotification
  };
};