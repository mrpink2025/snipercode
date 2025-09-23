import { useState } from "react";
import { Chrome, Download, Settings, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ExtensionPopup from "@/components/ExtensionPopup";
import { Link } from "react-router-dom";

const ExtensionDemo = () => {
  const [showPopup, setShowPopup] = useState(false);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
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
            <h1 className="text-2xl font-bold">Extensão Chrome - CorpMonitor</h1>
            <p className="text-muted-foreground">Interface de usuário final para monitoramento corporativo</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Extension Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Chrome className="w-5 h-5 text-primary" />
                <span>Visualização da Extensão</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center p-6 bg-muted/50 rounded-lg">
                <ExtensionPopup />
              </div>
              
              <div className="text-center">
                <Button onClick={() => setShowPopup(!showPopup)}>
                  {showPopup ? 'Ocultar' : 'Mostrar'} Popup da Extensão
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Installation Guide */}
          <Card>
            <CardHeader>
              <CardTitle>Guia de Instalação Corporativa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <Badge className="mt-1">1</Badge>
                  <div>
                    <p className="font-medium">Download do Pacote</p>
                    <p className="text-sm text-muted-foreground">
                      Baixe o arquivo .crx da extensão do repositório corporativo
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <Badge className="mt-1">2</Badge>
                  <div>
                    <p className="font-medium">Configuração GPO</p>
                    <p className="text-sm text-muted-foreground">
                      Configure as políticas de grupo para instalação automática
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <Badge className="mt-1">3</Badge>
                  <div>
                    <p className="font-medium">Registro de Usuários</p>
                    <p className="text-sm text-muted-foreground">
                      Usuários devem aceitar os termos na primeira execução
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-medium">Arquivos Disponíveis:</h4>
                <div className="space-y-2">
                  <Button asChild>
                    <Link to="/install-extension">
                      Instalar Extensão
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Download className="w-4 h-4 mr-2" />
                    corpmonitor-extension.crx
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Download className="w-4 h-4 mr-2" />
                    installation-guide.pdf
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Download className="w-4 h-4 mr-2" />
                    gpo-policy-template.admx
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recursos da Extensão</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-primary/5 rounded-lg">
                  <h4 className="font-medium text-primary mb-2">Coleta de Metadados</h4>
                  <p className="text-sm text-muted-foreground">
                    Coleta automatizada de hashes de cookies e metadados de navegação
                    para análise de segurança sem exposição de dados sensíveis.
                  </p>
                </div>
                
                <div className="p-4 bg-success/5 rounded-lg">
                  <h4 className="font-medium text-success mb-2">Transparência Total</h4>
                  <p className="text-sm text-muted-foreground">
                    Interface clara mostrando status de monitoramento, último relatório
                    e permitindo controle por administradores locais.
                  </p>
                </div>
                
                <div className="p-4 bg-warning/5 rounded-lg">
                  <h4 className="font-medium text-warning mb-2">Conformidade Legal</h4>
                  <p className="text-sm text-muted-foreground">
                    Processo de consentimento claro, auditoria completa e acesso
                    aos dados sensíveis apenas mediante justificativa aprovada.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technical Specs */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Especificações Técnicas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Manifest.json</h4>
                  <div className="bg-muted p-4 rounded font-mono text-sm">
                    <pre>{`{
  "manifest_version": 3,
  "name": "CorpMonitor",
  "version": "1.0.0",
  "description": "Monitoramento corporativo",
  "permissions": [
    "cookies",
    "activeTab",
    "storage"
  ],
  "host_permissions": [
    "https://*/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "128": "icon128.png"
    }
  }
}`}</pre>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Componentes React Sugeridos</h4>
                  <div className="space-y-3 text-sm">
                    <div className="p-3 bg-muted/50 rounded">
                      <code className="font-mono">OnboardingScreen.tsx</code>
                      <p className="text-muted-foreground mt-1">Tela de aceite de termos</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded">
                      <code className="font-mono">StatusPopup.tsx</code>
                      <p className="text-muted-foreground mt-1">Interface principal da extensão</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded">
                      <code className="font-mono">SettingsPanel.tsx</code>
                      <p className="text-muted-foreground mt-1">Configurações e controles</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Popup Overlay */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPopup(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <ExtensionPopup />
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtensionDemo;