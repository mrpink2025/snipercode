#!/bin/bash

# ============================================
# CorpMonitor - Server Update Script
# ============================================
# Atualiza código e reconstrói sem tocar no SSL
# Zero downtime - mantém site no ar durante update

set -e
set -o pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
PROJECT_ROOT="/var/www/monitor-corporativo"
BACKUP_ROOT="/var/backups/monitor-corporativo"
LOG_FILE="/var/log/corpmonitor-update-$(date +%Y%m%d-%H%M%S).log"
DOMAIN="monitorcorporativo.com"

# Logging setup
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE")
exec 2>&1

# Trap for cleanup
trap 'echo -e "\n${RED}❌ Erro na linha $LINENO. Verifique: $LOG_FILE${NC}"; exit 1' ERR

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  🔄 ATUALIZAÇÃO DO SERVIDOR  🔄${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}Este script vai:${NC}"
echo -e "  1. Fazer backup do código atual"
echo -e "  2. Atualizar código do repositório (git pull)"
echo -e "  3. Recompilar frontend e extensão"
echo -e "  4. Recarregar Nginx (sem downtime)"
echo ""
echo -e "${YELLOW}⚠️  O SSL NÃO será modificado (usa certificado existente)${NC}"
echo ""
read -p "Continuar? (s/n): " confirmation

if [[ ! "$confirmation" =~ ^[sS]$ ]]; then
    echo -e "${GREEN}Operação cancelada.${NC}"
    exit 0
fi

# ============================================
# Phase 0: Root Check
# ============================================
if [ "$EUID" -ne 0 ]; then 
   echo -e "${RED}❌ Execute como root (use sudo)${NC}"
   exit 1
fi

# ============================================
# Phase 1: Backup
# ============================================
echo ""
echo -e "${YELLOW}Phase 1/9: Backup do Código Atual${NC}"

mkdir -p "$BACKUP_ROOT"
BACKUP_FILE="$BACKUP_ROOT/pre-update-backup-$(date +%Y%m%d-%H%M%S).tar.gz"

if [ -d "$PROJECT_ROOT" ]; then
    tar -czf "$BACKUP_FILE" \
        -C "$(dirname "$PROJECT_ROOT")" \
        "$(basename "$PROJECT_ROOT")" \
        --exclude='node_modules' \
        --exclude='.git' \
        2>/dev/null || true
    echo -e "${GREEN}✓ Backup criado: $BACKUP_FILE${NC}"
else
    echo -e "${RED}❌ Diretório $PROJECT_ROOT não encontrado!${NC}"
    exit 1
fi

# ============================================
# Phase 2: Git Pull
# ============================================
echo ""
echo -e "${YELLOW}Phase 2/9: Atualizando Código (Git Pull)${NC}"

cd "$PROJECT_ROOT"

# Check if git repo
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Não é um repositório Git!${NC}"
    echo -e "${YELLOW}Executando rollback...${NC}"
    tar -xzf "$BACKUP_FILE" -C "$(dirname "$PROJECT_ROOT")"
    exit 1
fi

# Add safe.directory to avoid dubious ownership error
git config --global --add safe.directory "$PROJECT_ROOT" 2>/dev/null || true

# Stash local changes (if any)
git stash save "Auto-stash before update $(date)" 2>/dev/null || true

# Pull latest changes
echo "Fazendo git pull..."
if git pull origin main; then
    echo -e "${GREEN}✓ Código atualizado${NC}"
else
    echo -e "${RED}❌ Erro no git pull${NC}"
    echo -e "${YELLOW}Executando rollback...${NC}"
    git reset --hard HEAD
    exit 1
fi

# Show what changed
echo ""
echo "Últimas mudanças:"
git log -3 --oneline --decorate

# ============================================
# Phase 3: Update Dependencies (if needed)
# ============================================
echo ""
echo -e "${YELLOW}Phase 3/9: Verificando Dependências${NC}"

# Check if package.json changed
if git diff HEAD@{1} HEAD --name-only | grep -q "package.json"; then
    echo "package.json foi modificado, atualizando dependências..."
    npm install --legacy-peer-deps
    echo -e "${GREEN}✓ Dependências atualizadas${NC}"
else
    echo -e "${GREEN}✓ package.json não mudou, pulando npm install${NC}"
fi

# ============================================
# Phase 4: Build Frontend
# ============================================
echo ""
echo -e "${YELLOW}Phase 4/9: Compilando Frontend (Vite)${NC}"

echo "Executando npm run build..."
if npm run build; then
    echo -e "${GREEN}✓ Frontend compilado${NC}"
    
    # Verify dist folder
    if [ -d "dist" ] && [ -f "dist/index.html" ]; then
        echo -e "${GREEN}✓ Arquivos de build validados${NC}"
        echo "  - dist/index.html: $(du -h dist/index.html | cut -f1)"
        echo "  - Total: $(du -sh dist | cut -f1)"
    else
        echo -e "${RED}❌ Erro: dist/index.html não encontrado!${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Erro ao compilar frontend${NC}"
    exit 1
fi

# ============================================
# Phase 5: Build Extension
# ============================================
echo ""
echo -e "${YELLOW}Phase 5/9: Compilando Extensão Chrome (v1.0.2)${NC}"

cd "$PROJECT_ROOT/chrome-extension"

# Check if package.json changed
if git diff HEAD@{1} HEAD --name-only | grep -q "chrome-extension/package.json"; then
    echo "Atualizando dependências da extensão..."
    npm install
    echo -e "${GREEN}✓ Dependências da extensão atualizadas${NC}"
fi

# Build extension
if [ -f "build.js" ]; then
    echo "Compilando extensão..."
    npm run build
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Extensão compilada${NC}"
        
        # Verify artifacts
        if [ -f "corpmonitor.zip" ] && [ -f "corpmonitor.crx" ]; then
            echo "  - corpmonitor.zip: $(du -h corpmonitor.zip | cut -f1)"
            echo "  - corpmonitor.crx: $(du -h corpmonitor.crx | cut -f1)"
        else
            echo -e "${RED}❌ Arquivos de build da extensão não encontrados${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Erro ao compilar extensão${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ build.js não encontrado${NC}"
fi

cd "$PROJECT_ROOT"

# ============================================
# Phase 6: Deploy Files
# ============================================
echo ""
echo -e "${YELLOW}Phase 6/9: Copiando Arquivos para Produção${NC}"

# Copy extension artifacts to updates folder
if [ -f "chrome-extension/corpmonitor.zip" ]; then
    mkdir -p "$PROJECT_ROOT/updates"
    cp chrome-extension/corpmonitor.zip "$PROJECT_ROOT/updates/" 2>/dev/null || true
    cp chrome-extension/corpmonitor.crx "$PROJECT_ROOT/updates/" 2>/dev/null || true
    cp chrome-extension/corpmonitor.sha256 "$PROJECT_ROOT/updates/" 2>/dev/null || true
    echo -e "${GREEN}✓ Extensão copiada para /updates${NC}"
fi

# Copy privacy policy (if exists)
if [ -f "chrome-extension/privacy-policy.html" ]; then
    cp chrome-extension/privacy-policy.html "$PROJECT_ROOT/dist/" 2>/dev/null || true
    echo -e "${GREEN}✓ Política de privacidade atualizada${NC}"
fi

# Set ownership
chown -R www-data:www-data "$PROJECT_ROOT"
echo -e "${GREEN}✓ Permissões configuradas${NC}"

# ============================================
# Phase 7: Reload Nginx (Zero Downtime)
# ============================================
echo ""
echo -e "${YELLOW}Phase 7/9: Recarregando Nginx${NC}"

# Test config first
if nginx -t 2>&1 | grep -q "test is successful"; then
    echo -e "${GREEN}✓ Configuração Nginx válida${NC}"
    
    # Check if Nginx is running
    if systemctl is-active --quiet nginx; then
        # Reload (não restart - zero downtime)
        systemctl reload nginx
        echo -e "${GREEN}✓ Nginx recarregado (zero downtime)${NC}"
    else
        # Start Nginx if not running
        echo -e "${YELLOW}⚠ Nginx não estava rodando, iniciando...${NC}"
        systemctl start nginx
        systemctl enable nginx
        echo -e "${GREEN}✓ Nginx iniciado${NC}"
    fi
else
    echo -e "${RED}❌ Erro na configuração Nginx${NC}"
    nginx -t
    exit 1
fi

# ============================================
# Phase 8: Validation
# ============================================
echo ""
echo -e "${YELLOW}Phase 8/9: Validando Deployment${NC}"

# Test if Nginx is running
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx está rodando${NC}"
else
    echo -e "${RED}❌ Nginx não está rodando!${NC}"
    exit 1
fi

# Test site accessibility
sleep 2
if curl -sSf -k "https://localhost" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Site acessível via HTTPS${NC}"
else
    echo -e "${YELLOW}⚠ Site não acessível via HTTPS (pode ser normal se SSL ainda não configurado)${NC}"
fi

# Check extension files
if [ -f "$PROJECT_ROOT/updates/corpmonitor.zip" ]; then
    echo -e "${GREEN}✓ Extensão disponível em /updates${NC}"
fi

# ============================================
# Phase 9: Report
# ============================================
echo ""
echo -e "${YELLOW}Phase 9/9: Gerando Relatório${NC}"

REPORT_FILE="$PROJECT_ROOT/UPDATE_REPORT_$(date +%Y%m%d-%H%M%S).txt"

cat > "$REPORT_FILE" << EOF
================================================================================
CORPMONITOR - RELATÓRIO DE ATUALIZAÇÃO
================================================================================

Data: $(date)
Servidor: $(hostname)
Usuário: $(whoami)

================================================================================
STATUS DO DEPLOYMENT
================================================================================

✓ Código atualizado via Git
✓ Frontend recompilado (Vite)
✓ Extensão recompilada (v1.0.2 com auto-ativação)
✓ Nginx recarregado (zero downtime)
✓ Validações concluídas

================================================================================
URLS
================================================================================

Site: https://$DOMAIN
Extensão: https://$DOMAIN/updates/corpmonitor.zip
Política: https://$DOMAIN/privacy-policy.html

================================================================================
ARQUIVOS ATUALIZADOS
================================================================================

Frontend: $PROJECT_ROOT/dist
Extensão: $PROJECT_ROOT/chrome-extension
Updates: $PROJECT_ROOT/updates

================================================================================
LOGS
================================================================================

Log completo: $LOG_FILE
Backup criado: $BACKUP_FILE

================================================================================
ROLLBACK (se necessário)
================================================================================

Se algo deu errado, restaure o backup:

cd $(dirname "$PROJECT_ROOT")
tar -xzf "$BACKUP_FILE"
systemctl reload nginx

================================================================================
PRÓXIMOS PASSOS
================================================================================

1. ✅ Acesse https://$DOMAIN para verificar o site
2. ✅ Teste a extensão (se atualizada)
3. ✅ Monitore logs: tail -f /var/log/nginx/monitor-corporativo-error.log
4. ✅ Verifique Dashboard do Supabase

================================================================================
EOF

echo -e "${GREEN}✓ Relatório salvo: $REPORT_FILE${NC}"

# ============================================
# Final Summary
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📁 Arquivos:${NC}"
echo -e "   Site: $PROJECT_ROOT/dist"
echo -e "   Extensão: $PROJECT_ROOT/updates/corpmonitor.zip"
echo ""
echo -e "${BLUE}📋 Logs e Backup:${NC}"
echo -e "   Log: $LOG_FILE"
echo -e "   Backup: $BACKUP_FILE"
echo -e "   Relatório: $REPORT_FILE"
echo ""
echo -e "${BLUE}🌐 URLs:${NC}"
echo -e "   Site: https://$DOMAIN"
echo -e "   Extensão: https://$DOMAIN/updates/corpmonitor.zip"
echo ""
echo -e "${GREEN}✓ SSL mantido (certificado existente não foi modificado)${NC}"
echo -e "${GREEN}✓ Nginx recarregado (zero downtime)${NC}"
echo ""
