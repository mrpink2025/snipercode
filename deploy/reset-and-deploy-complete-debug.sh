#!/bin/bash

# ============================================
# CorpMonitor - Complete Server Reset & Deploy (DEBUG MODE)
# ============================================
# ATENÇÃO: Este script APAGA TUDO e reconfigura do zero!
# Versão DEBUG com saída completa e pausas entre fases.

set -e  # Exit on any error
set -o pipefail  # Exit on pipe failures
set -x  # Debug mode - print all commands

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="/var/www/monitor-corporativo"
NGINX_CONF="/etc/nginx/sites-available/monitor-corporativo"
NGINX_ENABLED="/etc/nginx/sites-enabled/monitor-corporativo"
BACKUP_ROOT="/var/backups/monitor-corporativo"
DOMAIN="monitorcorporativo.com"

# Logging
LOG_FILE="/var/log/corpmonitor-deploy-debug-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE")
exec 2>&1

echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}  ⚠️  RESET COMPLETO (DEBUG MODE)  ⚠️${NC}"
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}📝 Log completo sendo salvo em: $LOG_FILE${NC}"
echo ""
echo -e "${RED}ATENÇÃO: Este script vai:${NC}"
echo -e "${RED}  1. APAGAR todo o conteúdo de $PROJECT_ROOT${NC}"
echo -e "${RED}  2. REMOVER configurações Nginx${NC}"
echo -e "${RED}  3. LIMPAR caches e logs${NC}"
echo -e "${RED}  4. RECONFIGURAR tudo do zero${NC}"
echo ""
echo -e "${YELLOW}Modo DEBUG: Todas as operações serão exibidas${NC}"
echo -e "${YELLOW}O script irá pausar entre fases para revisão${NC}"
echo ""
read -p "Tem certeza que deseja continuar? (digite 'SIM' em maiúsculas): " confirmation

if [ "$confirmation" != "SIM" ]; then
    echo -e "${GREEN}Operação cancelada pelo usuário.${NC}"
    exit 0
fi

pause_between_phases() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    read -p "Pressione ENTER para continuar para a próxima fase..."
    echo ""
}

echo ""
echo -e "${BLUE}Iniciando reset completo em modo DEBUG...${NC}"
echo ""

# ============================================
# PHASE 0: Root Check
# ============================================
if [ "$EUID" -ne 0 ]; then 
   echo -e "${RED}❌ Execute como root (use sudo)${NC}"
   exit 1
fi

echo -e "${GREEN}✓ Executando como root${NC}"
pause_between_phases

# ============================================
# PHASE 1: Critical Backup
# ============================================
echo -e "${YELLOW}Phase 1/10: Backup Crítico${NC}"

mkdir -p "$BACKUP_ROOT"
BACKUP_FILE="$BACKUP_ROOT/pre-reset-backup-$(date +%Y%m%d-%H%M%S).tar.gz"

if [ -d "$PROJECT_ROOT" ]; then
    echo "Listando conteúdo atual do projeto:"
    ls -lah "$PROJECT_ROOT"
    echo ""
    echo "Criando backup completo..."
    tar -czf "$BACKUP_FILE" \
        -C "$(dirname "$PROJECT_ROOT")" \
        "$(basename "$PROJECT_ROOT")" \
        || true
    echo -e "${GREEN}✓ Backup salvo: $BACKUP_FILE${NC}"
    echo "Tamanho do backup: $(du -h "$BACKUP_FILE" | cut -f1)"
else
    echo -e "${YELLOW}⚠ Diretório do projeto não existe, pulando backup${NC}"
fi

# Backup Nginx config
if [ -f "$NGINX_CONF" ]; then
    echo "Backup da configuração Nginx atual:"
    cp "$NGINX_CONF" "$BACKUP_ROOT/nginx-backup-$(date +%Y%m%d-%H%M%S).conf"
    cat "$NGINX_CONF"
    echo -e "${GREEN}✓ Backup Nginx salvo${NC}"
fi

pause_between_phases

# ============================================
# PHASE 2: Stop Services
# ============================================
echo -e "${YELLOW}Phase 2/10: Parando Serviços${NC}"

echo "Status atual do Nginx:"
systemctl status nginx --no-pager || true
echo ""

systemctl stop nginx || true
echo -e "${GREEN}✓ Nginx parado${NC}"

echo "Processos Node em execução:"
ps aux | grep node || true
echo ""

# Kill any Node processes in project directory
pkill -f "$PROJECT_ROOT" || true
echo -e "${GREEN}✓ Processos Node encerrados${NC}"

pause_between_phases

# ============================================
# PHASE 3: Remove Everything
# ============================================
echo -e "${YELLOW}Phase 3/10: Removendo Configurações Antigas${NC}"

# Remove project directory
if [ -d "$PROJECT_ROOT" ]; then
    echo "Removendo diretório do projeto..."
    echo "Conteúdo antes da remoção:"
    du -sh "$PROJECT_ROOT"
    rm -rf "$PROJECT_ROOT"
    echo -e "${GREEN}✓ Diretório do projeto removido${NC}"
fi

# Remove Nginx configs
if [ -f "$NGINX_CONF" ]; then
    rm -f "$NGINX_CONF"
    echo -e "${GREEN}✓ Configuração Nginx removida${NC}"
fi

if [ -L "$NGINX_ENABLED" ]; then
    rm -f "$NGINX_ENABLED"
    echo -e "${GREEN}✓ Symlink Nginx removido${NC}"
fi

# Clear Nginx cache
if [ -d "/var/cache/nginx" ]; then
    echo "Conteúdo do cache Nginx:"
    du -sh /var/cache/nginx/* 2>/dev/null || true
    rm -rf /var/cache/nginx/*
    echo -e "${GREEN}✓ Cache Nginx limpo${NC}"
fi

# Clear logs
if [ -d "/var/log/nginx" ]; then
    find /var/log/nginx -name "*monitor*" -type f -delete || true
    echo -e "${GREEN}✓ Logs antigos removidos${NC}"
fi

pause_between_phases

# ============================================
# Function: Install Node.js 20.x
# ============================================
install_nodejs() {
    echo "Instalando Node.js 20.x via NodeSource..."
    
    # Remove old nodejs if exists
    echo "Removendo versões antigas do Node.js..."
    apt-get remove -y nodejs npm || true
    
    # Install Node.js 20.x
    echo "Baixando script de instalação do NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    
    echo "Instalando Node.js..."
    apt-get install -y nodejs
    
    # Verify installation
    if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Node.js $(node --version) instalado${NC}"
        echo -e "${GREEN}✓ npm $(npm --version) instalado${NC}"
        return 0
    else
        echo -e "${RED}❌ Falha ao instalar Node.js${NC}"
        return 1
    fi
}

# ============================================
# PHASE 4: Install Dependencies
# ============================================
echo -e "${YELLOW}Phase 4/10: Instalando Dependências${NC}"

echo "Atualizando lista de pacotes..."
apt-get update

echo ""
echo "Pacotes atualmente instalados:"
dpkg -l | grep -E "nginx|nodejs|npm|git|curl|zip" || true
echo ""

# Install basic packages (npm removed - comes with nodejs)
PACKAGES="nginx git curl zip unzip"
for pkg in $PACKAGES; do
    if ! dpkg -l | grep -q "^ii  $pkg "; then
        echo "Instalando $pkg..."
        apt-get install -y $pkg
        echo -e "${GREEN}✓ $pkg instalado${NC}"
    else
        echo -e "${GREEN}✓ $pkg já instalado${NC}"
    fi
done

# Check Node.js version
echo ""
echo "Verificando Node.js..."
if command -v node >/dev/null 2>&1; then
    echo "Node.js encontrado: $(node --version)"
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${YELLOW}⚠ Node.js versão antiga detectada (v$NODE_VERSION)${NC}"
        install_nodejs
    else
        echo -e "${GREEN}✓ Node.js $(node --version) já instalado${NC}"
        echo -e "${GREEN}✓ npm $(npm --version) já instalado${NC}"
    fi
else
    echo "Node.js não encontrado, instalando..."
    install_nodejs
fi

# Validate environment
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Validando ambiente instalado..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
nginx -v
node --version
npm --version
git --version
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ Todos os componentes validados${NC}"

pause_between_phases

# ============================================
# PHASE 5: Create Project Structure
# ============================================
echo -e "${YELLOW}Phase 5/10: Criando Estrutura do Projeto${NC}"

mkdir -p "$PROJECT_ROOT"/{dist,chrome-extension,updates,logs,backups}
echo "Estrutura criada:"
tree -L 2 "$PROJECT_ROOT" || ls -laR "$PROJECT_ROOT"
echo -e "${GREEN}✓ Estrutura de diretórios criada${NC}"

# Set ownership
chown -R www-data:www-data "$PROJECT_ROOT"
echo "Permissões:"
ls -la "$PROJECT_ROOT"
echo -e "${GREEN}✓ Permissões configuradas${NC}"

pause_between_phases

# ============================================
# PHASE 6: Clone/Copy Project Files
# ============================================
echo -e "${YELLOW}Phase 6/10: Copiando Arquivos do Projeto${NC}"

FILES_COPIED=false

echo "Verificando diretório atual: $(pwd)"
echo "Conteúdo:"
ls -la

# Option 1: Copy from local directory
if [ -d "./dist" ] && [ -d "./chrome-extension" ]; then
    echo "Encontrados arquivos no diretório local..."
    
    if [ -f "./chrome-extension/manifest.json" ]; then
        echo "Copiando arquivos do diretório local..."
        cp -rv ./dist/* "$PROJECT_ROOT/dist/"
        cp -rv ./chrome-extension/* "$PROJECT_ROOT/chrome-extension/"
        echo -e "${GREEN}✓ Arquivos copiados do diretório local${NC}"
        FILES_COPIED=true
    else
        echo -e "${YELLOW}⚠ Arquivos de origem incompletos${NC}"
    fi
fi

# Option 2: Clone from Git if local copy failed
if [ "$FILES_COPIED" = false ]; then
    echo -e "${YELLOW}Arquivos locais não encontrados.${NC}"
    echo "Deseja clonar do Git? (s/n)"
    read -p "Resposta: " CLONE_GIT
    
    if [ "$CLONE_GIT" = "s" ] || [ "$CLONE_GIT" = "S" ]; then
        echo "Digite a URL do repositório Git:"
        read -p "URL: " GIT_URL
        
        if [ ! -z "$GIT_URL" ]; then
            echo "Clonando do repositório Git..."
            git clone "$GIT_URL" "$PROJECT_ROOT/temp"
            
            echo "Conteúdo clonado:"
            ls -la "$PROJECT_ROOT/temp"
            
            # Copy files
            if [ -d "$PROJECT_ROOT/temp/chrome-extension" ]; then
                cp -rv "$PROJECT_ROOT/temp/chrome-extension/"* "$PROJECT_ROOT/chrome-extension/"
                cp -rv "$PROJECT_ROOT/temp/dist/"* "$PROJECT_ROOT/dist/" || true
                echo -e "${GREEN}✓ Arquivos clonados do Git${NC}"
                FILES_COPIED=true
            fi
            
            rm -rf "$PROJECT_ROOT/temp"
        fi
    fi
fi

# Verify critical files
echo ""
echo "Verificando arquivos críticos..."
if [ -f "$PROJECT_ROOT/chrome-extension/manifest.json" ]; then
    echo "manifest.json encontrado:"
    cat "$PROJECT_ROOT/chrome-extension/manifest.json"
    echo -e "${GREEN}✓ Arquivos do projeto verificados${NC}"
else
    echo -e "${RED}❌ ERRO: manifest.json não encontrado!${NC}"
    echo "Conteúdo do diretório chrome-extension:"
    ls -la "$PROJECT_ROOT/chrome-extension/"
    exit 1
fi

pause_between_phases

# ============================================
# PHASE 7: Build Extension
# ============================================
echo -e "${YELLOW}Phase 7/10: Compilando Extensão${NC}"

if [ -d "$PROJECT_ROOT/chrome-extension" ]; then
    cd "$PROJECT_ROOT/chrome-extension"
    
    echo "Diretório atual: $(pwd)"
    echo "Conteúdo:"
    ls -la
    
    # Install dependencies
    if [ -f "package.json" ]; then
        echo "package.json encontrado:"
        cat package.json
        echo ""
        echo "Instalando dependências da extensão..."
        npm install
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Dependências instaladas${NC}"
            echo "node_modules criado:"
            ls -la node_modules/ | head -20
        else
            echo -e "${RED}❌ Erro ao instalar dependências${NC}"
            exit 1
        fi
    fi
    
    # Build extension
    if [ -f "build.js" ]; then
        echo "Executando build..."
        npm run build
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Extensão compilada${NC}"
            echo "Arquivos gerados:"
            ls -lh corpmonitor.*
        else
            echo -e "${RED}❌ Erro ao compilar extensão${NC}"
            exit 1
        fi
        
        # Copy artifacts
        if [ -f "corpmonitor.zip" ] && [ -f "corpmonitor.crx" ]; then
            cp -v corpmonitor.zip corpmonitor.crx corpmonitor.sha256 "$PROJECT_ROOT/updates/"
            
            echo "Arquivos copiados para updates:"
            ls -lh "$PROJECT_ROOT/updates/"
            echo -e "${GREEN}✓ Arquivos copiados${NC}"
        else
            echo -e "${RED}❌ Arquivos de build não encontrados${NC}"
            exit 1
        fi
    fi
    
    # Copy privacy policy
    if [ -f "privacy-policy.html" ]; then
        cp -v privacy-policy.html "$PROJECT_ROOT/dist/"
        echo -e "${GREEN}✓ Política de privacidade copiada${NC}"
    fi
    
    cd - > /dev/null
else
    echo -e "${RED}❌ Diretório chrome-extension não encontrado${NC}"
    exit 1
fi

pause_between_phases

# ============================================
# PHASE 8: Configure Nginx
# ============================================
echo -e "${YELLOW}Phase 8/10: Configurando Nginx${NC}"

cat > "$NGINX_CONF" << 'NGINX_EOF'
server {
    listen 80;
    listen [::]:80;
    server_name monitorcorporativo.com www.monitorcorporativo.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name monitorcorporativo.com www.monitorcorporativo.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/monitorcorporativo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/monitorcorporativo.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Root and Index
    root /var/www/monitor-corporativo/dist;
    index index.html;

    # Logging
    access_log /var/log/nginx/monitor-corporativo-access.log;
    error_log /var/log/nginx/monitor-corporativo-error.log;

    # Main Location
    location / {
        try_files $uri $uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Privacy Policy
    location = /privacy-policy.html {
        root /var/www/monitor-corporativo/dist;
        add_header Cache-Control "public, max-age=3600";
        add_header Content-Type "text/html; charset=UTF-8";
        access_log /var/log/nginx/privacy-policy-access.log;
    }

    # Extension Updates
    location /updates/ {
        alias /var/www/monitor-corporativo/updates/;
        autoindex off;
        
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, HEAD" always;
        add_header Access-Control-Allow-Headers "Content-Type" always;
        add_header Cache-Control "public, max-age=3600";
        add_header X-Content-Type-Options "nosniff" always;
        
        types {
            application/x-chrome-extension crx;
            application/zip zip;
            text/plain sha256;
        }
        
        access_log /var/log/nginx/extension-updates-access.log;
    }

    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~ /\.git {
        deny all;
    }
}
NGINX_EOF

echo "Configuração Nginx criada:"
cat "$NGINX_CONF"
echo -e "${GREEN}✓ Configuração Nginx criada${NC}"

# Enable site
ln -sf "$NGINX_CONF" "$NGINX_ENABLED"
echo -e "${GREEN}✓ Site habilitado${NC}"

# Test configuration
echo "Testando configuração Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Configuração Nginx válida${NC}"
else
    echo -e "${RED}❌ Erro na configuração Nginx${NC}"
    exit 1
fi

pause_between_phases

# ============================================
# PHASE 9: Start Services
# ============================================
echo -e "${YELLOW}Phase 9/10: Iniciando Serviços${NC}"

systemctl start nginx
systemctl enable nginx
echo -e "${GREEN}✓ Nginx iniciado e habilitado${NC}"

systemctl reload nginx
echo -e "${GREEN}✓ Nginx recarregado${NC}"

echo "Status do Nginx:"
systemctl status nginx --no-pager

pause_between_phases

# ============================================
# PHASE 10: Validation
# ============================================
echo -e "${YELLOW}Phase 10/10: Validação${NC}"

# Test Nginx status
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx está rodando${NC}"
else
    echo -e "${RED}❌ Nginx não está rodando${NC}"
fi

# Test main site
echo "Testando site principal..."
curl -I http://localhost

# Test privacy policy
echo ""
echo "Verificando privacy policy..."
if [ -f "$PROJECT_ROOT/dist/privacy-policy.html" ]; then
    echo -e "${GREEN}✓ Política de privacidade existe${NC}"
    echo "Conteúdo (primeiras linhas):"
    head -20 "$PROJECT_ROOT/dist/privacy-policy.html"
else
    echo -e "${RED}❌ Política de privacidade não encontrada${NC}"
fi

# Test extension files
echo ""
echo "Verificando arquivos da extensão..."
if [ -f "$PROJECT_ROOT/updates/corpmonitor.crx" ]; then
    echo -e "${GREEN}✓ Extensão (CRX) existe${NC}"
    ls -lh "$PROJECT_ROOT/updates/corpmonitor.crx"
else
    echo -e "${YELLOW}⚠ Extensão (CRX) não encontrada${NC}"
fi

if [ -f "$PROJECT_ROOT/updates/corpmonitor.zip" ]; then
    echo -e "${GREEN}✓ Extensão (ZIP) existe${NC}"
    ls -lh "$PROJECT_ROOT/updates/corpmonitor.zip"
else
    echo -e "${YELLOW}⚠ Extensão (ZIP) não encontrada${NC}"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ DEPLOY COMPLETO (DEBUG)${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}📝 Log completo salvo em: $LOG_FILE${NC}"
echo -e "${CYAN}📁 Backup salvo em: $BACKUP_FILE${NC}"
echo ""
echo -e "${YELLOW}Revise o log para detalhes completos da instalação.${NC}"
echo ""
