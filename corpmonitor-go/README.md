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

### Windows
```bash
go build -o corpmonitor.exe cmd/corpmonitor/main.go
```

### Linux
```bash
go build -o corpmonitor cmd/corpmonitor/main.go
```

### macOS
```bash
go build -o corpmonitor cmd/corpmonitor/main.go
```

## 📚 Estrutura

```
corpmonitor-go/
├── cmd/corpmonitor/    # Entry point
├── internal/           # Lógica de negócio
│   ├── auth/          # Autenticação
│   ├── browser/       # ChromeDP (Semana 3)
│   ├── tunnel/        # Túnel reverso (Semana 2)
│   └── realtime/      # WebSocket (Semana 2)
├── pkg/               # Pacotes compartilhados
│   ├── logger/        # Logging estruturado
│   └── supabase/      # Cliente Supabase
└── ui/                # Interface Fyne
    ├── login.go       # Tela de login
    └── main_window.go # Dashboard (WIP)
```

## 🔍 Status

- ✅ **Semana 1**: Login + Auth + Setup (CONCLUÍDO)
- ✅ **Semana 2**: Realtime + Tunnel (CONCLUÍDO)
- ✅ **Semana 3**: Browser (ChromeDP) (CONCLUÍDO)
- ✅ **Semana 4**: Managers + Cache (CONCLUÍDO)
- 📅 **Semana 5**: UI completa
- 📅 **Semana 6**: Testing + Deploy

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
