import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  MessageSquare, 
  FileText, 
  Shield, 
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  HelpCircle,
  Book,
  Activity
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const supportFormSchema = z.object({
  category: z.string().min(1, "Selecione uma categoria"),
  priority: z.enum(["low", "medium", "high", "critical"]),
  subject: z.string().min(5, "O assunto deve ter no mínimo 5 caracteres").max(200),
  description: z.string().min(20, "Descreva o problema com no mínimo 20 caracteres").max(2000),
});

type SupportFormValues = z.infer<typeof supportFormSchema>;

const faqItems = [
  {
    question: "Como funciona o monitoramento de cookies?",
    answer: "O CorpMonitor coleta hashes criptografados de cookies para detectar padrões suspeitos sem armazenar dados sensíveis. Os valores reais nunca são capturados, apenas assinaturas digitais para análise de segurança."
  },
  {
    question: "Por que recebi um alerta de segurança?",
    answer: "Alertas são gerados quando: 1) Você acessa domínios monitorados pela equipe de segurança, 2) Detectamos padrões anormais de navegação, 3) Sites potencialmente perigosos são acessados. Verifique os detalhes no painel de incidentes."
  },
  {
    question: "Como bloquear ou desbloquear domínios?",
    answer: "Apenas usuários com perfil de Operador ou superior podem gerenciar bloqueios. Acesse a seção 'Controle Remoto' no menu principal e use as ferramentas de gerenciamento de domínios. Bloqueios podem ser temporários ou permanentes."
  },
  {
    question: "A extensão Chrome não está funcionando",
    answer: "Soluções comuns: 1) Verifique se está atualizada (chrome://extensions), 2) Recarregue a extensão, 3) Limpe o cache do navegador, 4) Certifique-se de que tem conexão com o servidor. Se o problema persistir, abra um ticket de suporte."
  },
  {
    question: "Quais dados são coletados e por quê? (LGPD)",
    answer: "Coletamos apenas metadados de navegação, hashes de cookies, estrutura de formulários e informações técnicas. Não capturamos senhas, conteúdo de mensagens ou dados pessoais sensíveis. Consulte nossa Política de Privacidade para detalhes completos."
  },
  {
    question: "Como gerenciar incidentes de segurança?",
    answer: "Incidentes são criados automaticamente pela extensão. Operadores podem visualizar e classificar, Aprovadores podem atribuir responsáveis, e Administradores têm acesso completo para resolver e arquivar incidentes."
  },
  {
    question: "Quais são os níveis de acesso do sistema?",
    answer: "Operator: Visualização e criação de alertas. Approver: Aprovação de ações críticas. Admin: Gerenciamento completo do sistema. Superadmin: Controle total incluindo gestão de usuários e configurações globais."
  },
  {
    question: "Como solicitar mudança de permissões?",
    answer: "Entre em contato com o departamento de Administração através do formulário de suporte na categoria 'Acesso e Permissões' ou pelo email admin@corpmonitor.com."
  }
];

const systemStatus = [
  { service: "Dashboard Web", status: "operational", icon: Activity },
  { service: "Extensão Chrome", status: "operational", icon: Shield },
  { service: "API Supabase", status: "operational", icon: FileText },
  { service: "Sistema de Alertas", status: "operational", icon: AlertCircle },
];

const Support = () => {
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SupportFormValues>({
    resolver: zodResolver(supportFormSchema),
    defaultValues: {
      priority: "medium",
      category: "",
      subject: "",
      description: "",
    },
  });

  const onSubmit = async (data: SupportFormValues) => {
    setIsSubmitting(true);
    try {
      // In a real implementation, you'd save to a support_tickets table
      console.log("Support ticket:", {
        ...data,
        user_id: profile?.id,
        user_email: profile?.email,
        created_at: new Date().toISOString(),
      });

      toast({
        title: "Ticket criado com sucesso",
        description: "Nossa equipe entrará em contato em breve.",
      });

      form.reset();
    } catch (error) {
      toast({
        title: "Erro ao enviar solicitação",
        description: "Tente novamente ou entre em contato diretamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Central de Suporte</h1>
        <p className="text-muted-foreground">
          Encontre respostas, abra tickets e acompanhe o status dos sistemas
        </p>
      </div>

      <Tabs defaultValue="faq" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto">
          <TabsTrigger value="faq">
            <HelpCircle className="h-4 w-4 mr-2" />
            FAQ
          </TabsTrigger>
          <TabsTrigger value="ticket">
            <MessageSquare className="h-4 w-4 mr-2" />
            Abrir Ticket
          </TabsTrigger>
          <TabsTrigger value="contact">
            <Mail className="h-4 w-4 mr-2" />
            Contatos
          </TabsTrigger>
          <TabsTrigger value="status">
            <Activity className="h-4 w-4 mr-2" />
            Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="faq" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Perguntas Frequentes</CardTitle>
              <CardDescription>
                Respostas para as dúvidas mais comuns sobre o CorpMonitor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {faqItems.map((item, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Book className="h-5 w-5" />
                Documentação Adicional
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Button variant="outline" className="justify-start h-auto p-4">
                  <div className="text-left">
                    <div className="font-semibold">Manual do Usuário</div>
                    <div className="text-sm text-muted-foreground">
                      Guia completo de funcionalidades
                    </div>
                  </div>
                </Button>
                <Button variant="outline" className="justify-start h-auto p-4">
                  <div className="text-left">
                    <div className="font-semibold">Guia de Instalação</div>
                    <div className="text-sm text-muted-foreground">
                      Como instalar a extensão Chrome
                    </div>
                  </div>
                </Button>
                <Button variant="outline" className="justify-start h-auto p-4">
                  <div className="text-left">
                    <div className="font-semibold">Política de Privacidade</div>
                    <div className="text-sm text-muted-foreground">
                      Como tratamos seus dados
                    </div>
                  </div>
                </Button>
                <Button variant="outline" className="justify-start h-auto p-4">
                  <div className="text-left">
                    <div className="font-semibold">API Documentation</div>
                    <div className="text-sm text-muted-foreground">
                      Para integrações avançadas
                    </div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ticket">
          <Card>
            <CardHeader>
              <CardTitle>Abrir Solicitação de Suporte</CardTitle>
              <CardDescription>
                Preencha os detalhes do seu problema e nossa equipe entrará em contato
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a categoria" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="technical">Problema Técnico</SelectItem>
                              <SelectItem value="extension">Extensão Chrome</SelectItem>
                              <SelectItem value="access">Acesso e Permissões</SelectItem>
                              <SelectItem value="compliance">Compliance/LGPD</SelectItem>
                              <SelectItem value="incident">Incidente de Segurança</SelectItem>
                              <SelectItem value="other">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prioridade</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Baixa</SelectItem>
                              <SelectItem value="medium">Média</SelectItem>
                              <SelectItem value="high">Alta</SelectItem>
                              <SelectItem value="critical">Crítica</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Crítica: Sistema parado ou dados em risco
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assunto</FormLabel>
                        <FormControl>
                          <Input placeholder="Resuma o problema em uma linha" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição Detalhada</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descreva o problema, quando ocorreu, o que você estava fazendo, mensagens de erro, etc."
                            className="min-h-[150px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Quanto mais detalhes fornecer, mais rápido poderemos ajudar
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <p className="text-sm font-semibold">Informações do Sistema (anexadas automaticamente):</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Usuário: {profile?.email}</li>
                      <li>• Perfil: {profile?.role}</li>
                      <li>• Navegador: {navigator.userAgent.split(' ').slice(-2).join(' ')}</li>
                      <li>• Data/Hora: {new Date().toLocaleString('pt-BR')}</li>
                    </ul>
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
                    {isSubmitting ? "Enviando..." : "Enviar Solicitação"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Suporte Técnico
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">suporte@corpmonitor.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Telefone</p>
                    <p className="text-sm text-muted-foreground">+55 (11) 3000-0000</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Horário</p>
                    <p className="text-sm text-muted-foreground">Seg-Sex: 8h às 18h</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Compliance e LGPD
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">dpo@corpmonitor.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Telefone</p>
                    <p className="text-sm text-muted-foreground">+55 (11) 3000-0001</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Horário</p>
                    <p className="text-sm text-muted-foreground">Seg-Sex: 9h às 17h</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Administração
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">admin@corpmonitor.com</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Para solicitações de acesso, mudança de permissões e gestão de usuários
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Emergência 24/7
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium">Telefone</p>
                    <p className="text-sm text-muted-foreground">+55 (11) 9999-9999</p>
                  </div>
                </div>
                <p className="text-sm text-destructive font-medium">
                  Apenas para incidentes críticos de segurança
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle>Status dos Sistemas</CardTitle>
              <CardDescription>
                Monitoramento em tempo real dos serviços CorpMonitor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {systemStatus.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{item.service}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="text-sm text-green-600 font-medium">
                          Operacional
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm font-semibold mb-2">Última Atualização</p>
                <p className="text-sm text-muted-foreground">
                  {new Date().toLocaleString('pt-BR')}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Support;
