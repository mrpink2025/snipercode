# 🖥️ CorpMonitor Desktop

Aplicação desktop Python para monitoramento corporativo, compatível com o painel web React (mesmo backend Supabase).

## 📦 Instalação Automática (Windows)

```cmd
# Execute o instalador
install.bat
```

## 📦 Instalação Manual

```bash
# 1. Instalar dependências
pip install -r requirements.txt

# 2. Instalar navegador Playwright
playwright install chromium

# 3. Configurar variáveis de ambiente
# O arquivo .env já está configurado, mas você pode editá-lo se necessário
```

## 🚀 Executar

### Windows
```cmd
run.bat
```

### Linux/Mac
```bash
python main.py
```

## 🔐 Credenciais de Login

Use as **mesmas credenciais** de administrador do painel web React.

**Acesso permitido para:**
- `admin`
- `superadmin`
- `demo_admin`

**Credenciais padrão de demonstração:**
- **Email**: demo@corpmonitor.com
- **Senha**: demo123

## ✨ Funcionalidades

✅ **Implementado:**
- 🔐 Autenticação via Supabase (mesmas credenciais do painel web)
- 📊 Dashboard com KPIs de incidentes em tempo real
- 🖥️ Visualização de sites ao vivo com Playwright
- 🔔 Alertas em tempo real via Supabase Realtime
- 🚫 Gerenciamento de domínios bloqueados
- 👁️ Monitoramento de domínios específicos
- 📋 Lista completa de incidentes com filtros
- 🎨 Interface moderna com CustomTkinter (tema dark)
- 📝 Sistema de logs completo
- 🧵 Arquitetura multi-thread para não travar a UI

## 🏗️ Arquitetura

```
corpmonitor-desktop/
├── main.py                    # Entry point
├── src/
│   ├── managers/              # Lógica de negócio
│   │   ├── auth_manager.py    # Autenticação Supabase
│   │   ├── incident_manager.py # Gestão de incidentes
│   │   ├── domain_manager.py   # Domínios bloqueados/monitorados
│   │   ├── browser_manager.py  # Playwright (visualização)
│   │   └── realtime_manager.py # Alertas em tempo real
│   ├── ui/                    # Interface gráfica
│   │   ├── login_window.py    # Tela de login
│   │   ├── main_window.py     # Dashboard principal
│   │   └── site_viewer.py     # Visualizador de sites
│   └── utils/                 # Utilitários
│       ├── logger.py          # Sistema de logs
│       └── async_helper.py    # Integração asyncio + Tkinter
├── logs/                      # Logs da aplicação
├── requirements.txt           # Dependências Python
├── .env                       # Configuração (criado automaticamente)
├── install.bat                # Instalador Windows
└── run.bat                    # Executar aplicação Windows
```

## 🔧 Tecnologias

- **Python 3.12+**
- **CustomTkinter** - Interface gráfica moderna
- **Supabase** - Backend (auth, database, realtime)
- **Playwright** - Automação de navegador
- **nest-asyncio** - Integração asyncio + Tkinter
- **Plyer** - Notificações do sistema

## 📝 Logs

Os logs são salvos automaticamente em `logs/corpmonitor_YYYYMMDD.log`

Para depuração, verifique os logs em caso de erros.

## ⚠️ Troubleshooting

### Erro: "TypeError: Client.__init__() got an unexpected keyword argument 'proxy'"
- **Solução**: Execute `install.bat` novamente para atualizar as dependências

### Erro: "Playwright not installed"
- **Solução**: Execute `playwright install chromium`

### Aplicação trava ao fazer login
- **Solução**: Verifique os logs em `logs/` e certifique-se de que o arquivo `.env` está configurado corretamente

### Erro de conexão com Supabase
- **Solução**: Verifique as credenciais no arquivo `.env`

## 🌐 Compatibilidade

Esta aplicação compartilha o **mesmo backend Supabase** do painel web React:
- Mesma autenticação e tabela `profiles`
- Mesmas tabelas de dados (`incidents`, `blocked_domains`, `monitored_domains`)
- Updates em tempo real sincronizados entre ambos os painéis
