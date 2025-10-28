# CorpMonitor WebSocket Service

Serviço Go intermediário para gerenciar WebSocket estável com Supabase Realtime.

## 📋 Arquitetura

```
[Python Desktop UI] <--WebSocket--> [Go Service] <--WebSocket--> [Supabase Realtime]
  (CustomTkinter)      (localhost)      (Gorilla)         (Produção)
```

## 🚀 Como usar

### 1. Configurar .env

```bash
cp .env.example .env
# Editar .env com suas credenciais Supabase
```

### 2. Build

**Windows:**
```bash
build.bat
```

**Linux/macOS:**
```bash
chmod +x build.sh
./build.sh
```

### 3. Executar

**Windows:**
```bash
bin\corpmonitor-ws.exe
```

**Linux:**
```bash
./bin/corpmonitor-ws-linux
```

**macOS:**
```bash
./bin/corpmonitor-ws-macos
```

## 📡 Endpoints

- **WebSocket**: `ws://localhost:8765/ws`
- **Health Check**: `http://localhost:8765/health`

## 🔄 Protocolo de Mensagens

### Python → Go (Subscribe)
```json
{
  "type": "subscribe",
  "machine_id": "PC-WIN-001"
}
```

### Go → Python (Alert)
```json
{
  "event": "postgres_changes",
  "payload": {
    "record": {
      "id": "uuid",
      "domain": "malware.com",
      "alert_type": "blocked"
    }
  }
}
```

## 🛠️ Desenvolvimento

```bash
# Instalar dependências
go mod download

# Executar em modo dev
go run main.go

# Testes
go test ./...
```

## 📊 Logs

Logs são exibidos no console com prefixos:
- 🚀 Inicialização
- ✅ Sucesso
- ❌ Erro
- 📡 Subscription
- 📬 Mensagem recebida
- 🔄 Reconexão

## ⚙️ Configuração

Variáveis de ambiente (`.env`):

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `SUPABASE_URL` | URL do projeto Supabase | - |
| `SUPABASE_ANON_KEY` | Chave anônima Supabase | - |
| `WS_SERVICE_PORT` | Porta do serviço WebSocket | `8765` |

## 🔒 Segurança

- ✅ Conexão WebSocket local (localhost only)
- ✅ Health check sem autenticação (apenas status)
- ✅ Credenciais Supabase via .env (não commitadas)

## 🐛 Troubleshooting

**Erro: "port already in use"**
- Mudar `WS_SERVICE_PORT` no .env

**Erro: "connection refused"**
- Verificar se Supabase URL está correto
- Verificar firewall/antivírus

**Python não conecta**
- Verificar se serviço Go está rodando
- Testar `curl http://localhost:8765/health`
