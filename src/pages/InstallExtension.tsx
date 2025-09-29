import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Download, Chrome, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function InstallExtension() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [downloadStarted, setDownloadStarted] = useState(false);

  useEffect(() => {
    // Real extension detection using message passing
    const checkExtensionInstalled = () => {
      try {
        // Try to communicate with the extension
        const extensionId = 'corpmonitor-extension'; // This will be the actual ID
        
        // Listen for extension messages
        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'CORPMONITOR_EXTENSION_DETECTED') {
            setIsInstalled(true);
            localStorage.setItem('corpmonitor-extension-installed', 'true');
            localStorage.setItem('corpmonitor-extension-version', event.data.version || '1.0.0');
          }
        };

        window.addEventListener('message', handleMessage);
        
        // Check existing localStorage state
        const installed = localStorage.getItem('corpmonitor-extension-installed') === 'true';
        if (installed) {
          setIsInstalled(true);
        }

        // Try to ping extension by creating a hidden iframe that might trigger extension
        const checkFrame = document.createElement('iframe');
        checkFrame.style.display = 'none';
        checkFrame.src = 'chrome-extension://invalid/popup.html'; // This will fail but might trigger extension detection
        document.body.appendChild(checkFrame);
        
        setTimeout(() => {
          document.body.removeChild(checkFrame);
        }, 1000);

        return () => {
          window.removeEventListener('message', handleMessage);
        };
      } catch (error) {
        console.log('Extension detection method not available');
      }
    };

    const cleanup = checkExtensionInstalled();
    const interval = setInterval(checkExtensionInstalled, 3000);
    
    return () => {
      cleanup?.();
      clearInterval(interval);
    };
  }, []);

  const handleDownloadExtension = async () => {
    setDownloadStarted(true);
    setCurrentStep(2);
    
    try {
      // Try to download the actual CRX file
      const response = await fetch('/chrome-extension/corpmonitor-extension.crx');
      
      if (response.ok) {
        // File exists, proceed with download
        const link = document.createElement('a');
        link.href = '/chrome-extension/corpmonitor-extension.crx';
        link.download = 'corpmonitor-extension.crx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success('Download iniciado! Siga as instruções abaixo.');
      } else {
        // Fallback to ZIP file
        const link = document.createElement('a');
        link.href = '/chrome-extension/corpmonitor-extension.zip';
        link.download = 'corpmonitor-extension.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.info('Baixando arquivo ZIP. Extraia e carregue como extensão sem compactação.');
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Erro no download. Tente o método de instalação manual.');
    }
  };

  const handleManualInstall = () => {
    window.open('chrome://extensions/', '_blank');
    setCurrentStep(3);
  };

  const steps = [
    {
      number: 1,
      title: 'Download da Extensão',
      description: 'Baixe o arquivo da extensão CorpMonitor',
      completed: downloadStarted
    },
    {
      number: 2,
      title: 'Abrir Configurações do Chrome',
      description: 'Acesse chrome://extensions/ no seu navegador',
      completed: currentStep >= 3
    },
    {
      number: 3,
      title: 'Ativar Modo Desenvolvedor',
      description: 'Ative o "Modo do desenvolvedor" no canto superior direito',
      completed: false
    },
    {
      number: 4,
      title: 'Instalar Extensão',
      description: 'Arraste o arquivo .crx baixado para a página de extensões',
      completed: isInstalled
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Instalação da Extensão CorpMonitor
          </h1>
          <p className="text-muted-foreground text-lg">
            Instale a extensão Chrome para monitoramento corporativo em 4 passos simples
          </p>
        </div>

        {isInstalled ? (
          <Alert className="mb-8 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              ✅ Extensão CorpMonitor instalada com sucesso! Você pode encontrá-la na barra de ferramentas do Chrome.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="mb-8">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              A instalação automática via web não é possível devido às políticas de segurança do Chrome. 
              Siga os passos abaixo para instalar manualmente.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Download Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Download Rápido
              </CardTitle>
              <CardDescription>
                Baixe a extensão empacotada pronta para instalação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button 
                  onClick={handleDownloadExtension}
                  disabled={downloadStarted}
                  className="w-full"
                  size="lg"
                >
                  {downloadStarted ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Download Iniciado
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Baixar Extensão (.crx)
                    </>
                  )}
                </Button>
                
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Arquivo: corpmonitor-extension.crx</p>
                  <p>• Tamanho: ~50KB</p>
                  <p>• Versão: 1.0.0</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Browser Detection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Chrome className="h-5 w-5" />
                Compatibilidade
              </CardTitle>
              <CardDescription>
                Verificação do navegador e sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>Navegador:</span>
                  <Badge variant="outline">
                    {navigator.userAgent.includes('Chrome') ? 'Chrome ✓' : 'Não Chrome ⚠️'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Sistema:</span>
                  <Badge variant="outline">
                    {navigator.platform}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Suporte:</span>
                  <Badge variant="outline">
                    Manifest V3 ✓
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Installation Steps */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Passos de Instalação</CardTitle>
            <CardDescription>
              Siga as instruções na ordem para instalar a extensão
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                    step.completed 
                      ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                      : currentStep === step.number 
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
                        : 'bg-muted/50'
                  }`}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    step.completed 
                      ? 'bg-green-600 text-white' 
                      : currentStep === step.number
                        ? 'bg-blue-600 text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {step.completed ? <CheckCircle2 className="h-4 w-4" /> : step.number}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{step.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                    
                    {step.number === 2 && currentStep >= 2 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={handleManualInstall}
                      >
                        <ExternalLink className="mr-2 h-3 w-3" />
                        Abrir chrome://extensions/
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alternative Methods */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Métodos Alternativos</CardTitle>
            <CardDescription>
              Outras formas de instalar a extensão
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Modo Desenvolvedor</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Instale diretamente da pasta de desenvolvimento
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Ver Instruções Detalhadas
                </Button>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Instalação Corporativa</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Para administradores de TI via GPO
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Guia para Admins
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}