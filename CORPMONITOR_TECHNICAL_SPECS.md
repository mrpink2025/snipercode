# CorpMonitor PoC - Especificações Técnicas Completas

## 📋 Visão Geral

Este documento contém todas as especificações técnicas, tokens de design e componentes React-ready para implementação do CorpMonitor - uma solução corporativa completa de monitoramento de segurança.

## 🎨 Design System & Tokens

### Cores (HSL)

```css
/* Cores Primárias */
--primary: 217 71% 53%;           /* #3B82F6 - Azul corporativo */
--primary-foreground: 0 0% 100%;  /* #FFFFFF - Texto sobre primary */
--primary-hover: 217 71% 48%;     /* Hover state */
--primary-glow: 217 71% 63%;      /* Efeitos de glow */

/* Cores de Status */
--danger: 0 84% 60%;              /* #E74C3C - Alertas vermelhos */
--success: 142 71% 45%;           /* #10B981 - Aprovações */
--warning: 38 92% 50%;            /* #F59E0B - Pendências */

/* Cores Neutras */
--background: 0 0% 100%;          /* #FFFFFF - Fundo */
--foreground: 220 13% 18%;        /* #2D2D2D - Texto principal */
--muted: 220 14% 96%;             /* #F8F9FA - Fundos sutis */
--card: 0 0% 100%;                /* #FFFFFF - Cards */
--border: 220 13% 91%;            /* #E2E8F0 - Bordas */
```

### Classes Tailwind Sugeridas

```typescript
// Botões
const buttonVariants = {
  default: "bg-primary text-primary-foreground hover:bg-primary-hover",
  danger: "bg-danger text-danger-foreground hover:bg-danger-hover",
  success: "bg-success text-success-foreground hover:bg-success-hover",
  warning: "bg-warning text-warning-foreground hover:bg-warning-hover"
};

// Cards de Incidente
const incidentCardClasses = {
  critical: "border-l-4 border-danger bg-danger/5 shadow-danger/20",
  normal: "border-l-4 border-border bg-card",
  newPulse: "animate-security-pulse"
};

// Status Badges  
const statusBadges = {
  new: "bg-warning text-warning-foreground animate-pulse",
  blocked: "bg-danger text-danger-foreground",
  approved: "bg-success text-success-foreground",
  pending: "bg-warning text-warning-foreground"
};
```

## 🧩 Componentes React (JSX Pseudo-code)

### IncidentCard

```tsx
interface IncidentCardProps {
  incident: {
    id: string;           // INC-169001
    host: string;         // facebook.com
    machineId: string;    // WKS-001-SP
    user: string;         // maria.santos
    timestamp: string;    // ISO date
    tabUrl?: string;      // URL da aba
    severity: 'RED' | 'NORMAL';
    cookieExcerpt: string;
    status: 'new' | 'in-progress' | 'blocked' | 'approved';
    isRedList?: boolean;
  };
}

const IncidentCard = ({ incident, onBlock, onRequestRaw, onIsolate }: IncidentCardProps) => (
  <Card className={cn(
    "transition-all hover:shadow-lg",
    incident.severity === 'RED' ? "incident-critical" : "incident-normal",
    incident.status === 'new' && "animate-security-pulse"
  )}>
    <CardHeader>
      <div className="flex justify-between items-center">
        {/* ID e Host */}
        <div className="flex items-center space-x-3">
          <AlertTriangle className={incident.severity === 'RED' ? "text-danger" : "text-muted-foreground"} />
          <div>
            <span className="font-mono font-semibold">{incident.id}</span>
            <span className="ml-2">{incident.host}</span>
            {incident.isRedList && <Badge className="bg-danger/10 text-danger">RedList</Badge>}
          </div>
        </div>
        
        {/* Status Badges */}
        <div className="flex space-x-2">
          <Badge className={statusBadges[incident.status]}>{incident.status}</Badge>
          <Badge className={incident.severity === 'RED' ? "bg-danger text-danger-foreground" : "bg-muted"}>
            {incident.severity}
          </Badge>
        </div>
      </div>
    </CardHeader>
    
    <CardContent>
      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{new Date(incident.timestamp).toLocaleString('pt-BR')}</span>
        </div>
        {incident.tabUrl && (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Globe className="w-4 h-4" />
            <span className="truncate">{incident.tabUrl}</span>
          </div>
        )}
      </div>
      
      {/* Cookie Excerpt */}
      <div className="p-3 bg-muted/50 rounded-md mb-4">
        <p className="text-xs text-muted-foreground mb-1">Cookie identificado:</p>
        <p className="font-mono text-sm">{incident.cookieExcerpt}</p>
      </div>
      
      {/* Actions */}
      <div className="flex justify-between">
        <div className="flex space-x-2">
          <Button size="sm" variant="outline" onClick={() => onBlock(incident.id)}
                  className="text-danger hover:bg-danger/10">
            <Ban className="w-4 h-4 mr-1" />
            Bloquear domínio
          </Button>
          <Button size="sm" variant="outline" onClick={() => onRequestRaw(incident.id)}
                  className="text-warning hover:bg-warning/10">
            <FileText className="w-4 h-4 mr-1" />
            Solicitar cookie (raw)
          </Button>
          <Button size="sm" variant="outline" 
                  className="text-primary hover:bg-primary/10">
            <ShieldAlert className="w-4 h-4 mr-1" />
            Isolar host
          </Button>
        </div>
        <Button size="sm" variant="ghost">Ver detalhes</Button>
      </div>
    </CardContent>
  </Card>
);
```

### BlockDomainModal

```tsx
const BlockDomainModal = ({ isOpen, onClose, domain, incidentId }: BlockDomainModalProps) => {
  const [confirmText, setConfirmText] = useState("");
  const isConfirmValid = confirmText === "BLOCK";

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
              <DialogDescription>Esta ação bloqueará o acesso em toda a rede</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Domain Info */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="font-mono text-lg">{domain}</div>
            <div className="text-sm text-muted-foreground">Incidente: {incidentId}</div>
          </div>

          {/* Warning Banner */}
          <div className="security-banner">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <div className="text-sm">
                <p className="font-medium">Impacto do Bloqueio</p>
                <ul className="text-xs mt-1 space-y-1">
                  <li>• Bloqueio imediato em todos os hosts</li>
                  <li>• Registro de auditoria será criado</li>
                  <li>• Reversão possível por 5 minutos</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Confirmation Input */}
          <div className="space-y-2">
            <Label>Digite 'BLOCK' para confirmar o bloqueio do domínio {domain}</Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Digite BLOCK para confirmar"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" disabled={!isConfirmValid}>
            <Ban className="w-4 h-4 mr-2" />
            Bloquear Domínio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

### RawCookieRequestModal

```tsx
const RawCookieRequestModal = ({ isOpen, onClose, incidentId, host }: RawCookieRequestModalProps) => {
  const [justification, setJustification] = useState("");
  const [category, setCategory] = useState("");
  const isFormValid = justification.length >= 50 && category;

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
          {/* Security Warning */}
          <div className="security-banner">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <div className="text-sm">
                <p className="font-medium">Exibição condicionada: cadastro e registro obrigatório</p>
                <p className="text-xs opacity-80">
                  Esta solicitação será auditada e requer justificativa detalhada
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <Label>Categoria *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fraude">Investigação de Fraude</SelectItem>
                  <SelectItem value="data-leak">Vazamento de Dados</SelectItem>
                  <SelectItem value="security-incident">Incidente de Segurança</SelectItem>
                  <SelectItem value="compliance">Auditoria de Compliance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Justificativa * (mínimo 50 caracteres)</Label>
              <Textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Descreva detalhadamente a necessidade de acesso..."
                className="min-h-[100px]"
              />
              <div className="text-xs text-muted-foreground text-right">
                {justification.length}/50 caracteres mínimos
              </div>
            </div>
          </div>

          {/* Process Info */}
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <h4 className="font-medium text-sm text-primary mb-2">Processo de Aprovação:</h4>
            <div className="text-xs text-primary/80 space-y-1">
              <p>1. Solicitação registrada no sistema de auditoria</p>
              <p>2. Aprovação necessária de 2 supervisores</p>
              <p>3. Cookie raw entregue via canal seguro</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!isFormValid}>
            <FileText className="w-4 h-4 mr-2" />
            Enviar Solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

### ExtensionPopup

```tsx
const ExtensionPopup = () => {
  const [isMonitoring, setIsMonitoring] = useState(true);

  return (
    <Card className="w-80">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <CardTitle className="text-lg">CorpMonitor</CardTitle>
              <p className="text-xs text-muted-foreground">Extensão Corporativa</p>
            </div>
          </div>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Principal */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isMonitoring ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
            <div>
              <div className="font-medium text-sm">
                {isMonitoring ? 'Monitoramento Ativo' : 'Monitoramento Pausado'}
              </div>
              <div className="text-xs text-muted-foreground">
                {isMonitoring ? 'Coletando metadados' : 'Coleta pausada'}
              </div>
            </div>
          </div>
          <Switch checked={isMonitoring} onCheckedChange={setIsMonitoring} />
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-2 bg-card border rounded">
            <div className="text-lg font-bold text-success">4</div>
            <div className="text-xs text-muted-foreground">Cookies hash</div>
          </div>
          <div className="text-center p-2 bg-card border rounded">
            <div className="text-lg font-bold text-primary">12</div>
            <div className="text-xs text-muted-foreground">Metadados</div>
          </div>
        </div>

        {/* Banner Legal */}
        <div className="security-banner">
          <div className="text-xs">
            <p className="font-medium">⚠️ Apenas administradores de dispositivo</p>
            <p className="opacity-75">Controles avançados requerem privilégios elevados</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" className="flex-1">
            Abrir Console
          </Button>
          <Button variant="ghost" size="sm">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
```

## 🔒 Micro-interações & Estados

### Animações CSS

```css
/* Pulse para incidentes críticos */
@keyframes security-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.02); }
}

/* Fade in para novos elementos */
@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Estados Interativos

```typescript
// Hover states
const hoverStates = {
  dangerButton: "hover:bg-danger/10 hover:border-danger/20",
  primaryButton: "hover:bg-primary/10 hover:border-primary/20",
  card: "hover:shadow-lg hover:scale-[1.02] transition-all"
};

// Focus states para acessibilidade
const focusStates = {
  input: "focus:ring-2 focus:ring-primary focus:border-primary",
  button: "focus:ring-2 focus:ring-primary focus:ring-offset-2"
};

// Loading states
const loadingStates = {
  button: "disabled:opacity-50 disabled:cursor-not-allowed",
  spinner: "animate-spin border-2 border-white/20 border-t-white rounded-full"
};
```

## 📱 Responsividade

```typescript
// Breakpoints Tailwind
const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px'   // Large desktop
};

// Classes responsivas sugeridas
const responsiveClasses = {
  dashboard: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6",
  sidebar: "w-full lg:w-sidebar hidden lg:block",
  modal: "w-full max-w-md mx-4 lg:mx-0",
  incidentCard: "space-y-4 lg:space-y-6"
};
```

## 🎯 Acessibilidade

### ARIA Labels Obrigatórios

```typescript
const ariaLabels = {
  incidentCard: "aria-label='Incidente {id} em {host}'",
  blockButton: "aria-label='Bloquear domínio {domain}'",
  statusBadge: "aria-label='Status: {status}'",
  searchInput: "aria-label='Buscar incidentes'",
  filterSelect: "aria-label='Filtrar por severidade'"
};
```

### Contraste Mínimo

- Texto normal: 4.5:1
- Texto grande: 3:1  
- Elementos de interface: 3:1
- Estados de foco: visível em todas as condições

### Navegação por Teclado

```typescript
const keyboardNavigation = {
  Tab: "Navegar entre elementos interativos",
  Space: "Ativar botões e checkboxes",
  Enter: "Confirmar ações",
  Escape: "Fechar modais e dropdowns",
  ArrowKeys: "Navegar em listas e menus"
};
```

## 📋 Textos da Interface (Português)

### Labels de Formulários
```typescript
const formLabels = {
  justification: "Justificativa",
  category: "Categoria", 
  attachments: "Anexos",
  mfaCode: "Assinatura MFA",
  comment: "Comentário"
};
```

### Mensagens de Status
```typescript
const statusMessages = {
  blockSuccess: "Domínio bloqueado com sucesso",
  requestSent: "Solicitação enviada para aprovação", 
  approvalPending: "Aguardando aprovação",
  accessGranted: "Acesso concedido"
};
```

### Avisos Legais
```typescript
const legalNotices = {
  dataCollection: "Esta extensão coleta metadados de navegação e hashes de cookies em dispositivos corporativos para proteção de ativos e investigação de incidentes.",
  sensitiveAccess: "Valores sensíveis são acessados apenas mediante justificativa aprovada e registro de auditoria.",
  auditWarning: "Exibição condicionada: cadastro e registro obrigatório"
};
```

## 🔧 Configuração Tailwind

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: 'hsl(var(--primary))',
        danger: 'hsl(var(--danger))',
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))'
      },
      animation: {
        'security-pulse': 'security-pulse 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out'
      },
      spacing: {
        'sidebar': '16rem',
        'header': '4rem'
      }
    }
  }
}
```

## 📦 Estrutura de Arquivos Sugerida

```
src/
├── components/
│   ├── ui/              # Componentes shadcn/ui
│   ├── Header.tsx       # Cabeçalho principal
│   ├── Sidebar.tsx      # Navegação lateral
│   ├── Dashboard.tsx    # Dashboard principal
│   ├── IncidentCard.tsx # Card de incidente
│   ├── KPICards.tsx     # Cards de KPI
│   ├── ExtensionPopup.tsx # UI da extensão
│   └── modals/
│       ├── BlockDomainModal.tsx
│       ├── RawCookieRequestModal.tsx
│       └── ApprovalModal.tsx
├── pages/
│   ├── Index.tsx        # Página principal
│   ├── ExtensionDemo.tsx
│   └── AgentInstaller.tsx
├── assets/
│   ├── extension-icon.png # 512x512
│   └── favicon.png        # 512x512
└── hooks/
    └── use-toast.ts     # Sistema de notificações
```

## 🚀 Próximos Passos para Desenvolvimento

1. **Integração Backend**: Conectar com APIs de monitoramento
2. **Autenticação SSO**: Implementar login corporativo
3. **WebSocket**: Feed em tempo real de incidentes
4. **Extensão Chrome**: Converter componentes para manifest v3
5. **Agente Desktop**: Implementar serviço Windows/macOS
6. **Testes**: Unit tests e testes de integração
7. **Deploy**: Pipeline CI/CD para ambiente corporativo

---

**Desenvolvido para:** CorpMonitor PoC  
**Versão:** 1.0.0  
**Data:** Setembro 2023  
**Stack:** React + TypeScript + Tailwind CSS + shadcn/ui