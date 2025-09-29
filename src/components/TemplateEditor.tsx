import { useState, useEffect } from "react";
import { Code2, Eye, Save, Trash2, Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  domain: string | null;
  html_content: string;
  css_styles: string | null;
  is_default: boolean;
  created_at: string;
}

const DEFAULT_TEMPLATES = {
  corporate_warning: {
    name: "Aviso Corporativo",
    html: `<div class="popup-container">
  <div class="popup-header">
    <span class="popup-icon">⚠️</span>
    <h2>Aviso Corporativo</h2>
  </div>
  <div class="popup-body">
    <p>O site <strong>{{domain}}</strong> está sendo monitorado pela administração.</p>
    <p class="popup-info">Data: {{timestamp}}</p>
  </div>
  <div class="popup-footer">
    <button class="popup-btn-primary" onclick="this.closest('.popup-overlay').remove()">Entendi</button>
  </div>
</div>`,
    css: `.popup-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 999999; display: flex; align-items: center; justify-content: center; font-family: system-ui; }
.popup-container { background: white; border-radius: 12px; padding: 0; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); animation: popup-appear 0.3s ease; }
.popup-header { background: linear-gradient(135deg, #e11d48, #be123c); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
.popup-icon { font-size: 48px; display: block; margin-bottom: 12px; }
.popup-header h2 { margin: 0; font-size: 24px; font-weight: 600; }
.popup-body { padding: 24px; }
.popup-body p { margin: 8px 0; color: #334155; line-height: 1.6; }
.popup-info { font-size: 14px; color: #64748b; margin-top: 16px; }
.popup-footer { padding: 0 24px 24px; text-align: center; }
.popup-btn-primary { background: #e11d48; color: white; border: none; padding: 12px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.popup-btn-primary:hover { background: #be123c; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(225, 29, 72, 0.4); }
@keyframes popup-appear { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }`
  },
  blocking_notice: {
    name: "Aviso de Bloqueio",
    html: `<div class="popup-container">
  <div class="popup-header blocking">
    <span class="popup-icon">🚫</span>
    <h2>Acesso Bloqueado</h2>
  </div>
  <div class="popup-body">
    <p>O acesso ao site <strong>{{domain}}</strong> foi bloqueado pela política corporativa.</p>
    <p>Se você acredita que isso é um erro, contate o administrador.</p>
    <p class="popup-info">Máquina: {{machine_id}}</p>
  </div>
  <div class="popup-footer">
    <button class="popup-btn-danger" onclick="window.close()">Fechar</button>
  </div>
</div>`,
    css: `.popup-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 999999; display: flex; align-items: center; justify-content: center; font-family: system-ui; }
.popup-container { background: white; border-radius: 12px; padding: 0; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
.popup-header.blocking { background: linear-gradient(135deg, #dc2626, #991b1b); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
.popup-icon { font-size: 48px; display: block; margin-bottom: 12px; }
.popup-header h2 { margin: 0; font-size: 24px; font-weight: 600; }
.popup-body { padding: 24px; }
.popup-body p { margin: 8px 0; color: #334155; line-height: 1.6; }
.popup-info { font-size: 14px; color: #64748b; margin-top: 16px; }
.popup-footer { padding: 0 24px 24px; text-align: center; }
.popup-btn-danger { background: #dc2626; color: white; border: none; padding: 12px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.popup-btn-danger:hover { background: #991b1b; }`
  },
  monitoring_alert: {
    name: "Alerta de Monitoramento",
    html: `<div class="popup-container">
  <div class="popup-header monitoring">
    <span class="popup-icon">👁️</span>
    <h2>Site Monitorado</h2>
  </div>
  <div class="popup-body">
    <p>Este site está sendo monitorado em tempo real.</p>
    <p>Todas as atividades estão sendo registradas para fins de auditoria.</p>
    <p class="popup-info">URL: {{url}}</p>
  </div>
  <div class="popup-footer">
    <button class="popup-btn-info" onclick="this.closest('.popup-overlay').remove()">Continuar</button>
  </div>
</div>`,
    css: `.popup-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 999999; display: flex; align-items: center; justify-content: center; font-family: system-ui; }
.popup-container { background: white; border-radius: 12px; padding: 0; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
.popup-header.monitoring { background: linear-gradient(135deg, #0284c7, #0369a1); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
.popup-icon { font-size: 48px; display: block; margin-bottom: 12px; }
.popup-header h2 { margin: 0; font-size: 24px; font-weight: 600; }
.popup-body { padding: 24px; }
.popup-body p { margin: 8px 0; color: #334155; line-height: 1.6; }
.popup-info { font-size: 14px; color: #64748b; margin-top: 16px; font-family: monospace; word-break: break-all; }
.popup-footer { padding: 0 24px 24px; text-align: center; }
.popup-btn-info { background: #0284c7; color: white; border: none; padding: 12px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.popup-btn-info:hover { background: #0369a1; }`
  }
};

export const TemplateEditor = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [editMode, setEditMode] = useState<'view' | 'edit' | 'new'>('view');
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    html_content: '',
    css_styles: '',
    is_default: false
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('popup_templates')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Erro ao carregar templates');
      return;
    }
    
    setTemplates(data || []);
  };

  const handleSave = async () => {
    try {
      if (editMode === 'new') {
        const { error } = await supabase
          .from('popup_templates')
          .insert([{ ...formData, created_by: (await supabase.auth.getUser()).data.user?.id }]);
        
        if (error) throw error;
        toast.success('Template criado com sucesso!');
      } else {
        const { error } = await supabase
          .from('popup_templates')
          .update(formData)
          .eq('id', selectedTemplate?.id);
        
        if (error) throw error;
        toast.success('Template atualizado!');
      }
      
      fetchTemplates();
      setEditMode('view');
      setSelectedTemplate(null);
    } catch (error) {
      toast.error('Erro ao salvar template');
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este template?')) return;
    
    const { error } = await supabase
      .from('popup_templates')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Erro ao excluir template');
      return;
    }
    
    toast.success('Template excluído!');
    fetchTemplates();
  };

  const handleDuplicate = async (template: Template) => {
    const { error } = await supabase
      .from('popup_templates')
      .insert([{
        name: `${template.name} (Cópia)`,
        domain: template.domain,
        html_content: template.html_content,
        css_styles: template.css_styles,
        is_default: false,
        created_by: (await supabase.auth.getUser()).data.user?.id
      }]);
    
    if (error) {
      toast.error('Erro ao duplicar template');
      return;
    }
    
    toast.success('Template duplicado!');
    fetchTemplates();
  };

  const createDefaultTemplate = async (key: keyof typeof DEFAULT_TEMPLATES) => {
    const template = DEFAULT_TEMPLATES[key];
    const { error } = await supabase
      .from('popup_templates')
      .insert([{
        name: template.name,
        html_content: template.html,
        css_styles: template.css,
        is_default: false,
        created_by: (await supabase.auth.getUser()).data.user?.id
      }]);
    
    if (error) {
      toast.error('Erro ao criar template padrão');
      return;
    }
    
    toast.success('Template padrão criado!');
    fetchTemplates();
  };

  const startEdit = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      domain: template.domain || '',
      html_content: template.html_content,
      css_styles: template.css_styles || '',
      is_default: template.is_default
    });
    setEditMode('edit');
  };

  const startNew = () => {
    setSelectedTemplate(null);
    setFormData({
      name: '',
      domain: '',
      html_content: '',
      css_styles: '',
      is_default: false
    });
    setEditMode('new');
  };

  const renderPreview = () => {
    const html = formData.html_content
      .replace(/\{\{domain\}\}/g, 'exemplo.com')
      .replace(/\{\{url\}\}/g, 'https://exemplo.com/pagina')
      .replace(/\{\{timestamp\}\}/g, new Date().toLocaleString('pt-BR'))
      .replace(/\{\{machine_id\}\}/g, 'MACHINE-123')
      .replace(/\{\{user_name\}\}/g, 'Usuário Exemplo');

    return (
      <div className="border rounded-lg p-4 bg-muted/50">
        <style>{formData.css_styles}</style>
        <div className="popup-overlay" style={{ position: 'relative', height: '400px' }}>
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    );
  };

  if (editMode !== 'view') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            {editMode === 'new' ? 'Novo Template' : 'Editar Template'}
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditMode('view')}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Salvar
            </Button>
          </div>
        </div>

        <Tabs defaultValue="html" className="space-y-4">
          <TabsList>
            <TabsTrigger value="html">
              <Code2 className="w-4 h-4 mr-2" />
              HTML
            </TabsTrigger>
            <TabsTrigger value="css">CSS</TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="html" className="space-y-4">
            <div>
              <Label>HTML do Template</Label>
              <Textarea
                value={formData.html_content}
                onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
                className="font-mono text-sm min-h-[400px]"
                placeholder="<div>Template HTML...</div>"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Variáveis disponíveis: {'{{domain}}'}, {'{{url}}'}, {'{{timestamp}}'}, {'{{machine_id}}'}, {'{{user_name}}'}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="css" className="space-y-4">
            <div>
              <Label>CSS do Template</Label>
              <Textarea
                value={formData.css_styles}
                onChange={(e) => setFormData({ ...formData, css_styles: e.target.value })}
                className="font-mono text-sm min-h-[400px]"
                placeholder=".popup { ... }"
              />
            </div>
          </TabsContent>

          <TabsContent value="preview">
            <div>
              <Label>Preview do Template</Label>
              {renderPreview()}
            </div>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <div>
              <Label>Nome do Template</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do template"
              />
            </div>
            <div>
              <Label>Domínio (opcional)</Label>
              <Input
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                placeholder="exemplo.com (deixe vazio para uso geral)"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Templates de Popup</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => createDefaultTemplate('corporate_warning')}>
            Aviso Corporativo
          </Button>
          <Button variant="outline" onClick={() => createDefaultTemplate('blocking_notice')}>
            Bloqueio
          </Button>
          <Button variant="outline" onClick={() => createDefaultTemplate('monitoring_alert')}>
            Monitoramento
          </Button>
          <Button onClick={startNew}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>{template.name}</span>
                {template.is_default && <Badge>Padrão</Badge>}
              </CardTitle>
              {template.domain && (
                <Badge variant="outline" className="w-fit">
                  {template.domain}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(template)}>
                  <Code2 className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDuplicate(template)}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(template.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
