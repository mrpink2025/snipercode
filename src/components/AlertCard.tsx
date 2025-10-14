import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, ExternalLink, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Alert } from '@/hooks/useAlerts';

interface AlertCardProps {
  alert: Alert;
  onAcknowledge: (alertId: string) => void;
}

export const AlertCard = ({ alert, onAcknowledge }: AlertCardProps) => {
  const isCritical = alert.metadata?.is_critical || false;
  const isAcknowledged = !!alert.acknowledged_at;

  return (
    <Card className={`${isCritical ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20' : ''} ${isAcknowledged ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {isCritical ? (
              <AlertTriangle className="w-5 h-5 text-red-600 mt-1 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-1 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-lg truncate">
                  {alert.domain}
                </h3>
                {isCritical && (
                  <Badge variant="destructive" className="text-xs">
                    CRÍTICO
                  </Badge>
                )}
                {isAcknowledged && (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Reconhecido
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Máquina: <span className="font-mono">{alert.machine_id}</span>
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <a
              href={alert.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline truncate"
            >
              {alert.url}
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span>
              {formatDistanceToNow(new Date(alert.triggered_at), {
                addSuffix: true,
                locale: ptBR
              })}
            </span>
          </div>
        </div>

        {alert.metadata?.title && (
          <div className="text-sm">
            <span className="text-muted-foreground">Página: </span>
            <span className="font-medium">{alert.metadata.title}</span>
          </div>
        )}

        {!isAcknowledged && (
          <Button
            onClick={() => onAcknowledge(alert.id)}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Reconhecer Alerta
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
