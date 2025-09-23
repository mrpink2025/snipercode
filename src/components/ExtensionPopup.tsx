import { useState } from "react";
import { Shield, Pause, Play, Settings, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

const ExtensionPopup = () => {
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const lastReportTime = new Date(Date.now() - 300000); // 5 minutes ago

  if (showOnboarding) {
    return (
      <Card className="w-80">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="flex items-center space-x-2 p-3 rounded-full bg-primary/10">
              <Shield className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle>Extensão CorpMonitor — Monitoramento Ativo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground leading-relaxed">
            Esta extensão coleta metadados de navegação e hashes de cookies em dispositivos 
            corporativos para proteção de ativos e investigação de incidentes. Valores sensíveis 
            são acessados apenas mediante justificativa aprovada e registro de auditoria.
          </div>
          
          <div className="security-banner">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning-foreground">Aviso Legal</p>
                <p className="text-xs text-warning-foreground/80 mt-1">
                  O uso está condicionado às políticas corporativas de segurança e privacidade.
                </p>
              </div>
            </div>
          </div>

          <div className="flex space-x-2 pt-2">
            <Button 
              className="flex-1" 
              onClick={() => setShowOnboarding(false)}
            >
              Concordo
            </Button>
            <Button variant="outline" size="sm">
              Ver políticas
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <CardTitle className="text-lg">CorpMonitor</CardTitle>
              <p className="text-xs text-muted-foreground">Extensão Corporativa</p>
            </div>
          </div>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Principal */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isMonitoring ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
            <div>
              <div className="font-medium text-sm">
                {isMonitoring ? 'Monitoramento Ativo' : 'Monitoramento Pausado'}
              </div>
              <div className="text-xs text-muted-foreground">
                {isMonitoring ? 'Coletando metadados' : 'Coleta pausada'}
              </div>
            </div>
          </div>
          <Switch 
            checked={isMonitoring} 
            onCheckedChange={setIsMonitoring}
            className="data-[state=checked]:bg-success"
          />
        </div>

        <Separator />

        {/* Último Relatório */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Último relatório:</span>
          </div>
          <div className="text-sm font-mono bg-muted/50 p-2 rounded">
            {lastReportTime.toLocaleString('pt-BR')}
          </div>
        </div>

        {/* Status da Sessão */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-2 bg-card border rounded">
            <div className="text-lg font-bold text-success">4</div>
            <div className="text-xs text-muted-foreground">Cookies hash</div>
          </div>
          <div className="text-center p-2 bg-card border rounded">
            <div className="text-lg font-bold text-primary">12</div>
            <div className="text-xs text-muted-foreground">Metadados</div>
          </div>
        </div>

        {/* Toggle Rápido - Apenas Admin */}
        <div className="security-banner">
          <div className="text-xs">
            <p className="font-medium">⚠️ Apenas administradores de dispositivo</p>
            <p className="text-xs opacity-75 mt-1">
              Controles avançados requerem privilégios elevados
            </p>
          </div>
        </div>

        {/* Ações */}
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => window.open('/dashboard', '_blank')}
          >
            Abrir Console
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowOnboarding(true)}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* Footer */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          v1.0.0-PoC • Política de privacidade corporativa
        </div>
      </CardContent>
    </Card>
  );
};

export default ExtensionPopup;