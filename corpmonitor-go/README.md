# CorpMonitor Desktop (Go + Fyne)

Versão Go do CorpMonitor Desktop, com foco em **WebSocket estável** e **performance nativa**.

## 🚀 Requisitos

- **Go 1.22+**
- **Chrome/Chromium** instalado (para ChromeDP)

## 📦 Instalação

1. Clone o repositório:
```bash
cd corpmonitor-go
```

2. Configure o `.env`:
```bash
cp .env.example .env
# Editar .env com suas credenciais Supabase
```

3. Instale dependências:
```bash
go mod download
```

4. Compile e execute:
```bash
go run cmd/corpmonitor/main.go
```

## 🏗️ Build

### Build Automático (Todos os Sistemas)

#### Linux/macOS:
```bash
chmod +x build.sh
./build.sh
```

#### Windows:
```bash
build.bat
```

Isso gerará executáveis em `builds/` para:
- ✅ Windows (amd64)
- ✅ Linux (amd64)
- ✅ macOS Intel (amd64)
- ✅ macOS Apple Silicon (arm64)

### Build Manual

#### Windows
```bash
go build -o corpmonitor.exe cmd/corpmonitor/main.go
```

#### Linux
```bash
go build -o corpmonitor cmd/corpmonitor/main.go
```

#### macOS
```bash
go build -o corpmonitor cmd/corpmonitor/main.go
```

## 📚 Estrutura Completa

```
corpmonitor-go/
├── cmd/
│   └── corpmonitor/
│       └── main.go                    # Entry point com version injection
├── internal/
│   ├── auth/
│   │   └── manager.go                 # ✅ Autenticação + profiles
│   ├── browser/
│   │   ├── manager.go                 # ✅ ChromeDP sessions
│   │   ├── session.go                 # ✅ Session lifecycle
│   │   └── fingerprint.go             # ✅ Browser fingerprinting
│   ├── tunnel/
│   │   ├── client.go                  # ✅ Polling + backoff
│   │   └── client_test.go             # ✅ Testes unitários
│   ├── realtime/
│   │   ├── manager.go                 # ✅ WebSocket robusto
│   │   └── manager_test.go            # ✅ Testes unitários
│   ├── domain/
│   │   └── manager.go                 # ✅ Blocked/Monitored/Trusted
│   ├── incident/
│   │   └── manager.go                 # ✅ CRUD completo
│   ├── machine/
│   │   └── manager.go                 # ✅ Stats + sessions
│   └── cache/
│       └── resource.go                # ✅ TTL-based caching
├── pkg/
│   ├── supabase/
│   │   └── client.go                  # ✅ Supabase wrapper
│   └── logger/
│       └── logger.go                  # ✅ Structured logging (zap)
├── ui/
│   ├── login.go                       # ✅ Tela de login
│   ├── main_window.go                 # ✅ Dashboard com tabs
│   ├── incident_browser.go            # ✅ Browser controller
│   ├── site_viewer.go                 # ✅ Screenshot viewer
│   ├── realtime_panel.go              # ✅ Realtime events
│   ├── site_viewer_test.go            # ✅ Testes UI
│   └── dialogs/
│       ├── block_domain.go            # ✅ Block dialog
│       └── popup_control.go           # ✅ Monitor dialog
├── builds/                            # Gerado por build scripts
│   ├── corpmonitor-linux-amd64
│   ├── corpmonitor-windows-amd64.exe
│   ├── corpmonitor-darwin-amd64
│   └── corpmonitor-darwin-arm64
├── logs/                              # Logs com data
│   └── corpmonitor_YYYYMMDD.log
├── build.sh                           # ✅ Build multi-platform
├── build.bat                          # ✅ Build Windows
├── go.mod                             # ✅ Dependencies
├── .env.example                       # ✅ Config template
├── .gitignore                         # ✅ Git ignore
└── README.md                          # ✅ Este arquivo
```

## 🔍 Status

- ✅ **Semana 1**: Login + Auth + Setup (CONCLUÍDO)
- ✅ **Semana 2**: Realtime + Tunnel (CONCLUÍDO)
- ✅ **Semana 3**: Browser (ChromeDP) (CONCLUÍDO)
- ✅ **Semana 4**: Managers + Cache (CONCLUÍDO)
- ✅ **Semana 5**: UI completa (CONCLUÍDO)
- ✅ **Semana 6**: Testing + Deploy (CONCLUÍDO)

## 🎉 Projeto Completo!

O CorpMonitor Desktop Go está **100% funcional** com todas as features do Python e melhorias de performance.

## 📝 Logs

Logs são salvos em `logs/corpmonitor_YYYYMMDD.log`

## ✅ Testes

### Semana 1 - Auth + Setup
```bash
# 1. Compilar
go build -o corpmonitor cmd/corpmonitor/main.go

# 2. Executar
./corpmonitor

# 3. Testar login com credenciais de admin do Supabase
# 4. Verificar logs em logs/corpmonitor_YYYYMMDD.log
# 5. Confirmar que dashboard placeholder abre após login
```

Expectativa:
- ✅ Login aceita admin/superadmin/demo_admin
- ❌ Login rejeita operator/approver
- ✅ Logs estruturados no arquivo e console
- ✅ Dashboard mostra nome do usuário e role

### Semana 2 - Realtime + Tunnel
```bash
# Executar testes unitários
go test ./internal/realtime/... -v
go test ./internal/tunnel/... -v

# Testar conexão WebSocket (requer desktop client Python ativo)
# O RealtimeManager se conecta automaticamente ao iniciar a aplicação
# Verificar nos logs: "Realtime conectado com sucesso"

# Testar TunnelClient
# O cliente faz polling automático com exponential backoff
# Stats são rastreadas: TotalRequests, SuccessfulRequests, FailedRequests
```

Expectativa:
- ✅ WebSocket conecta e reconecta automaticamente
- ✅ Heartbeat mantém conexão viva (15s)
- ✅ Backoff exponencial em caso de erro (1s → 60s)
- ✅ TunnelClient faz polling com timeout configurável
- ✅ Stats tracking funcional
- ✅ Callbacks de alerta e status funcionam

### Características Implementadas (Semana 2)

**RealtimeManager (`internal/realtime/manager.go`)**:
- ✅ WebSocket com gorilla/websocket
- ✅ Goroutines dedicadas: readPump (leitura) + heartbeatLoop (ping 15s)
- ✅ Reconnection automática com exponential backoff (1s → 60s)
- ✅ Join em canal Supabase Realtime
- ✅ Callbacks para alertas e mudanças de status
- ✅ Thread-safe com sync.RWMutex
- ✅ Context-based cancellation

**TunnelClient (`internal/tunnel/client.go`)**:
- ✅ Polling com select + time.Ticker
- ✅ Exponential backoff (500ms → 5s)
- ✅ Timeout configurável por requisição
- ✅ Stats tracking (total, success, failed, bytes)
- ✅ Fluent API com FetchOptions
- ✅ WaitForConnection helper
- ✅ Thread-safe com sync.RWMutex

### Semana 3 - Browser (ChromeDP)
```bash
# Testar BrowserManager
go test ./internal/browser/... -v

# O BrowserManager requer Chrome/Chromium instalado
# Cria sessões isoladas com contextos ChromeDP independentes
```

**BrowserManager (`internal/browser/manager.go`)**:
- ✅ ChromeDP com contextos isolados por sessão
- ✅ Cookie injection (suporta JSON e map formats)
- ✅ localStorage e sessionStorage injection
- ✅ Reverse tunnel (fetch interception com postMessage)
- ✅ Screenshot capture (FullScreenshot com qualidade 90)
- ✅ Navigate + ExecuteScript helpers
- ✅ Session lifecycle management
- ✅ ResourceCache para otimização
- ✅ Fingerprinting (UserAgent, Platform, WebGL, Canvas)

**Características**:
- Headless mode desabilitado para inspeção visual
- User-Agent customizado (anti-detection)
- Disable web security (para CORS)
- Window size: 1920x1080
- Fingerprint collection via JS

### Semana 4 - Managers + Cache
```bash
# Testar Managers
go test ./internal/incident/... -v
go test ./internal/domain/... -v
go test ./internal/machine/... -v
```

**IncidentManager (`internal/incident/manager.go`)**:
- ✅ CRUD completo (Create, Read, Update, Delete)
- ✅ List com filtros (status, severity, ordenação)
- ✅ UpdateStatus (new → in-progress → resolved → closed)
- ✅ Assign (atribuir a usuário)
- ✅ MarkAsViewed (rastreamento de visualização)
- ✅ Resolve (com resolution notes)
- ✅ GetStats (estatísticas agregadas)

**DomainManager (`internal/domain/manager.go`)**:
- ✅ BlockedDomains (Block, Unblock, IsBlocked, List)
- ✅ MonitoredDomains (Add, Remove, List com alert configs)
- ✅ TrustedDomains (Add, Remove, IsTrusted, List)
- ✅ Suporte a expiração de bloqueios
- ✅ Metadata flexível (JSON fields)
- ✅ Active/Inactive toggles

**MachineManager (`internal/machine/manager.go`)**:
- ✅ GetActiveSessions (lista sessões ativas por máquina)
- ✅ GetWebSocketConnection (verifica conexão WebSocket)
- ✅ IsConnected (check com timeout 2min)
- ✅ GetStats (estatísticas completas: sessions, incidents, blocked domains)
- ✅ ListAllMachines (todas máquinas com atividade)
- ✅ CloseSession (encerrar sessão específica)

**ResourceCache (`internal/cache/resource.go`)**:
- ✅ Set/Get/Delete operations
- ✅ TTL-based expiration
- ✅ CleanExpired helper
- ✅ Size tracking
- ✅ Thread-safe com sync.RWMutex
- ✅ Mime-type support

### Semana 5 - UI Completa (Fyne)
```bash
# A UI é construída automaticamente ao executar
./corpmonitor
```

**MainWindow (`ui/main_window.go`)**:
- ✅ Dashboard com tabs (Incidents, Alerts, Hosts, Realtime)
- ✅ Integração completa com todos os managers
- ✅ Header com user info e role
- ✅ Toolbar com ações rápidas
- ✅ Inicialização automática de managers

**IncidentsTab**:
- ✅ Lista incidents com status e severity
- ✅ Refresh button
- ✅ Formatação visual (emoji + cores)
- ✅ Open Browser integration

**HostsTab**:
- ✅ Lista todas máquinas ativas
- ✅ Indicador de conexão
- ✅ Stats por máquina

**RealtimePanel (`ui/realtime_panel.go`)**:
- ✅ Status de conexão em tempo real
- ✅ Lista de eventos (últimos 100)
- ✅ Callbacks registrados automaticamente
- ✅ Clear events button

**IncidentBrowser (`ui/incident_browser.go`)**:
- ✅ Janela dedicada por incident
- ✅ URL navigation bar
- ✅ Screenshot viewer integrado
- ✅ Session management
- ✅ Auto-inject cookies/storage
- ✅ Navigate + Capture buttons

**SiteViewer (`ui/site_viewer.go`)**:
- ✅ Screenshot display (ImageFillContain)
- ✅ Scrollable container
- ✅ PNG decode support
- ✅ Save to file
- ✅ Clear/Reload

**Dialogs**:
- ✅ BlockDomainDialog (`ui/dialogs/block_domain.go`)
  - Entrada de domínio
  - Motivo obrigatório
  - Opção de bloqueio temporário (7 dias)
  - Validação + feedback
  
- ✅ PopupControlDialog (`ui/dialogs/popup_control.go`)
  - Configuração de alertas
  - Tipos: sound, visual, both, silent
  - Frequência configurável

### Semana 6 - Testing + Deploy

**Testes Unitários**:
```bash
# Executar todos os testes
go test ./... -v

# Testes específicos
go test ./internal/realtime/... -v
go test ./internal/tunnel/... -v
go test ./internal/browser/... -v
go test ./internal/incident/... -v
go test ./internal/domain/... -v
go test ./internal/machine/... -v
go test ./ui/... -v
```

**Build Scripts**:
- ✅ `build.sh` (Linux/macOS)
  - Multi-platform build
  - Version injection
  - Automated output
  
- ✅ `build.bat` (Windows)
  - Windows + Linux targets
  - Version injection

**Cobertura de Testes**:
- ✅ RealtimeManager: callbacks, connection lifecycle
- ✅ TunnelClient: stats tracking, options
- ✅ Managers: basic creation tests
- ✅ UI: SiteViewer creation + clear

**Documentação Completa**:
- ✅ README.md atualizado
- ✅ Instruções de build
- ✅ Guia de instalação
- ✅ Status de implementação
- ✅ Exemplos de uso
- ✅ Testes manuais
