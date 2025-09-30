import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

export const ConnectionStatus = () => {
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [authStatus, setAuthStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const { user, session } = useAuth();

  useEffect(() => {
    // Check database connection
    const checkDB = async () => {
      try {
        const { error } = await supabase.from('profiles').select('count').limit(1);
        if (error) throw error;
        setDbStatus('connected');
      } catch (error) {
        console.error('DB health check failed:', error);
        setDbStatus('error');
      }
    };

    checkDB();
    const interval = setInterval(checkDB, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user && session) {
      setAuthStatus('connected');
    } else {
      setAuthStatus('error');
    }
  }, [user, session]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-yellow-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-3 w-3" />;
      case 'error':
        return <WifiOff className="h-3 w-3" />;
      default:
        return <AlertCircle className="h-3 w-3" />;
    }
  };

  return (
    <Card className="p-3 bg-muted/50">
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${getStatusColor(authStatus)} animate-pulse`} />
          <span className="text-muted-foreground">
            Auth: {authStatus === 'connected' ? '✓' : authStatus === 'error' ? '✗' : '...'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${getStatusColor(dbStatus)} animate-pulse`} />
          <span className="text-muted-foreground">
            DB: {dbStatus === 'connected' ? '✓' : dbStatus === 'error' ? '✗' : '...'}
          </span>
        </div>

        {user && (
          <Badge variant="outline" className="text-xs">
            {user.email}
          </Badge>
        )}
      </div>
    </Card>
  );
};
