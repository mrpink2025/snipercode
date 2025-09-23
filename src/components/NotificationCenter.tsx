import { Bell, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface Notification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'error',
    title: 'Incidente Crítico Detectado',
    message: 'Facebook.com acessado por maria.santos - requer ação imediata',
    timestamp: '2 min atrás',
    read: false,
  },
  {
    id: '2',
    type: 'warning',
    title: 'Solicitação de Aprovação',
    message: 'Cookie raw solicitado para incident INC-169235',
    timestamp: '5 min atrás',
    read: false,
  },
  {
    id: '3',
    type: 'success',
    title: 'Domínio Bloqueado',
    message: 'X.com foi bloqueado com sucesso',
    timestamp: '10 min atrás',
    read: true,
  },
  {
    id: '4',
    type: 'info',
    title: 'Sistema Atualizado',
    message: 'CorpMonitor v2.1.0 instalado com sucesso',
    timestamp: '1 hora atrás',
    read: true,
  },
];

const getIcon = (type: Notification['type']) => {
  const icons = {
    success: CheckCircle,
    warning: AlertTriangle,
    error: XCircle,
    info: Info,
  };
  return icons[type];
};

const getColor = (type: Notification['type']) => {
  const colors = {
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-danger',
    info: 'text-info',
  };
  return colors[type];
};

export const NotificationCenter = () => {
  const unreadCount = mockNotifications.filter((n) => !n.read).length;

  return (
    <Card className="w-80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificações
          </CardTitle>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unreadCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-96">
          <div className="space-y-1">
            {mockNotifications.map((notification, index) => {
              const Icon = getIcon(notification.type);
              const iconColor = getColor(notification.type);
              
              return (
                <div key={notification.id}>
                  <div
                    className={`p-4 hover:bg-accent/50 transition-colors cursor-pointer ${
                      !notification.read ? 'bg-accent/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`w-4 h-4 mt-0.5 ${iconColor}`} />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {notification.timestamp}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-primary rounded-full" />
                      )}
                    </div>
                  </div>
                  {index < mockNotifications.length - 1 && (
                    <Separator className="mx-4" />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <div className="p-4 border-t">
          <Button variant="ghost" className="w-full text-sm">
            Ver todas as notificações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};