# 🚀 Instruções para Testar a Extensão CorpMonitor

## ✅ O que foi implementado

### 1. **Limpeza do Banco de Dados**
- ✅ Todos os incidentes demo foram removidos
- ✅ Sessões inativas antigas foram limpadas
- ✅ Banco de dados pronto para dados reais

### 2. **Dashboard Atualizado**
- ✅ Novo KPI "Máquinas Monitoradas" adicionado
- ✅ Grid atualizado para 4 colunas (Total | Ativos | Máquinas | Bloqueados)
- ✅ Contador mostra máquinas únicas ativas em tempo real

### 3. **Extensão Corrigida**
- ✅ Logs de debug detalhados adicionados em todo o código
- ✅ Rastreamento completo do fluxo de dados
- ✅ Edge function `create-incident` corrigido para aceitar incidentes sem user_id
- ✅ Coluna `user_id` na tabela `incidents` agora é nullable

### 4. **Edge Functions Verificados**
- ✅ Headers CORS corretos em todos os edge functions
- ✅ `create-incident` - aceita incidentes da extensão
- ✅ `session-tracker` - rastreia sessões ativas

---

## 📋 Próximos Passos para Testar

### **Passo 1: Rebuild da Extensão**
```bash
cd chrome-extension
npm run build
```

### **Passo 2: Instalar/Atualizar no Chrome**
1. Abra `chrome://extensions/`
2. Ative "Modo do desenvolvedor"
3. Se já instalou antes:
   - Clique em "Atualizar" no card da extensão
4. Se é primeira instalação:
   - Clique em "Carregar sem compactação"
   - Selecione a pasta `chrome-extension`

### **Passo 3: Verificar Logs da Extensão**
1. Clique com botão direito no ícone da extensão
2. Selecione "Inspecionar popup de extensão" (para ver logs do popup)
3. Para ver logs do background:
   - Vá em `chrome://extensions/`
   - Clique em "service worker" embaixo do nome da extensão
   - Console abrirá com logs detalhados

### **Passo 4: Testar Monitoramento**
1. Visite qualquer site (ex: google.com, github.com, instagram.com)
2. Verifique os logs no console do background service worker
3. Você deve ver:
   - `🔍 Tab updated - ID: X, URL: https://...`
   - `🍪 Found X cookies for domain.com`
   - `📤 Creating incident for domain.com`
   - `✅ Incident created successfully`

### **Passo 5: Verificar Dashboard**
1. Abra o dashboard em: https://monitorcorporativo.com
2. Aguarde 5-10 segundos após visitar sites
3. Você deve ver:
   - **Total de Incidentes** aumentar
   - **Máquinas Monitoradas** mostrar 1 (ou mais se testar em várias máquinas)
   - Incidentes na lista principal

---

## 🔍 Debugando Problemas

### **Extensão não está coletando dados**
Verifique no console do background service worker:
```
- ❌ Monitoring is disabled? 
  → Vá no popup da extensão e ative o monitoramento

- ❌ Erro "403" ou "401"?
  → Problema de autenticação com Supabase

- ❌ Erro "Network error"?
  → Verifique se o CSP no Nginx está correto
```

### **Dashboard não mostra dados**
```
- ❌ KPI "Máquinas Monitoradas" mostra 0?
  → Verifique se há sessões ativas no banco:
  SELECT * FROM active_sessions WHERE is_active = true;

- ❌ Nenhum incidente aparece?
  → Verifique se incidentes foram criados:
  SELECT * FROM incidents ORDER BY created_at DESC LIMIT 10;
```

### **Checklist de Logs Importantes**
No console do background service worker, procure por:
- ✅ `🚀 CorpMonitor extension v1.0.0 installed`
- ✅ `🆔 Loaded existing machine ID: CORP-...`
- ✅ `📊 Configuration loaded - Monitoring: ✅ ENABLED`
- ✅ `🍪 Found X cookies for domain.com`
- ✅ `🚀 Sending incident to API`
- ✅ `✅ Incident created successfully`

---

## ⚠️ Problema CSP do Nginx (CRÍTICO)

O arquivo `nginx.conf` já foi atualizado no repositório, mas você precisa **aplicar manualmente no servidor**:

### Editar no servidor:
```bash
sudo nano /etc/nginx/sites-available/monitorcorporativo
```

### Localizar a linha `Content-Security-Policy` e substituir por:
```nginx
add_header Content-Security-Policy "default-src 'self'; 
  script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
  style-src 'self' 'unsafe-inline'; 
  img-src 'self' data: https:; 
  font-src 'self' data:; 
  connect-src 'self' 
    https://vxvcquifgwtbjghrcjbp.supabase.co 
    wss://vxvcquifgwtbjghrcjbp.supabase.co 
    https://*.supabase.co 
    wss://*.supabase.co;" always;
```

### Testar e aplicar:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📊 Verificação Final

Após testar, você deve ter:
- ✅ Logs detalhados no console do service worker
- ✅ Incidentes sendo criados no banco de dados
- ✅ Dashboard mostrando KPI "Máquinas Monitoradas"
- ✅ Lista de incidentes atualizada em tempo real
- ✅ Extensão aparecendo no dashboard após visitar sites

---

## 🔒 Aviso de Segurança

Foi detectado 1 warning de segurança no Supabase:
- **Leaked Password Protection Disabled**
- Este é um aviso **não crítico** relacionado à política de senhas
- Para corrigir, ative a proteção contra senhas vazadas em:
  - Supabase Dashboard > Authentication > Policies
  - Ou consulte: https://supabase.com/docs/guides/auth/password-security

Este aviso **NÃO** afeta o funcionamento da extensão ou do monitoramento.

---

## 🆘 Suporte

Se encontrar problemas:
1. Compartilhe os logs do background service worker
2. Execute no banco: `SELECT * FROM active_sessions WHERE is_active = true;`
3. Execute no banco: `SELECT * FROM incidents ORDER BY created_at DESC LIMIT 5;`
