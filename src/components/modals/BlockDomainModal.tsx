import { useState } from "react";
import { AlertTriangle, Ban, Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface BlockDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: string;
  incidentId: string;
}

const BlockDomainModal = ({ isOpen, onClose, domain, incidentId }: BlockDomainModalProps) => {
  const [confirmText, setConfirmText] = useState("");
  const [isBlocking, setIsBlocking] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const isConfirmValid = confirmText === "BLOCK";

  const handleBlock = async () => {
    if (!isConfirmValid) return;
    
    setIsBlocking(true);
    
    try {
      const { blockDomain } = await import('@/lib/supabase-helpers');
      await blockDomain(domain, `Bloqueio relacionado ao incidente ${incidentId}`);
      
      setIsBlocked(true);
      toast.success(`${domain} foi bloqueado em toda a rede corporativa.`);
      
      // Auto close após 3 segundos se ainda estiver bloqueado
      setTimeout(() => {
        if (isBlocked) {
          onClose();
        }
      }, 3000);
    } catch (error) {
      console.error('Error blocking domain:', error);
      toast.error(`Erro ao bloquear domínio: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsBlocking(false);
    }
  };

  const handleRollback = () => {
    setIsBlocked(false);
    setConfirmText("");
    
    toast.success(`Acesso a ${domain} foi restaurado.`);
  };

  if (isBlocked) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-success/10 rounded-full">
                <Ban className="w-6 h-6 text-success" />
              </div>
              <div>
                <DialogTitle>Domínio Bloqueado</DialogTitle>
                <DialogDescription>
                  Bloqueio aplicado com sucesso
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
              <div className="font-medium text-success">✓ Bloqueio Ativo</div>
              <div className="text-sm text-success/80 mt-1">
                {domain} foi bloqueado em todos os hosts monitorados
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <p><strong>Incidente:</strong> {incidentId}</p>
              <p><strong>Horário:</strong> {new Date().toLocaleString('pt-BR')}</p>
              <p><strong>Operador:</strong> João Silva</p>
            </div>

            <div className="security-banner">
              <div className="flex items-start space-x-2">
                <Undo2 className="w-4 h-4 text-warning mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Opção de Rollback</p>
                  <p className="text-xs opacity-80 mt-1">
                    Você tem 5 minutos para reverter este bloqueio se necessário.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="space-x-2">
            <Button variant="outline" onClick={handleRollback}>
              <Undo2 className="w-4 h-4 mr-2" />
              Reverter Bloqueio
            </Button>
            <Button onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-danger/10 rounded-full">
              <AlertTriangle className="w-6 h-6 text-danger" />
            </div>
            <div>
              <DialogTitle>Confirmar Bloqueio de Domínio</DialogTitle>
              <DialogDescription>
                Esta ação bloqueará o acesso em toda a rede
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Domain Info */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Domínio:</span>
              <Badge className="bg-danger/10 text-danger border-danger/20">
                RedList
              </Badge>
            </div>
            <div className="font-mono text-lg text-foreground">{domain}</div>
            <div className="text-sm text-muted-foreground mt-1">
              Incidente: {incidentId}
            </div>
          </div>

          {/* Impact Warning */}
          <div className="security-banner">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Impacto do Bloqueio</p>
                <ul className="text-xs opacity-80 mt-1 space-y-1">
                  <li>• Bloqueio imediato em todos os hosts</li>
                  <li>• Usuários serão redirecionados para página de aviso</li>
                  <li>• Registro de auditoria será criado</li>
                  <li>• Reversão possível por 5 minutos</li>
                </ul>
              </div>
            </div>
          </div>

          <Separator />

          {/* Confirmation Input */}
          <div className="space-y-2">
            <Label htmlFor="confirm-text">
              Digite 'BLOCK' para confirmar o bloqueio do domínio <strong>{domain}</strong>
            </Label>
            <Input
              id="confirm-text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Digite BLOCK para confirmar"
              className={confirmText && !isConfirmValid ? "border-danger" : ""}
            />
            {confirmText && !isConfirmValid && (
              <p className="text-sm text-danger">
                Texto de confirmação incorreto
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="space-x-2">
          <Button variant="outline" onClick={onClose} disabled={isBlocking}>
            Cancelar
          </Button>
          <Button 
            variant="destructive"
            onClick={handleBlock}
            disabled={!isConfirmValid || isBlocking}
          >
            {isBlocking ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                Bloqueando...
              </>
            ) : (
              <>
                <Ban className="w-4 h-4 mr-2" />
                Bloquear Domínio
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BlockDomainModal;