import { useState, useEffect } from "react";
import { Shield, Download, CheckCircle, Settings, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";

const AgentInstaller = () => {
  const [installProgress, setInstallProgress] = useState(0);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showTrayDemo, setShowTrayDemo] = useState(false);

  useEffect(() => {
    if (isInstalling && installProgress < 100) {
      const timer = setTimeout(() => {
        setInstallProgress(prev => Math.min(prev + 10, 100));
      }, 300);
      return () => clearTimeout(timer);
    }
    
    if (installProgress === 100 && isInstalling) {
      setTimeout(() => {
        setIsInstalling(false);
        setIsInstalled(true);
      }, 500);
    }
  }, [installProgress, isInstalling]);

  const startInstallation = () => {
    setIsInstalling(true);
    setInstallProgress(0);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-6">
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </Link>
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-2xl font-bold">CorpMonitor Agent - Instalador Corporativo</h1>
            <p className="text-muted-foreground">Sistema de monitoramento para dispositivos corporativos</p>
          </div>
        </div>

        {!isInstalling && !isInstalled && (
          <div className="space-y-6">
            {/* Installation Welcome */}
            <Card>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-6 bg-primary/10 rounded-full">
                    <Shield className="w-12 h-12 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-xl">Bem-vindo ao CorpMonitor Agent</CardTitle>
                <p className="text-muted-foreground">
                  Este agente permite o monitoramento seguro de atividades em dispositivos corporativos
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="security-banner">
                  <div className="text-sm">
                    <p className="font-medium">📋 Instalação Corporativa Autorizada</p>
                    <p className="text-xs opacity-80 mt-1">
                      Esta instalação está em conformidade com as políticas de segurança da empresa 
                      e foi aprovada pelo departamento de TI.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <Shield className="w-8 h-8 mx-auto mb-2 text-primary" />
                    <h4 className="font-medium">Segurança</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Monitoramento transparente e auditável
                    </p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <Settings className="w-8 h-8 mx-auto mb-2 text-success" />
                    <h4 className="font-medium">Automático</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Configuração automática pós-instalação
                    </p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-warning" />
                    <h4 className="font-medium">Conformidade</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Registro e auditoria completos
                    </p>
                  </div>
                </div>

                <div className="text-center pt-4">
                  <Button onClick={startInstallation} size="lg" className="px-8">
                    <Download className="w-5 h-5 mr-2" />
                    Iniciar Instalação
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* System Requirements */}
            <Card>
              <CardHeader>
                <CardTitle>Requisitos do Sistema</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Sistema Operacional</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Windows 10/11 (64-bit)</li>
                      <li>• Windows Server 2016+</li>
                      <li>• macOS 10.15+</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Requisitos de Rede</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Conexão com dominio corporativo</li>
                      <li>• Acesso HTTPS à central de monitoramento</li>
                      <li>• Porta 443 liberada</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Installation Progress */}
        {isInstalling && (
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-6 bg-primary/10 rounded-full">
                  <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              </div>
              <CardTitle>Instalando CorpMonitor Agent</CardTitle>
              <p className="text-muted-foreground">
                Por favor, aguarde enquanto configuramos o sistema de monitoramento
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso da instalação</span>
                  <span>{installProgress}%</span>
                </div>
                <Progress value={installProgress} className="h-2" />
              </div>

              <div className="text-sm text-muted-foreground">
                <p>
                  {installProgress < 20 && "Verificando requisitos do sistema..."}
                  {installProgress >= 20 && installProgress < 40 && "Baixando componentes necessários..."}
                  {installProgress >= 40 && installProgress < 60 && "Instalando serviços de monitoramento..."}
                  {installProgress >= 60 && installProgress < 80 && "Configurando conexão com servidor..."}
                  {installProgress >= 80 && installProgress < 95 && "Registrando dispositivo..."}
                  {installProgress >= 95 && "Finalizando configuração..."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Installation Complete */}
        {isInstalled && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-6 bg-success/10 rounded-full">
                    <CheckCircle className="w-12 h-12 text-success" />
                  </div>
                </div>
                <CardTitle className="text-xl text-success">Instalação Concluída!</CardTitle>
                <p className="text-muted-foreground">
                  O CorpMonitor Agent foi instalado e configurado com sucesso
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-success/5 rounded-lg">
                    <h4 className="font-medium text-success mb-2">✓ Serviço Ativo</h4>
                    <p className="text-sm text-muted-foreground">
                      O agente está executando em segundo plano e conectado ao servidor central
                    </p>
                  </div>
                  <div className="p-4 bg-primary/5 rounded-lg">
                    <h4 className="font-medium text-primary mb-2">🔐 Registro Completo</h4>
                    <p className="text-sm text-muted-foreground">
                      Dispositivo registrado e configurado para monitoramento corporativo
                    </p>
                  </div>
                </div>

                <div className="text-center space-y-3">
                  <Button 
                    onClick={() => setShowTrayDemo(true)}
                    variant="outline"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Ver Status do Sistema
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    O agente será executado automaticamente na inicialização do sistema
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Tray Icon Demo */}
            {showTrayDemo && (
              <Card>
                <CardHeader>
                  <CardTitle>Ícone da Bandeja do Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center p-8 bg-muted/50 rounded-lg">
                    <div className="relative">
                      {/* Simulated System Tray */}
                      <div className="bg-gray-800 px-4 py-2 rounded flex items-center space-x-2">
                        <div className="text-white text-sm">15:42</div>
                        <div className="flex space-x-1">
                          <div className="w-4 h-4 bg-gray-600 rounded-sm"></div>
                          <div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center">
                            <Shield className="w-3 h-3 text-white" />
                          </div>
                          <div className="w-4 h-4 bg-gray-600 rounded-sm"></div>
                        </div>
                      </div>
                      
                      {/* Status Tooltip */}
                      <div className="absolute bottom-full right-0 mb-2 bg-gray-900 text-white text-xs p-2 rounded shadow-lg">
                        CorpMonitor: Conectado
                        <div className="w-3 h-3 bg-gray-900 rotate-45 absolute top-full right-4 -mt-1"></div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    O ícone azul na bandeja indica que o monitoramento está ativo
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Next Steps */}
            <Card>
              <CardHeader>
                <CardTitle>Próximos Passos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <Badge className="mt-1">1</Badge>
                    <div>
                      <p className="font-medium">Extensão do Navegador</p>
                      <p className="text-sm text-muted-foreground">
                        Instale a extensão CorpMonitor no Chrome para monitoramento web completo
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Badge className="mt-1">2</Badge>
                    <div>
                      <p className="font-medium">Política de Privacidade</p>
                      <p className="text-sm text-muted-foreground">
                        Revise a política de monitoramento corporativo e termos de uso
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Badge className="mt-1">3</Badge>
                    <div>
                      <p className="font-medium">Suporte</p>
                      <p className="text-sm text-muted-foreground">
                        Entre em contato com o TI para dúvidas ou suporte técnico
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentInstaller;