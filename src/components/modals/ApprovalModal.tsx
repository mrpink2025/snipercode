import { useState } from "react";
import { CheckCircle, XCircle, Lock, FileText, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: {
    id: string;
    incidentId: string;
    host: string;
    category: string;
    justification: string;
    requester: string;
    timestamp: string;
  };
}

const ApprovalModal = ({ isOpen, onClose, request }: ApprovalModalProps) => {
  const [comment, setComment] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);

  const handleDecision = async (action: 'approve' | 'reject') => {
    if (action === 'approve' && !mfaCode) {
      toast.error("Código MFA é obrigatório para aprovações.");
      return;
    }

    setIsProcessing(true);
    setDecision(action);
    
    try {
      const { approveRequest } = await import('@/lib/supabase-helpers');
      await approveRequest(request.id, action === 'approve', comment);
      
      if (action === 'approve') {
        toast.success(`Acesso ao cookie raw foi aprovado para ${request.incidentId}.`);
      } else {
        toast.success(`Solicitação foi rejeitada e o solicitante foi notificado.`);
      }
      
      onClose();
    } catch (error) {
      console.error('Error processing approval:', error);
      toast.error(`Erro ao processar ${action === 'approve' ? 'aprovação' : 'rejeição'}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsProcessing(false);
      setDecision(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Aprovar solicitação de acesso a cookie?</DialogTitle>
          <DialogDescription>
            Revise cuidadosamente os detalhes antes de tomar uma decisão
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Request Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>Resumo da Solicitação</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-sm">ID da Solicitação:</span>
                  <p className="font-mono text-sm">{request.id}</p>
                </div>
                <div>
                  <span className="font-medium text-sm">Incidente:</span>
                  <p className="font-mono text-sm">{request.incidentId}</p>
                </div>
                <div>
                  <span className="font-medium text-sm">Host:</span>
                  <p className="font-mono text-sm">{request.host}</p>
                </div>
                <div>
                  <span className="font-medium text-sm">Categoria:</span>
                  <Badge className="ml-1">{request.category}</Badge>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <span className="font-medium text-sm">Solicitante:</span>
                <div className="flex items-center space-x-2 mt-1">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{request.requester}</span>
                  <span className="text-xs text-muted-foreground">
                    • {new Date(request.timestamp).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Justification */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Justificativa Apresentada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-sm leading-relaxed">
                  {request.justification}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Approval Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Processo de Aprovação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* MFA */}
              <div className="space-y-2">
                <Label htmlFor="mfa-code" className="flex items-center space-x-2">
                  <Lock className="w-4 h-4" />
                  <span>Assinatura MFA *</span>
                </Label>
                <Input
                  id="mfa-code"
                  type="password"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="Digite seu código MFA"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Código de autenticação necessário para validar a aprovação
                </p>
              </div>

              {/* Comment */}
              <div className="space-y-2">
                <Label htmlFor="comment">Comentário (opcional)</Label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Adicione observações sobre esta aprovação..."
                  className="min-h-[80px]"
                />
              </div>

              {/* Security Notice */}
              <div className="security-banner">
                <div className="text-sm">
                  <p className="font-medium">⚠️ Registro de Auditoria</p>
                  <p className="text-xs opacity-80 mt-1">
                    Esta aprovação será registrada permanentemente no sistema de auditoria 
                    e associada ao seu usuário corporativo.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="space-x-2">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={isProcessing}
          >
            Cancelar
          </Button>
          <Button 
            variant="destructive"
            onClick={() => handleDecision('reject')}
            disabled={isProcessing}
          >
            {isProcessing && decision === 'reject' ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                Rejeitando...
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                Rejeitar
              </>
            )}
          </Button>
          <Button 
            onClick={() => handleDecision('approve')}
            disabled={isProcessing || !mfaCode}
          >
            {isProcessing && decision === 'approve' ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                Aprovando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Aprovar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApprovalModal;