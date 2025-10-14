# CorpMonitor Desktop

Aplicação desktop Python para monitoramento corporativo, compatível com o painel web React.

## 🚀 Instalação

### 1. Instalar dependências

```bash
cd corpmonitor-desktop
pip install -r requirements.txt
playwright install chromium
```

### 2. Configurar ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

O arquivo já está configurado com as credenciais do Supabase do projeto.

### 3. Executar aplicação

```bash
python main.py
```

## 🔐 Login

Use as **mesmas credenciais** do painel web React:
- Email: seu email de admin
- Senha: sua senha

**Apenas administradores** (roles: `admin`, `superadmin`, `demo_admin`) têm acesso.

## 📦 Estrutura

```
corpmonitor-desktop/
├── main.py                    # Entry point
├── requirements.txt           # Dependências Python
├── .env                       # Configurações (não commitar)
├── src/
│   ├── managers/             # Lógica de negócio
│   │   ├── auth_manager.py
│   │   ├── incident_manager.py
│   │   └── domain_manager.py
│   └── ui/                   # Interface gráfica
│       ├── login_window.py
│       └── main_window.py
└── assets/                   # Ícones, sons (futuro)
```

## ✅ Status Atual

- ✅ Sistema de autenticação (integrado com Supabase)
- ✅ Verificação de roles (admin/superadmin/demo_admin)
- ✅ Dashboard com KPIs
- ✅ Managers para incidentes e domínios
- ⏳ Visualizador de sites (Playwright) - próxima etapa
- ⏳ Sistema de alertas em tempo real - próxima etapa
- ⏳ Popups customizados - próxima etapa

## 🔧 Próximos Passos

1. Implementar lista de incidentes na aba
2. Adicionar visualizador de sites com Playwright
3. Sistema de alertas (WebSocket)
4. Gerenciamento de domínios monitorados
5. Build com PyInstaller (.exe)

## 🌐 Compatibilidade

Esta aplicação desktop compartilha o **mesmo backend Supabase** do painel web React:
- Mesma tabela `profiles` para autenticação
- Mesmas tabelas `incidents`, `blocked_domains`, `monitored_domains`
- Updates em tempo real compartilhados entre ambos os painéis
