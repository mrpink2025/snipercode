import { useState } from "react";
import { AlertTriangle, Globe, Monitor, Clock, Ban, FileText, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface IncidentCardProps {
  incident: {
    id: string;
    host: string;
    machineId: string;
    user: string;
    timestamp: string;
    tabUrl?: string;
    tab_url?: string;
    severity: 'RED' | 'NORMAL';
    cookieExcerpt: string;
    cookie_data?: any;
    status: 'new' | 'in-progress' | 'blocked' | 'approved';
    isRedList?: boolean;
  };
  onBlock: (incidentId: string) => void;
  onIsolate: (incidentId: string) => void;
  onViewDetails: (incidentId: string) => void;
  onViewSite?: (incident: any) => void;
}

const IncidentCard = ({ 
  incident, 
  onBlock, 
  onIsolate, 
  onViewDetails,
  onViewSite 
}: IncidentCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isDemoAdmin } = useAuth();

  const getSeverityConfig = (severity: string) => {
    if (severity === 'RED') {
      return {
        badgeClass: "bg-danger text-danger-foreground border-danger/20",
        cardClass: "incident-critical border-l-danger shadow-danger",
        icon: AlertTriangle,
        animate: true
      };
    }
    return {
      badgeClass: "bg-muted text-muted-foreground border-muted/20",
      cardClass: "incident-normal",
      icon: Globe,
      animate: false
    };
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'new':
        return { class: "status-new", text: "Novo" };
      case 'blocked':
        return { class: "status-blocked", text: "Bloqueado" };
      case 'approved':
        return { class: "status-approved", text: "Aprovado" };
      case 'in-progress':
        return { class: "status-pending", text: "Em Progresso" };
      default:
        return { class: "bg-muted text-muted-foreground", text: "Normal" };
    }
  };

  const severityConfig = getSeverityConfig(incident.severity);
  const statusConfig = getStatusConfig(incident.status);
  const SeverityIcon = severityConfig.icon;

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-lg cursor-pointer",
      severityConfig.cardClass,
      incident.status === 'new' && severityConfig.animate && "animate-security-pulse"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          {/* Incident ID & Host */}
          <div className="flex items-center space-x-3">
            <SeverityIcon className={cn(
              "w-5 h-5",
              incident.severity === 'RED' ? "text-danger" : "text-muted-foreground"
            )} />
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-sm font-semibold text-foreground">
                  {incident.id}
                </span>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-sm font-medium text-foreground">
                  {incident.host}
                </span>
                {incident.isRedList && (
                  <Badge className="bg-danger/10 text-danger border-danger/20 text-xs">
                    RedList
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {incident.machineId} • {incident.user}
              </p>
            </div>
          </div>

          {/* Status & Severity Badges */}
          <div className="flex items-center space-x-2">
            <Badge className={statusConfig.class}>
              {statusConfig.text}
            </Badge>
            <Badge className={severityConfig.badgeClass}>
              {incident.severity}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{new Date(incident.timestamp).toLocaleString('pt-BR')}</span>
          </div>
          {incident.tabUrl && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Globe className="w-4 h-4" />
              <span className="truncate" title={incident.tabUrl}>
                {incident.tabUrl}
              </span>
            </div>
          )}
        </div>

        {/* Cookie Excerpt */}
        <div className="mb-4 p-3 bg-muted/50 rounded-md">
          <p className="text-xs text-muted-foreground mb-1">Cookie identificado:</p>
          <p className="text-sm font-mono text-foreground">
            {incident.cookieExcerpt}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onBlock(incident.id)}
              className="text-danger hover:bg-danger/10 hover:border-danger/20"
            >
              <Ban className="w-4 h-4 mr-1" />
              Bloquear domínio
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onIsolate(incident.id)}
              className="text-primary hover:bg-primary/10 hover:border-primary/20"
            >
              <ShieldAlert className="w-4 h-4 mr-1" />
              Isolar host
            </Button>
          </div>
          
          <div className="flex space-x-2">
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => onViewDetails(incident.id)}
            >
              Ver detalhes
            </Button>
            
            {(incident.tabUrl || incident.tab_url) && onViewSite && !isDemoAdmin && (
              <Button
                variant="outline" 
                size="sm"
                onClick={() => onViewSite(incident)}
                className="gap-2"
              >
                <Globe className="h-4 w-4" />
                Ver Site
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default IncidentCard;