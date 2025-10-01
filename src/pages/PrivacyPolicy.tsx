import { Shield, Lock, Eye, FileText, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/95 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Política de Privacidade</h1>
            </div>
            <Button variant="outline" onClick={() => navigate(-1)}>
              Voltar
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8 max-w-5xl">
        {/* Introduction Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-xl">CorpMonitor - Sistema de Segurança Corporativa</CardTitle>
              <Badge variant="outline" className="text-success border-success/20 bg-success/10">
                Vigente
              </Badge>
            </div>
            <CardDescription className="text-base">
              <strong>Última atualização:</strong> {new Date().toLocaleDateString('pt-BR')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Esta Política de Privacidade descreve como o <strong>CorpMonitor</strong>, sistema de monitoramento 
              e segurança corporativa, coleta, utiliza, armazena e protege os dados durante o uso de dispositivos 
              corporativos e acesso a recursos da organização.
            </p>
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Aviso Importante</p>
                  <p className="text-sm text-muted-foreground">
                    O uso de dispositivos corporativos e acesso aos sistemas da empresa implica na aceitação 
                    integral desta política. O CorpMonitor é uma ferramenta de segurança corporativa destinada 
                    exclusivamente ao ambiente profissional.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Collection */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Eye className="w-5 h-5 text-primary" />
              <CardTitle>1. Dados Coletados</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold mb-2 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span>1.1. Metadados de Navegação</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-6">
                <li>URLs visitadas e títulos de páginas</li>
                <li>Timestamps (data e hora) de acesso</li>
                <li>Domínios e subdomínios acessados</li>
                <li>Referrers e origem de navegação</li>
              </ul>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span>1.2. Informações de Cookies (Criptografadas)</span>
              </h4>
              <p className="text-muted-foreground mb-2">
                O sistema coleta <strong>hashes criptográficos</strong> de cookies, <strong>não os valores reais</strong>:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-6">
                <li>Hash SHA-256 dos valores de cookies</li>
                <li>Nomes de cookies (sem valores sensíveis)</li>
                <li>Domínios associados aos cookies</li>
                <li>Datas de expiração</li>
              </ul>
              <div className="bg-success/10 border border-success/20 rounded p-3 mt-3">
                <p className="text-sm text-muted-foreground">
                  <strong>Nota de Segurança:</strong> Os valores reais dos cookies nunca são armazenados. 
                  Apenas representações criptográficas irreversíveis são mantidas para detecção de anomalias.
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span>1.3. Estrutura de Formulários</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-6">
                <li>Nomes e IDs dos campos de formulário</li>
                <li>Tipos de input (text, password, email, etc.)</li>
                <li>Estrutura HTML de formulários</li>
                <li><strong>Valores de formulários NÃO são coletados</strong></li>
              </ul>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span>1.4. Informações de Sessão</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-6">
                <li>ID do usuário corporativo</li>
                <li>ID da máquina/dispositivo</li>
                <li>IDs de abas e sessões de navegação</li>
                <li>Duração e atividade das sessões</li>
                <li>Status de atividade (ativo/inativo)</li>
              </ul>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span>1.5. Chaves de Armazenamento Local</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-6">
                <li>Chaves do localStorage (sem valores)</li>
                <li>Chaves do sessionStorage (sem valores)</li>
                <li>Análise de padrões de armazenamento</li>
              </ul>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span>1.6. Dados Técnicos</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-6">
                <li>User-Agent e informações do navegador</li>
                <li>Versão da extensão CorpMonitor</li>
                <li>Endereço IP (para auditoria)</li>
                <li>Elementos de tracking detectados</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Purpose */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-primary" />
              <CardTitle>2. Finalidades do Tratamento</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Os dados coletados são utilizados exclusivamente para as seguintes finalidades legítimas:
            </p>
            
            <div className="grid gap-4">
              <div className="flex items-start space-x-3 bg-card-hover p-4 rounded-lg">
                <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-medium mb-1">Segurança da Informação</h5>
                  <p className="text-sm text-muted-foreground">
                    Detecção de ameaças, vazamentos de dados e atividades suspeitas em tempo real.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 bg-card-hover p-4 rounded-lg">
                <Lock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-medium mb-1">Prevenção de Fraudes</h5>
                  <p className="text-sm text-muted-foreground">
                    Identificação de padrões anormais e potenciais tentativas de fraude corporativa.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 bg-card-hover p-4 rounded-lg">
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-medium mb-1">Compliance e Conformidade</h5>
                  <p className="text-sm text-muted-foreground">
                    Garantir o cumprimento de políticas corporativas, regulamentações setoriais e normas legais.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 bg-card-hover p-4 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-medium mb-1">Investigação de Incidentes</h5>
                  <p className="text-sm text-muted-foreground">
                    Análise forense e investigação de incidentes de segurança reportados.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 bg-card-hover p-4 rounded-lg">
                <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-medium mb-1">Auditoria e Relatórios</h5>
                  <p className="text-sm text-muted-foreground">
                    Geração de relatórios para auditorias internas, externas e autoridades reguladoras.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legal Basis */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-primary" />
              <CardTitle>3. Base Legal (LGPD - Lei Geral de Proteção de Dados)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              O tratamento de dados pelo CorpMonitor está fundamentado nas seguintes bases legais 
              previstas na LGPD (Lei nº 13.709/2018):
            </p>

            <div className="space-y-3">
              <div className="border-l-4 border-primary pl-4 py-2">
                <h5 className="font-semibold mb-1">Art. 7º, IX - Legítimo Interesse</h5>
                <p className="text-sm text-muted-foreground">
                  A empresa possui legítimo interesse na proteção de seus ativos, informações confidenciais 
                  e prevenção de fraudes, em conformidade com as expectativas razoáveis do titular.
                </p>
              </div>

              <div className="border-l-4 border-primary pl-4 py-2">
                <h5 className="font-semibold mb-1">Art. 7º, II - Cumprimento de Obrigação Legal</h5>
                <p className="text-sm text-muted-foreground">
                  Diversas regulamentações setoriais (bancárias, financeiras, saúde) exigem controles 
                  de segurança e rastreabilidade de acessos a dados sensíveis.
                </p>
              </div>

              <div className="border-l-4 border-primary pl-4 py-2">
                <h5 className="font-semibold mb-1">Art. 7º, X - Proteção do Crédito</h5>
                <p className="text-sm text-muted-foreground">
                  Para instituições financeiras, o monitoramento é necessário para proteção do crédito 
                  e prevenção de fraudes que possam afetar operações financeiras.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Sharing */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Lock className="w-5 h-5 text-primary" />
              <CardTitle>4. Compartilhamento de Dados</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-card-hover border border-border rounded-lg p-4">
              <h5 className="font-semibold mb-2">Compartilhamento Interno</h5>
              <p className="text-sm text-muted-foreground mb-3">
                Os dados coletados permanecem internos à organização e o acesso é estritamente controlado 
                por níveis hierárquicos:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                <li><strong>Superadmin:</strong> Acesso total a todos os recursos e dados</li>
                <li><strong>Admin:</strong> Gerenciamento de configurações e incidentes</li>
                <li><strong>Approver:</strong> Aprovação de exceções e bloqueios</li>
                <li><strong>Operator:</strong> Visualização de alertas e monitoramento básico</li>
              </ul>
            </div>

            <Separator />

            <div className="bg-card-hover border border-border rounded-lg p-4">
              <h5 className="font-semibold mb-2">Compartilhamento Externo</h5>
              <p className="text-sm text-muted-foreground">
                Os dados <strong>não são compartilhados com terceiros</strong>, exceto nas seguintes situações 
                legalmente previstas:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4 mt-2">
                <li>Quando exigido por autoridades judiciais ou reguladoras</li>
                <li>Para cumprimento de obrigações legais e regulatórias</li>
                <li>Em processos de auditoria externa ou due diligence (com NDA)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Security & Retention */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle>5. Segurança e Retenção de Dados</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h5 className="font-semibold mb-3">Medidas de Segurança Implementadas</h5>
              <div className="grid gap-3">
                <div className="flex items-start space-x-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    <strong>Criptografia:</strong> Todos os dados em trânsito utilizam TLS 1.3 e dados em repouso 
                    são criptografados com AES-256
                  </span>
                </div>
                <div className="flex items-start space-x-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    <strong>Row Level Security (RLS):</strong> Políticas de acesso em nível de banco de dados 
                    garantem segregação de dados
                  </span>
                </div>
                <div className="flex items-start space-x-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    <strong>Autenticação JWT:</strong> Tokens seguros com expiração controlada para acesso 
                    ao sistema
                  </span>
                </div>
                <div className="flex items-start space-x-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    <strong>Controles de Acesso:</strong> Sistema de permissões baseado em funções (RBAC) 
                    com princípio do menor privilégio
                  </span>
                </div>
                <div className="flex items-start space-x-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    <strong>Audit Trail:</strong> Registro imutável de todas as ações administrativas e 
                    acessos aos dados
                  </span>
                </div>
                <div className="flex items-start space-x-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    <strong>Hashing Irreversível:</strong> Cookies são convertidos em hashes SHA-256, 
                    impossibilitando recuperação dos valores originais
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h5 className="font-semibold mb-2 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-primary" />
                <span>Período de Retenção</span>
              </h5>
              <div className="bg-card-hover border border-border rounded-lg p-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong>Dados de monitoramento ativo:</strong> Retidos enquanto a sessão estiver ativa 
                  + 90 dias
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Incidentes de segurança:</strong> Retidos por 5 anos para fins de auditoria e 
                  investigação
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Logs de auditoria:</strong> Retidos por 7 anos em conformidade com requisitos 
                  regulatórios
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Dados de ex-colaboradores:</strong> Anonimizados após 30 dias do desligamento, 
                  exceto dados sujeitos a obrigações legais
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Subject Rights */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Eye className="w-5 h-5 text-primary" />
              <CardTitle>6. Direitos dos Titulares de Dados</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Em conformidade com a LGPD, os colaboradores possuem os seguintes direitos, 
              observadas as limitações legais e contratuais do ambiente corporativo:
            </p>

            <div className="space-y-3">
              <div className="border-l-4 border-primary pl-4 py-2">
                <h5 className="font-semibold mb-1">Confirmação e Acesso</h5>
                <p className="text-sm text-muted-foreground">
                  Direito de obter confirmação sobre o tratamento de seus dados e acessar os dados pessoais 
                  coletados pelo sistema.
                </p>
              </div>

              <div className="border-l-4 border-primary pl-4 py-2">
                <h5 className="font-semibold mb-1">Correção de Dados</h5>
                <p className="text-sm text-muted-foreground">
                  Direito de solicitar a correção de dados pessoais incompletos, inexatos ou desatualizados 
                  (perfil de usuário).
                </p>
              </div>

              <div className="border-l-4 border-primary pl-4 py-2">
                <h5 className="font-semibold mb-1">Portabilidade</h5>
                <p className="text-sm text-muted-foreground">
                  Direito de solicitar a portabilidade de dados pessoais a outro fornecedor, quando aplicável 
                  e tecnicamente viável.
                </p>
              </div>

              <div className="border-l-4 border-warning pl-4 py-2">
                <h5 className="font-semibold mb-1 text-warning">Limitações no Ambiente Corporativo</h5>
                <p className="text-sm text-muted-foreground">
                  Devido à natureza de segurança do sistema e obrigações legais da empresa, alguns direitos 
                  podem ter aplicação limitada:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4 mt-2">
                  <li>Dados de auditoria não podem ser excluídos por obrigações legais</li>
                  <li>Logs de incidentes de segurança são preservados para investigação</li>
                  <li>A oposição ao tratamento pode ser incompatível com o vínculo empregatício</li>
                </ul>
              </div>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mt-4">
              <h5 className="font-semibold mb-2">Como Exercer Seus Direitos</h5>
              <p className="text-sm text-muted-foreground">
                Para exercer qualquer dos direitos acima, entre em contato com o Encarregado de Dados (DPO) 
                através dos canais indicados na seção de contatos.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact & Governance */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-primary" />
              <CardTitle>7. Contatos e Governança</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-card-hover border border-border rounded-lg p-4">
                <h5 className="font-semibold mb-2">Encarregado de Dados (DPO)</h5>
                <p className="text-sm text-muted-foreground mb-2">
                  Responsável pela proteção de dados e canal direto para exercício de direitos:
                </p>
                <p className="text-sm">
                  <strong>E-mail:</strong> dpo@suaempresa.com.br
                </p>
              </div>

              <div className="bg-card-hover border border-border rounded-lg p-4">
                <h5 className="font-semibold mb-2">Canal de Compliance</h5>
                <p className="text-sm text-muted-foreground mb-2">
                  Para questões relacionadas à conformidade e reclamações:
                </p>
                <p className="text-sm">
                  <strong>E-mail:</strong> compliance@suaempresa.com.br
                </p>
              </div>
            </div>

            <Separator />

            <div className="bg-card-hover border border-border rounded-lg p-4">
              <h5 className="font-semibold mb-2">Autoridade Nacional de Proteção de Dados (ANPD)</h5>
              <p className="text-sm text-muted-foreground">
                Caso suas solicitações não sejam atendidas de forma satisfatória, você tem o direito de 
                apresentar reclamação à ANPD:
              </p>
              <p className="text-sm mt-2">
                <strong>Website:</strong> <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.gov.br/anpd</a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Updates */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-primary" />
              <CardTitle>8. Atualizações da Política</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Esta Política de Privacidade pode ser atualizada periodicamente para refletir mudanças em 
              práticas de tratamento de dados, requisitos legais ou melhorias no sistema CorpMonitor.
            </p>
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Notificação de Alterações:</strong> Colaboradores serão notificados sobre alterações 
                materiais nesta política através de comunicação interna oficial (e-mail corporativo e/ou 
                portal interno) com antecedência mínima de 15 dias antes da entrada em vigor das mudanças.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="border-t pt-6 mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            <strong>CorpMonitor</strong> - Sistema de Segurança Corporativa
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Documento gerado em {new Date().toLocaleDateString('pt-BR', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;