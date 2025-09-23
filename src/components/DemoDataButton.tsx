import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Play, RefreshCw } from 'lucide-react';
import { initializeDemoData } from '@/lib/demo-data';
import { useAuth } from '@/hooks/useAuth';

export const DemoDataButton = () => {
  const [loading, setLoading] = useState(false);
  const { isAdmin, isOperator } = useAuth();

  // Only show to operators and above
  if (!isOperator) {
    return null;
  }

  const handleInitialize = async () => {
    setLoading(true);
    try {
      await initializeDemoData();
    } catch (error) {
      console.error('Error initializing demo data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg text-blue-900 dark:text-blue-100">
              Dados de Demonstração
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-blue-700 border-blue-300">
            Sistema Vazio
          </Badge>
        </div>
        <CardDescription className="text-blue-700 dark:text-blue-300">
          Parece que o sistema ainda não tem dados. Crie alguns incidentes e domínios de exemplo 
          para explorar todas as funcionalidades do CorpMonitor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm text-blue-600 dark:text-blue-400">
            <strong>O que será criado:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>4 incidentes de exemplo (diferentes severidades e status)</li>
              <li>3 domínios bloqueados para demonstração</li>
              <li>Dados para testar notificações em tempo real</li>
            </ul>
          </div>
          
          <Button 
            onClick={handleInitialize}
            disabled={loading}
            className="w-full"
            variant="default"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Criando dados...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Inicializar Dados de Demo
              </>
            )}
          </Button>

          <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
            💡 Este botão só aparece quando o sistema está vazio
          </p>
        </div>
      </CardContent>
    </Card>
  );
};