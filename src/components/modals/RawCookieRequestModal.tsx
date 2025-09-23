import { useState } from "react";
import { FileText, AlertTriangle, Users, Upload } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface RawCookieRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId: string;
  host: string;
}

const RawCookieRequestModal = ({ isOpen, onClose, incidentId, host }: RawCookieRequestModalProps) => {
  const [justification, setJustification] = useState("");
  const [category, setCategory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const isFormValid = justification.trim().length >= 50 && category;

  const approvers = [
    { name: "Dr. Maria Santos", role: "CISO", status: "pending" },
    { name: "João Silva", role: "Diretor de Segurança", status: "pending" },
  ];

  const handleSubmit = async () => {
    if (!isFormValid) return;
    
    setIsSubmitting(true);
    
    // Simular envio
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      
      toast({
        title: "Solicitação enviada",
        description: "Sua solicitação de acesso ao cookie raw foi enviada para aprovação.",
      });
    }, 2000);
  };

  if (isSubmitted) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-warning/10 rounded-full">
                <Users className="w-6 h-6 text-warning" />
              </div>
              <div>
                <DialogTitle>Aguardando Aprovação</DialogTitle>
                <DialogDescription>
                  Solicitação de cookie raw enviada
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
              <div className="font-medium text-warning">📤 Solicitação Registrada</div>
              <div className="text-sm text-warning/80 mt-1">
                Sua solicitação foi enviada e está aguardando dupla aprovação
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm">
                <span className="font-medium">Incidente:</span> {incidentId}
              </div>
              <div className="text-sm">
                <span className="font-medium">Host:</span> {host}
              </div>
              <div className="text-sm">
                <span className="font-medium">Categoria:</span> {category}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium text-sm">Aprovadores Designados:</h4>
              <div className="space-y-2">
                {approvers.map((approver, index) => (
                  <Card key={index} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{approver.name}</div>
                        <div className="text-xs text-muted-foreground">{approver.role}</div>
                      </div>
                      <Badge className="bg-warning/10 text-warning border-warning/20">
                        Pendente
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div className="security-banner">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Processo de Aprovação</p>
                  <p className="text-xs opacity-80 mt-1">
                    O cookie raw será entregue apenas após aprovação de ambos os aprovadores. 
                    Você receberá notificação do resultado.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-warning/10 rounded-full">
              <FileText className="w-6 h-6 text-warning" />
            </div>
            <div>
              <DialogTitle>Solicitar Cookie (Raw)</DialogTitle>
              <DialogDescription>
                Acesso a dados sensíveis requer justificativa e dupla aprovação
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Incident Info */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-medium">Incidente:</span> {incidentId}</div>
              <div><span className="font-medium">Host:</span> {host}</div>
            </div>
          </div>

          {/* Security Warning */}
          <div className="security-banner">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Exibição condicionada: cadastro e registro obrigatório</p>
                <p className="text-xs opacity-80 mt-1">
                  Esta solicitação será auditada e requer justificativa detalhada
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoria *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fraude">Investigação de Fraude</SelectItem>
                  <SelectItem value="data-leak">Vazamento de Dados</SelectItem>
                  <SelectItem value="security-incident">Incidente de Segurança</SelectItem>
                  <SelectItem value="compliance">Auditoria de Compliance</SelectItem>
                  <SelectItem value="forensic">Análise Forense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="justification">
                Justificativa * 
                <span className="text-xs text-muted-foreground ml-1">
                  (mínimo 50 caracteres)
                </span>
              </Label>
              <Textarea
                id="justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Descreva detalhadamente a necessidade de acesso ao cookie raw, incluindo como será utilizado na investigação..."
                className="min-h-[100px]"
              />
              <div className="text-xs text-muted-foreground text-right">
                {justification.length}/50 caracteres mínimos
              </div>
            </div>

            <div className="space-y-2">
              <Label>Anexos (opcional)</Label>
              <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center">
                <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Arraste arquivos ou clique para anexar documentos de suporte
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, DOC, XLS até 10MB
                </p>
              </div>
            </div>
          </div>

          {/* Approval Process Info */}
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <h4 className="font-medium text-sm text-primary mb-2">Processo de Aprovação:</h4>
            <div className="text-xs text-primary/80 space-y-1">
              <p>1. Solicitação registrada no sistema de auditoria</p>
              <p>2. Aprovação necessária de 2 supervisores</p>
              <p>3. Cookie raw entregue via canal seguro</p>
              <p>4. Acesso registrado permanentemente</p>
            </div>
          </div>
        </div>

        <DialogFooter className="space-x-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Enviar Solicitação
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RawCookieRequestModal;