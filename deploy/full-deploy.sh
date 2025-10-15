#!/bin/bash

################################################################################
#
# CORPMONITOR - SCRIPT DE DEPLOY COMPLETO
# 
# Atualiza servidor Ubuntu 24.04 com:
# - Git pull do código
# - Build do frontend (React/Vite)
# - Build da extensão Chrome (.crx assinado)
# - Deploy dos arquivos
# - Configuração Nginx
# - Validação completa
#
# Uso: sudo ./deploy/full-deploy.sh
#
################################################################################

set -euo pipefail

# ============================================================================
# CONFIGURAÇÕES
# ============================================================================

PROJECT_ROOT="/var/www/monitor-corporativo"
EXTENSION_DIR="$PROJECT_ROOT/chrome-extension"
EXTENSION_DEPLOY_DIR="$PROJECT_ROOT/extension"
BACKUP_DIR="/var/backups/monitor-corporativo"
LOG_DIR="/var/log"
NGINX_CONFIG="/etc/nginx/sites-available/monitor-corporativo"
DOMAIN="monitorcorporativo.com"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/corpmonitor-deploy-${TIMESTAMP}.log"
REPORT_FILE="$PROJECT_ROOT/DEPLOYMENT_REPORT_${TIMESTAMP}.txt"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ============================================================================
# FUNÇÕES AUXILIARES
# ============================================================================

log_info() {
    echo -e "${CYAN}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}✗${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1" | tee -a "$LOG_FILE"
}

log_phase() {
    echo -e "\n${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "$LOG_FILE"
    echo -e "${BOLD}${BLUE}[FASE $1/10]${NC} $2" | tee -a "$LOG_FILE"
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "$LOG_FILE"
}

rollback() {
    log_error "ERRO CRÍTICO! Iniciando rollback..."
    
    if [ -f "$BACKUP_DIR/backup-${TIMESTAMP}.tar.gz" ]; then
        log_info "Restaurando código do backup..."
        cd "$PROJECT_ROOT"
        tar -xzf "$BACKUP_DIR/backup-${TIMESTAMP}.tar.gz" --strip-components=1
        log_success "Código restaurado"
    fi
    
    if [ -f "$NGINX_CONFIG.backup-${TIMESTAMP}" ]; then
        log_info "Restaurando configuração Nginx..."
        cp "$NGINX_CONFIG.backup-${TIMESTAMP}" "$NGINX_CONFIG"
        nginx -t && systemctl reload nginx
        log_success "Nginx restaurado"
    fi
    
    log_error "Rollback concluído. Verifique os logs em: $LOG_FILE"
    exit 1
}

# ============================================================================
# BANNER INICIAL
# ============================================================================

clear
echo -e "${BOLD}${CYAN}"
cat << "EOF"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚀 DEPLOY COMPLETO - CORPMONITOR 🚀
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
echo -e "${NC}"

echo -e "Este script vai:"
echo -e "  ${GREEN}1.${NC} Atualizar código (git pull)"
echo -e "  ${GREEN}2.${NC} Recompilar frontend (React/Vite)"
echo -e "  ${GREEN}3.${NC} Recompilar extensão Chrome (.crx assinado)"
echo -e "  ${GREEN}4.${NC} Deploy no servidor (/extension/)"
echo -e "  ${GREEN}5.${NC} Configurar/atualizar Nginx"
echo -e "  ${GREEN}6.${NC} Validar todas as URLs"
echo ""
echo -e "${YELLOW}Backup automático será criado em:${NC}"
echo -e "  $BACKUP_DIR/backup-${TIMESTAMP}.tar.gz"
echo ""
echo -e "${YELLOW}Log será salvo em:${NC}"
echo -e "  $LOG_FILE"
echo ""

read -p "Deseja continuar? (s/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Deploy cancelado pelo usuário."
    exit 0
fi

# Iniciar log
echo "Deploy iniciado em: $(date)" > "$LOG_FILE"

# ============================================================================
# FASE 1: VERIFICAÇÕES INICIAIS
# ============================================================================

log_phase 1 "Verificações Iniciais"

# Verificar root
if [ "$EUID" -ne 0 ]; then
    log_error "Este script precisa ser executado como root (sudo)"
    exit 1
fi
log_success "Executando como root"

# Verificar se o projeto existe ou precisa clonar
if [ ! -d "$PROJECT_ROOT" ] || [ ! -d "$PROJECT_ROOT/.git" ]; then
    log_warning "Repositório não existe, clonando do GitHub..."
    
    mkdir -p "$(dirname $PROJECT_ROOT)"
    if git clone https://github.com/mrpink2025/snipercode.git "$PROJECT_ROOT" >> "$LOG_FILE" 2>&1; then
        log_success "Repositório clonado com sucesso"
    else
        log_error "Falha ao clonar repositório do GitHub"
        log_error "Verifique se:"
        log_error "  1. O repositório existe"
        log_error "  2. Você tem permissão de acesso"
        log_error "  3. Credenciais estão configuradas (se privado)"
        exit 1
    fi
fi
log_success "Diretório do projeto encontrado"

# Verificar Git
if ! command -v git &> /dev/null; then
    log_error "Git não está instalado"
    exit 1
fi
log_success "Git instalado: $(git --version)"

# Verificar Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js não está instalado"
    exit 1
fi
log_success "Node.js instalado: $(node --version)"

# Verificar npm
if ! command -v npm &> /dev/null; then
    log_error "npm não está instalado"
    exit 1
fi
log_success "npm instalado: $(npm --version)"

# Verificar Nginx
if ! command -v nginx &> /dev/null; then
    log_error "Nginx não está instalado"
    exit 1
fi
log_success "Nginx instalado: $(nginx -v 2>&1)"

# Verificar se é repositório Git
cd "$PROJECT_ROOT"
if [ ! -d ".git" ]; then
    log_error "Não é um repositório Git"
    exit 1
fi
log_success "Repositório Git válido"

# Verificar e corrigir remote do GitHub
log_info "Verificando configuração do GitHub..."
GITHUB_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
EXPECTED_REMOTE="https://github.com/mrpink2025/snipercode.git"

if [ "$GITHUB_REMOTE" != "$EXPECTED_REMOTE" ]; then
    log_warning "Remote não aponta para o GitHub correto"
    log_info "Remote atual: ${GITHUB_REMOTE:-<não configurado>}"
    log_info "Configurando remote correto..."
    
    if [ -z "$GITHUB_REMOTE" ]; then
        git remote add origin "$EXPECTED_REMOTE" >> "$LOG_FILE" 2>&1
    else
        git remote set-url origin "$EXPECTED_REMOTE" >> "$LOG_FILE" 2>&1
    fi
    
    log_success "Remote configurado: $EXPECTED_REMOTE"
else
    log_success "Remote do GitHub OK"
fi

# Testar acesso ao GitHub
log_info "Testando acesso ao GitHub..."
if ! git ls-remote "$EXPECTED_REMOTE" HEAD &>/dev/null; then
    log_error "Não foi possível acessar o repositório GitHub"
    log_error "Verifique se:"
    log_error "  1. O repositório existe: https://github.com/mrpink2025/snipercode"
    log_error "  2. Você tem permissão de acesso"
    log_error "  3. Credenciais estão configuradas (se privado)"
    log_error ""
    log_error "Para repositório privado, configure autenticação:"
    log_error "  Token: git config --global credential.helper store"
    log_error "  SSH: ssh-keygen + adicionar chave no GitHub"
    exit 1
fi
log_success "Acesso ao GitHub validado"

log_success "Todas as verificações passaram"

# ============================================================================
# FASE 2: BACKUP COMPLETO
# ============================================================================

log_phase 2 "Criando Backup"

mkdir -p "$BACKUP_DIR"

# Backup do código (exceto node_modules, .git, backups)
log_info "Criando backup do código..."
BACKUP_FILE="$BACKUP_DIR/backup-${TIMESTAMP}.tar.gz"

tar -czf "$BACKUP_FILE" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='backups' \
    --exclude='dist' \
    --exclude='chrome-extension/dist' \
    -C "$(dirname $PROJECT_ROOT)" \
    "$(basename $PROJECT_ROOT)" 2>> "$LOG_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log_success "Backup criado: $BACKUP_FILE ($BACKUP_SIZE)"

# Backup da configuração Nginx
if [ -f "$NGINX_CONFIG" ]; then
    cp "$NGINX_CONFIG" "$NGINX_CONFIG.backup-${TIMESTAMP}"
    log_success "Backup Nginx criado"
fi

# Salvar commit atual para referência
CURRENT_COMMIT=$(git rev-parse HEAD)
echo "$CURRENT_COMMIT" > "$BACKUP_DIR/commit-${TIMESTAMP}.txt"
log_info "Commit atual: ${CURRENT_COMMIT:0:8}"

# ============================================================================
# FASE 3: ATUALIZAR CÓDIGO (GIT PULL)
# ============================================================================

log_phase 3 "Atualizando Código"

cd "$PROJECT_ROOT"

# Guardar mudanças locais (se houver)
if ! git diff-index --quiet HEAD --; then
    log_warning "Há mudanças locais não commitadas"
    git stash save "Auto-stash before deploy ${TIMESTAMP}" >> "$LOG_FILE" 2>&1
    log_info "Mudanças guardadas no stash"
fi

# Detectar branch padrão do remote
log_info "Detectando branch padrão..."
git fetch origin >> "$LOG_FILE" 2>&1

DEFAULT_BRANCH=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | cut -d' ' -f5)
if [ -z "$DEFAULT_BRANCH" ]; then
    # Fallback: tentar detectar a branch atual
    DEFAULT_BRANCH=$(git branch --show-current)
    if [ -z "$DEFAULT_BRANCH" ]; then
        DEFAULT_BRANCH="main"
        log_warning "Não foi possível detectar branch, usando 'main'"
    else
        log_info "Usando branch atual: $DEFAULT_BRANCH"
    fi
else
    log_success "Branch remota detectada: $DEFAULT_BRANCH"
fi

# Verificar se há atualizações
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse origin/$DEFAULT_BRANCH 2>/dev/null || git rev-parse @{u})

if [ "$LOCAL" = "$REMOTE" ]; then
    log_info "Código já está atualizado"
else
    # Pull
    log_info "Atualizando código (git pull origin $DEFAULT_BRANCH)..."
    if ! git pull origin "$DEFAULT_BRANCH" >> "$LOG_FILE" 2>&1; then
        log_error "Falha no git pull"
        rollback
    fi
    
    # Mostrar novos commits
    NEW_COMMITS=$(git log --oneline "$LOCAL".."$REMOTE" | wc -l)
    log_success "Código atualizado ($NEW_COMMITS novos commits)"
    
    git log --oneline -3 | tee -a "$LOG_FILE"
fi

# ============================================================================
# FASE 4: ATUALIZAR DEPENDÊNCIAS
# ============================================================================

log_phase 4 "Atualizando Dependências"

cd "$PROJECT_ROOT"

# Verificar se package.json mudou
if git diff --name-only "$CURRENT_COMMIT" HEAD | grep -q "package.json"; then
    log_info "package.json foi modificado, atualizando dependências..."
    
    npm install --legacy-peer-deps >> "$LOG_FILE" 2>&1
    log_success "Dependências do root atualizadas"
else
    log_info "package.json não mudou, pulando atualização"
fi

# Verificar dependências da extensão
if [ -f "$EXTENSION_DIR/package.json" ]; then
    cd "$EXTENSION_DIR"
    
    if ! [ -d "node_modules" ]; then
        log_info "Instalando dependências da extensão..."
        npm install >> "$LOG_FILE" 2>&1
        log_success "Dependências da extensão instaladas"
    elif git diff --name-only "$CURRENT_COMMIT" HEAD | grep -q "chrome-extension/package.json"; then
        log_info "package.json da extensão mudou, atualizando..."
        npm install >> "$LOG_FILE" 2>&1
        log_success "Dependências da extensão atualizadas"
    else
        log_info "Dependências da extensão OK"
    fi
fi

# ============================================================================
# FASE 5: COMPILAR FRONTEND
# ============================================================================

log_phase 5 "Compilando Frontend (React/Vite)"

cd "$PROJECT_ROOT"

# Remover build anterior
if [ -d "dist" ]; then
    rm -rf dist
    log_info "Build anterior removido"
fi

# Build
log_info "Executando npm run build..."
if ! npm run build >> "$LOG_FILE" 2>&1; then
    log_error "Falha no build do frontend"
    rollback
fi

# Validar build
if [ ! -f "dist/index.html" ]; then
    log_error "Build inválido: dist/index.html não encontrado"
    rollback
fi

DIST_SIZE=$(du -sh dist | cut -f1)
log_success "Frontend compilado com sucesso ($DIST_SIZE)"

# ============================================================================
# FASE 6: COMPILAR EXTENSÃO + CRX
# ============================================================================

log_phase 6 "Compilando Extensão Chrome"

cd "$EXTENSION_DIR"

# Build normal (.zip)
log_info "Executando npm run build (gera .zip)..."
if ! npm run build >> "$LOG_FILE" 2>&1; then
    log_error "Falha no build da extensão"
    rollback
fi
log_success "Extensão compilada (.zip)"

# Build CRX assinado
log_info "Executando npm run build:crx (gera .crx assinado)..."
if ! npm run build:crx 2>&1 | tee -a "$LOG_FILE"; then
    log_error "Falha na geração do .crx"
    log_error "Últimas 20 linhas do log:"
    tail -20 "$LOG_FILE" | sed 's/^/   /'
    log_info "Log completo em: $LOG_FILE"
    rollback
fi
log_success "CRX assinado gerado"

# Validar arquivos gerados
REQUIRED_FILES=("corpmonitor.zip" "corpmonitor.crx" "corpmonitor.sha256" "update.xml")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        log_error "Arquivo não encontrado: $file"
        rollback
    fi
done

# Mostrar tamanhos
ZIP_SIZE=$(du -h corpmonitor.zip | cut -f1)
CRX_SIZE=$(du -h corpmonitor.crx | cut -f1)
log_success "Arquivos gerados:"
log_info "  - corpmonitor.zip ($ZIP_SIZE)"
log_info "  - corpmonitor.crx ($CRX_SIZE)"

# Extrair Extension ID (se disponível)
EXTENSION_ID=""
if [ -f "extension-id.txt" ]; then
    EXTENSION_ID=$(cat extension-id.txt)
    log_success "  - Extension ID: $EXTENSION_ID"
fi

# Mostrar SHA256
SHA256_HASH=$(cat corpmonitor.sha256)
log_info "  - SHA256: ${SHA256_HASH:0:16}..."

# ============================================================================
# FASE 7: DEPLOY DOS ARQUIVOS
# ============================================================================

log_phase 7 "Deploy dos Arquivos"

# Criar diretório de deploy da extensão
mkdir -p "$EXTENSION_DEPLOY_DIR"
log_success "Diretório criado: $EXTENSION_DEPLOY_DIR"

# Copiar arquivos da extensão
log_info "Copiando arquivos da extensão..."
cp "$EXTENSION_DIR/corpmonitor.crx" "$EXTENSION_DEPLOY_DIR/"
cp "$EXTENSION_DIR/corpmonitor.zip" "$EXTENSION_DEPLOY_DIR/"
cp "$EXTENSION_DIR/corpmonitor.sha256" "$EXTENSION_DEPLOY_DIR/"
cp "$EXTENSION_DIR/update.xml" "$EXTENSION_DEPLOY_DIR/"
log_success "Arquivos da extensão copiados"

# Copiar privacy policy para dist
if [ -f "$EXTENSION_DIR/privacy-policy.html" ]; then
    cp "$EXTENSION_DIR/privacy-policy.html" "$PROJECT_ROOT/dist/"
    log_success "privacy-policy.html copiado para dist/"
fi

# Definir permissões corretas
chown -R www-data:www-data "$EXTENSION_DEPLOY_DIR"
chmod -R 755 "$EXTENSION_DEPLOY_DIR"
log_success "Permissões configuradas (www-data:www-data)"

# ============================================================================
# FASE 8: CONFIGURAR NGINX
# ============================================================================

log_phase 8 "Configurando Nginx"

# Verificar se location /extension/ já existe
if grep -q "location /extension/" "$NGINX_CONFIG"; then
    log_info "Configuração /extension/ já existe no Nginx"
else
    log_info "Adicionando location /extension/ ao Nginx..."
    
    # Backup antes de modificar
    cp "$NGINX_CONFIG" "$NGINX_CONFIG.backup-pre-extension"
    
    # Adicionar location block antes do último }
    sed -i '/^}$/i \
    # Extension Updates Directory\
    location /extension/ {\
        alias /var/www/monitor-corporativo/extension/;\
        autoindex off;\
        \
        # CORS headers for Chrome extension updates\
        add_header Access-Control-Allow-Origin "*";\
        add_header Access-Control-Allow-Methods "GET, HEAD";\
        add_header Access-Control-Allow-Headers "Content-Type";\
        \
        # Cache for 1 hour\
        add_header Cache-Control "public, max-age=3600";\
        \
        # Security headers\
        add_header X-Content-Type-Options "nosniff";\
        \
        # Allow .crx, .xml, .zip downloads\
        types {\
            application/x-chrome-extension crx;\
            application/zip zip;\
            text/plain sha256;\
            text/xml xml;\
        }\
        \
        access_log /var/log/nginx/extension-access.log;\
    }\
' "$NGINX_CONFIG"
    
    log_success "Configuração adicionada"
fi

# Testar configuração Nginx
log_info "Testando configuração Nginx..."
if ! nginx -t >> "$LOG_FILE" 2>&1; then
    log_error "Configuração Nginx inválida"
    
    # Restaurar backup
    if [ -f "$NGINX_CONFIG.backup-pre-extension" ]; then
        cp "$NGINX_CONFIG.backup-pre-extension" "$NGINX_CONFIG"
        log_info "Configuração restaurada"
    fi
    
    rollback
fi
log_success "Configuração Nginx válida"

# Recarregar Nginx (zero downtime)
log_info "Recarregando Nginx..."
if ! systemctl reload nginx >> "$LOG_FILE" 2>&1; then
    log_error "Falha ao recarregar Nginx"
    rollback
fi
log_success "Nginx recarregado com sucesso"

# ============================================================================
# FASE 9: VALIDAÇÃO AUTOMÁTICA
# ============================================================================

log_phase 9 "Validação Automática"

TESTS_PASSED=0
TESTS_TOTAL=6

# Aguardar Nginx estabilizar
sleep 2

# Teste 1: Site principal
log_info "Testando site principal..."
if curl -sS -o /dev/null -w "%{http_code}" "http://$DOMAIN" | grep -q "200\|301\|302"; then
    log_success "✓ Site principal OK"
    ((TESTS_PASSED++))
else
    log_error "✗ Site principal FALHOU"
fi

# Teste 2: Privacy Policy
log_info "Testando privacy policy..."
if curl -sS -o /dev/null -w "%{http_code}" "http://$DOMAIN/privacy-policy.html" | grep -q "200"; then
    log_success "✓ Privacy policy OK"
    ((TESTS_PASSED++))
else
    log_warning "✗ Privacy policy não acessível"
fi

# Teste 3: CRX
log_info "Testando download do .crx..."
if curl -sS -o /dev/null -w "%{http_code}" "http://$DOMAIN/extension/corpmonitor.crx" | grep -q "200"; then
    log_success "✓ CRX acessível"
    ((TESTS_PASSED++))
else
    log_error "✗ CRX não acessível"
fi

# Teste 4: update.xml
log_info "Testando update.xml..."
if curl -sS -o /dev/null -w "%{http_code}" "http://$DOMAIN/extension/update.xml" | grep -q "200"; then
    log_success "✓ update.xml acessível"
    ((TESTS_PASSED++))
else
    log_error "✗ update.xml não acessível"
fi

# Teste 5: SHA256
log_info "Testando corpmonitor.sha256..."
if curl -sS -o /dev/null -w "%{http_code}" "http://$DOMAIN/extension/corpmonitor.sha256" | grep -q "200"; then
    log_success "✓ SHA256 acessível"
    ((TESTS_PASSED++))
else
    log_warning "✗ SHA256 não acessível"
fi

# Teste 6: Processos Nginx
log_info "Verificando processos Nginx..."
if pgrep nginx > /dev/null; then
    NGINX_PROCESSES=$(pgrep nginx | wc -l)
    log_success "✓ Nginx rodando ($NGINX_PROCESSES processos)"
    ((TESTS_PASSED++))
else
    log_error "✗ Nginx não está rodando"
fi

# Resultado da validação
echo ""
if [ $TESTS_PASSED -eq $TESTS_TOTAL ]; then
    log_success "Validação completa: $TESTS_PASSED/$TESTS_TOTAL testes passaram ✓"
else
    log_warning "Validação parcial: $TESTS_PASSED/$TESTS_TOTAL testes passaram"
fi

# ============================================================================
# FASE 10: GERAR RELATÓRIO
# ============================================================================

log_phase 10 "Gerando Relatório"

cat > "$REPORT_FILE" << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RELATÓRIO DE DEPLOY - CORPMONITOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Data/Hora: $(date)
Servidor: $(hostname)
Usuário: $(whoami)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  STATUS DO DEPLOY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Código atualizado via Git
✓ Frontend compilado (React/Vite)
✓ Extensão compilada (.zip + .crx assinado)
✓ Arquivos copiados para $EXTENSION_DEPLOY_DIR
✓ Nginx configurado e recarregado
✓ Validação: $TESTS_PASSED/$TESTS_TOTAL testes passaram

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  URLs PÚBLICAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Site Principal:     http://$DOMAIN
Privacy Policy:     http://$DOMAIN/privacy-policy.html

Extensão CRX:       http://$DOMAIN/extension/corpmonitor.crx
Extensão ZIP:       http://$DOMAIN/extension/corpmonitor.zip
Update XML:         http://$DOMAIN/extension/update.xml
SHA256 Checksum:    http://$DOMAIN/extension/corpmonitor.sha256

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  INFORMAÇÕES DA EXTENSÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Extension ID:       ${EXTENSION_ID:-"(não extraído)"}
SHA256 Hash:        $SHA256_HASH

IMPORTANTE: Use estes valores em:
  1. corpmonitor-installer/source/wix/Registry.wxs
     Substitua [PREENCHER_EXTENSION_ID] por: $EXTENSION_ID
  
  2. corpmonitor-installer/source/wix/Product.wxs
     Adicione: <?define ExtensionId = "$EXTENSION_ID" ?>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ARQUIVOS LOCAIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Frontend:           $PROJECT_ROOT/dist/
Extensão (build):   $EXTENSION_DIR/corpmonitor.{zip,crx}
Extensão (deploy):  $EXTENSION_DEPLOY_DIR/
Backup:             $BACKUP_FILE
Log:                $LOG_FILE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PRÓXIMOS PASSOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Atualizar placeholders no MSI:
   - Abra Registry.wxs e substitua [PREENCHER_EXTENSION_ID]
   - Abra Product.wxs e adicione <?define ExtensionId = "..." ?>

2. Recompilar o MSI (no Windows):
   cd corpmonitor-installer
   .\build-msi.ps1 -Clean

3. Testar instalação:
   - Instale o MSI em máquina de teste
   - Verifique chrome://extensions/
   - Verifique chrome://policy/

4. Deploy via GPO:
   - Copie CorpMonitor.msi para SYSVOL
   - Crie GPO de instalação de software

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ROLLBACK (SE NECESSÁRIO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para reverter este deploy:

1. Restaurar código:
   cd $PROJECT_ROOT
   sudo tar -xzf $BACKUP_FILE --strip-components=1

2. Restaurar Nginx:
   sudo cp $NGINX_CONFIG.backup-${TIMESTAMP} $NGINX_CONFIG
   sudo nginx -t && sudo systemctl reload nginx

3. Verificar:
   sudo systemctl status nginx
   curl -I http://$DOMAIN

Commit do backup: $CURRENT_COMMIT

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

log_success "Relatório gerado: $REPORT_FILE"

# ============================================================================
# RESUMO FINAL
# ============================================================================

echo ""
echo -e "${BOLD}${GREEN}"
cat << "EOF"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ DEPLOY CONCLUÍDO COM SUCESSO!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
echo -e "${NC}"

echo -e "${CYAN}📋 URLs Públicas:${NC}"
echo -e "   ${BOLD}Site:${NC}      http://$DOMAIN"
echo -e "   ${BOLD}Extensão:${NC}  http://$DOMAIN/extension/corpmonitor.crx"
echo -e "   ${BOLD}Update:${NC}    http://$DOMAIN/extension/update.xml"
echo ""

if [ -n "$EXTENSION_ID" ]; then
    echo -e "${CYAN}🔑 Extension ID:${NC} ${BOLD}$EXTENSION_ID${NC}"
fi
echo -e "${CYAN}🔐 SHA256:${NC}       ${BOLD}${SHA256_HASH:0:32}...${NC}"
echo ""

echo -e "${CYAN}📄 Relatório completo:${NC} $REPORT_FILE"
echo -e "${CYAN}📂 Backup:${NC}             $BACKUP_FILE"
echo -e "${CYAN}📜 Log:${NC}                $LOG_FILE"
echo ""

echo -e "${YELLOW}🎯 Próximos Passos:${NC}"
echo -e "   ${GREEN}1.${NC} Atualizar Registry.wxs com Extension ID"
echo -e "   ${GREEN}2.${NC} Recompilar MSI: ${BOLD}.\\build-msi.ps1${NC}"
echo -e "   ${GREEN}3.${NC} Testar instalação via GPO"
echo ""

echo -e "${GREEN}✓ Deploy completo em $(date)${NC}"
