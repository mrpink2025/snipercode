import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Clock, AlertCircle, XCircle } from "lucide-react";

interface CommandStatusBadgeProps {
  machineId: string;
}

const CommandStatusBadge = ({ machineId }: CommandStatusBadgeProps) => {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestCommandStatus();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('command-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'remote_commands',
          filter: `target_machine_id=eq.${machineId}`
        },
        () => {
          fetchLatestCommandStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [machineId]);

  const fetchLatestCommandStatus = async () => {
    const { data, error } = await supabase
      .from('remote_commands')
      .select('status')
      .eq('target_machine_id', machineId)
      .order('executed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching command status:', error);
      setLoading(false);
      return;
    }

    setStatus(data?.status || null);
    setLoading(false);
  };

  if (loading) {
    return <Badge variant="outline">...</Badge>;
  }

  if (!status) {
    return <Badge variant="outline">Sem comandos</Badge>;
  }

  switch (status) {
    case 'executed':
      return (
        <Badge variant="outline" className="border-green-500 text-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Executado
        </Badge>
      );
    case 'sent':
      return (
        <Badge variant="outline" className="border-blue-500 text-blue-500">
          <Clock className="h-3 w-3 mr-1" />
          Enviado
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="outline" className="border-yellow-500 text-yellow-500">
          <AlertCircle className="h-3 w-3 mr-1" />
          Pendente
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="border-red-500 text-red-500">
          <XCircle className="h-3 w-3 mr-1" />
          Falhou
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default CommandStatusBadge;
