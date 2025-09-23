import { useState, useEffect } from "react";
import { Clock, User, FileText, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import ApprovalModal from "@/components/modals/ApprovalModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PendingRequest {
  id: string;
  incident_id: string;
  justification: string;
  created_at: string;
  requested_by: string;
  approval_status: 'pending' | 'approved' | 'rejected' | 'expired';
  incidents?: {
    incident_id: string;
    host: string;
  } | null;
  profiles?: {
    full_name: string;
    email: string;
  } | null;
}

const PendingApprovals = () => {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const fetchPendingRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('raw_cookie_requests')
        .select(`
          id,
          incident_id,
          justification,
          created_at,
          requested_by,
          approval_status,
          incidents!inner(incident_id, host),
          profiles!inner(full_name, email)
        `)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const mappedRequests: PendingRequest[] = (data || []).map((item) => ({
        id: item.id,
        incident_id: item.incident_id,
        justification: item.justification,
        created_at: item.created_at,
        requested_by: item.requested_by,
        approval_status: item.approval_status as PendingRequest['approval_status'],
        incidents: item.incidents && typeof item.incidents === 'object' && 'incident_id' in item.incidents
          ? {
              incident_id: item.incidents.incident_id,
              host: item.incidents.host
            }
          : null,
        profiles: item.profiles && typeof item.profiles === 'object' && 'full_name' in (item.profiles as any)
          ? {
              full_name: (item.profiles as any).full_name || 'Usuário',
              email: (item.profiles as any).email || 'email@exemplo.com'
            }
          : null
      }));
      
      setRequests(mappedRequests);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      toast.error('Erro ao carregar solicitações pendentes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingRequests();

    // Set up real-time subscription
    const channel = supabase
      .channel('pending-approvals')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'raw_cookie_requests'
        },
        (payload) => {
          console.log('Real-time update:', payload);
          fetchPendingRequests(); // Refresh data
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleApprove = (request: PendingRequest) => {
    setSelectedRequest(request);
    setShowApprovalModal(true);
  };

  const formatRequest = (request: PendingRequest) => ({
    id: request.id,
    incidentId: request.incidents?.incident_id || request.incident_id,
    host: request.incidents?.host || 'N/A',
    category: 'Acesso a Cookie Raw',
    justification: request.justification,
    requester: request.profiles?.full_name || request.profiles?.email || 'Usuário Desconhecido',
    timestamp: request.created_at
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Aprovações Pendentes</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>Aprovações Pendentes</span>
              {requests.length > 0 && (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                  {requests.length}
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma aprovação pendente</p>
              <p className="text-sm">Todas as solicitações foram processadas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-warning" />
                        <span className="font-medium text-sm">Cookie Raw - {request.incidents?.incident_id || request.incident_id}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>{request.profiles?.full_name || request.profiles?.email}</span>
                        <span>•</span>
                        <span>{new Date(request.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Host: {request.incidents?.host || 'N/A'}
                      </div>
                    </div>
                    <Badge className="bg-warning/10 text-warning border-warning/20 shrink-0">
                      Pendente
                    </Badge>
                  </div>
                  
                  <div className="text-sm">
                    <p className="font-medium mb-1">Justificativa:</p>
                    <div className="bg-muted/50 rounded p-2 text-xs leading-relaxed">
                      {request.justification}
                    </div>
                  </div>

                  <Separator />
                  
                  <div className="flex justify-end space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleApprove(request)}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Revisar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Modal */}
      {selectedRequest && (
        <ApprovalModal
          isOpen={showApprovalModal}
          onClose={() => {
            setShowApprovalModal(false);
            setSelectedRequest(null);
            fetchPendingRequests(); // Refresh after modal closes
          }}
          request={formatRequest(selectedRequest)}
        />
      )}
    </>
  );
};

export default PendingApprovals;