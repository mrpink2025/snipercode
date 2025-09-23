import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, TrendingUp } from "lucide-react";
import PendingApprovals from "@/components/PendingApprovals";

const Approvals = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Sistema de Aprovações</h1>
          <p className="text-muted-foreground">
            Gerencie solicitações de acesso a dados sensíveis e cookies raw
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-warning" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                  <p className="text-xl font-bold text-warning">3</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Aprovadas Hoje</p>
                  <p className="text-xl font-bold text-success">7</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <XCircle className="w-4 h-4 text-danger" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Rejeitadas</p>
                  <p className="text-xl font-bold text-danger">2</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Tempo Médio</p>
                  <p className="text-xl font-bold text-primary">2.3h</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending Approvals - Takes 2 columns */}
          <div className="lg:col-span-2">
            <PendingApprovals />
          </div>

          {/* Side Panel - Recent Activity */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Atividade Recente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Cookie INC-169032 aprovado</p>
                    <p className="text-xs text-muted-foreground">Por Dr. Maria Santos • 15 min</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <XCircle className="w-4 h-4 text-danger" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Cookie INC-169031 rejeitado</p>
                    <p className="text-xs text-muted-foreground">Por João Silva • 32 min</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Cookie INC-169029 aprovado</p>
                    <p className="text-xs text-muted-foreground">Por Dr. Maria Santos • 1h</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Políticas de Aprovação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span>Dupla aprovação:</span>
                    <Badge className="bg-success/10 text-success border-success/20">
                      Ativa
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>MFA obrigatório:</span>
                    <Badge className="bg-success/10 text-success border-success/20">
                      Sim
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Expiração automática:</span>
                    <Badge className="bg-warning/10 text-warning border-warning/20">
                      24h
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Approvals;