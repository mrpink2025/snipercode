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
- 🚧 **Semana 2**: Realtime + Tunnel (EM ANDAMENTO)
- 📅 **Semana 3**: Browser (ChromeDP)
- 📅 **Semana 4**: Managers
- 📅 **Semana 5**: UI completa
- 📅 **Semana 6**: Testing + Deploy

## 📝 Logs

Logs são salvos em `logs/corpmonitor_YYYYMMDD.log`

## ✅ Testes (Semana 1)

Para validar esta entrega:

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
