import { AlertTriangle, Shield, Ban, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const kpiData = [
  {
    title: "Incidentes Abertos",
    value: "12",
    change: "+3",
    changeType: "increase" as const,
    icon: AlertTriangle,
    description: "Últimas 24h",
    color: "danger" as const,
  },
  {
    title: "Hosts Monitorados",
    value: "248",
    change: "+2",
    changeType: "increase" as const,
    icon: Shield,
    description: "Online agora",
    color: "success" as const,
  },
  {
    title: "Domínios Bloqueados",
    value: "156",
    change: "+12",
    changeType: "increase" as const,
    icon: Ban,
    description: "Bloqueios ativos",
    color: "warning" as const,
  },
  {
    title: "Solicitações Pendentes",
    value: "3",
    change: "-1",
    changeType: "decrease" as const,
    icon: Clock,
    description: "Aguardando aprovação",
    color: "primary" as const,
  },
];

const KPICards = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpiData.map((kpi) => {
        const IconComponent = kpi.icon;
        return (
          <Card 
            key={kpi.title} 
            className="transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <IconComponent 
                className={`w-5 h-5 ${
                  kpi.color === 'danger' ? 'text-danger' :
                  kpi.color === 'success' ? 'text-success' :
                  kpi.color === 'warning' ? 'text-warning' :
                  'text-primary'
                }`} 
              />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline space-x-3">
                <div className="text-3xl font-bold text-foreground">
                  {kpi.value}
                </div>
                <Badge 
                  variant={kpi.changeType === 'increase' ? 'default' : 'secondary'}
                  className={`
                    ${kpi.changeType === 'increase' 
                      ? kpi.color === 'danger' 
                        ? 'bg-danger/10 text-danger border-danger/20' 
                        : 'bg-success/10 text-success border-success/20'
                      : 'bg-muted text-muted-foreground'
                    }
                  `}
                >
                  {kpi.change}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {kpi.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default KPICards;