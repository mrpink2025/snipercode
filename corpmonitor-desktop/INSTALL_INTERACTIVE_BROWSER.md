# Instalação do Navegador Interativo com Controle Lateral

## 📦 Instalar Dependências

Execute na pasta `corpmonitor-desktop`:

```bash
pip install -r requirements.txt
```

Ou instale manualmente:

```bash
pip install supabase==2.11.0
pip install websockets==14.1
```

## 🚀 Como Usar

1. **Abrir o CorpMonitor Desktop**
   ```bash
   python main.py
   ```

2. **Clicar em "🌐 Ver Site" em um incidente**
   - Abrirá um navegador Chrome/Edge **visível**
   - Uma janela de controle aparecerá no lado direito da tela

3. **Janela de Controle possui 4 botões:**

   ### 🔄 Atualizar Página
   - Recarrega a página atual no navegador

   ### 📨 Solicitar Popup
   - Abre um dialog completo com 3 tabs:
     - **Selecionar Template**: Escolher templates pré-definidos do Supabase
     - **Preview**: Visualizar como o popup ficará
     - **Custom HTML**: Criar popup personalizado
       - Botões para inserir campos: input1, input2, input3, input4
       - Editor de HTML e CSS
   - Envia popup via WebSocket (comando é enviado em tempo real)
   - Mostra status: ✅ Enviado, ⚠️ Na fila (offline), ou ❌ Erro

   ### 🚫 Bloquear Domínio
   - Bloqueia o domínio atual
   - Requer confirmação digitando "BLOCK"
   - Bloqueia em TODAS as máquinas com extensão instalada

   ### ✕ Fechar
   - Fecha o navegador e a janela de controle

4. **Painel de Respostas em Tempo Real**
   - Mostra respostas não lidas de popups
   - Toca som de alerta quando nova resposta chega
   - Permite:
     - Ver dados completos do formulário
     - Marcar como lido
   - Atualiza automaticamente via Supabase Realtime

## 🎯 Funcionalidades

### ✅ O que funciona:
- Navegador visível com cookies injetados (usuário já logado)
- Navegação manual completa
- Envio de popups com templates ou HTML customizado
- Recebimento de respostas em tempo real com notificação sonora
- Bloqueio de domínios instantâneo
- Variáveis substituídas automaticamente: `{{domain}}`, `{{url}}`, `{{title}}`

### 📋 Variáveis disponíveis nos templates:
- `{{domain}}` - Domínio atual (ex: "pje1g.trf1.jus.br")
- `{{url}}` - URL completa
- `{{title}}` - Título da página/incidente

### 🔊 Notificações Sonoras:
- 3 beeps crescentes quando nova resposta é recebida
- Funciona mesmo com janela minimizada

## 🐛 Troubleshooting

### Navegador não abre:
```bash
# Reinstalar Playwright
python -m playwright install chromium
```

### Erro ao conectar Supabase:
- Verifique se as credenciais em `src/config/supabase_config.py` estão corretas
- Teste a conexão:
```python
from src.config.supabase_config import supabase
print(supabase.table('popup_templates').select('*').limit(1).execute())
```

### Popup não é recebido:
1. Verifique se a máquina está online (veja `websocket_connections` no Supabase)
2. Verifique logs da edge function `command-dispatcher`
3. Teste enviar comando manualmente no Supabase

### Som não toca:
- Windows: Instale `winsound` (vem no Python padrão)
- Alternativa: Use `plyer` para notificações do sistema

## 📁 Arquivos Criados

- `src/config/supabase_config.py` - Cliente Supabase
- `src/ui/interactive_browser_controller.py` - Janela de controle principal
- `src/ui/popup_control_dialog.py` - Modal completo de popup
- `src/ui/realtime_response_panel.py` - Painel de respostas
- `src/ui/block_domain_dialog.py` - Dialog de bloqueio

## 🔗 Recursos Utilizados

- **Supabase Edge Functions**:
  - `command-dispatcher` - Envia comandos via WebSocket
  - `block-domain` - Bloqueia domínios

- **Supabase Tables**:
  - `popup_templates` - Templates de popup
  - `remote_commands` - Fila de comandos
  - `popup_responses` - Respostas dos usuários
  - `blocked_domains` - Domínios bloqueados
  - `websocket_connections` - Status das conexões

- **Supabase Realtime**:
  - Escuta `popup_responses` (INSERT)
  - Notificação instantânea de novas respostas

## 💡 Dicas

1. **Criar templates reutilizáveis**: Insira templates no Supabase em `popup_templates`
2. **Usar variáveis**: Todos os templates suportam `{{domain}}`, `{{url}}`, `{{title}}`
3. **Testar popups**: Use a tab "Preview" antes de enviar
4. **Campos de formulário**: Use `input1`, `input2`, `input3`, `input4` para padronizar nomes
5. **Monitorar respostas**: Deixe a janela aberta para ver respostas em tempo real
