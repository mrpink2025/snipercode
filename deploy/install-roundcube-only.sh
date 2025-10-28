#!/bin/bash

#================================================================
# Script: Instalação Exclusiva do Roundcube Webmail
# Descrição: Instala APENAS o Roundcube, preservando configurações existentes
# Sistema: Ubuntu 24.04 LTS
# Data: 2025-10-08
#================================================================

set -e  # Parar em qualquer erro

# ============= CONFIGURAÇÕES =============
DOMAIN="chamanasortebet.net"
PROJECT_DIR="/var/www/monitor-corporativo"
WEBMAIL_DIR="${PROJECT_DIR}/webmail"
NGINX_SITE="/etc/nginx/sites-available/monitorcorporativo"
LOG_FILE="/var/log/roundcube-install-$(date +%Y%m%d-%H%M%S).log"

# Credenciais
EMAIL_USER="administrador"
EMAIL_PASS="Vib797d8"
DB_NAME="roundcube"
DB_USER="roundcube_user"
DB_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 20)
ROUNDCUBE_DES_KEY=$(openssl rand -base64 24)

# ============= CORES E LOG =============
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# ============= BANNER =============
clear
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║      📧  INSTALAÇÃO ROUNDCUBE WEBMAIL - v1.0  📧        ║
║                                                           ║
║  Este script instala APENAS o Roundcube                  ║
║  Preserva: Nginx, SSL, Postfix, Dovecot                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo ""

# ============= PHASE 0: VALIDAÇÕES =============
log "Phase 0: Validações Iniciais"

# Verificar root
if [ "$EUID" -ne 0 ]; then 
    error "Este script precisa ser executado como root (use sudo)"
fi

# Verificar se Nginx está rodando
if ! systemctl is-active --quiet nginx; then
    error "Nginx não está rodando! Execute: sudo systemctl start nginx"
fi
info "✓ Nginx está rodando"

# Verificar se o diretório do projeto existe
if [ ! -d "$PROJECT_DIR" ]; then
    error "Diretório do projeto não encontrado: $PROJECT_DIR"
fi
info "✓ Diretório do projeto encontrado"

# Verificar se Roundcube já existe
if [ -d "$WEBMAIL_DIR" ]; then
    warning "Roundcube já está instalado em: $WEBMAIL_DIR"
    read -p "Deseja REMOVER e reinstalar? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        error "Instalação cancelada pelo usuário"
    fi
    log "Removendo instalação antiga..."
    rm -rf "$WEBMAIL_DIR"
fi

# Verificar Postfix e Dovecot
if systemctl is-active --quiet postfix; then
    info "✓ Postfix está rodando"
else
    warning "⚠ Postfix não está rodando (webmail pode não funcionar para enviar emails)"
fi

if systemctl is-active --quiet dovecot; then
    info "✓ Dovecot está rodando"
else
    warning "⚠ Dovecot não está rodando (webmail pode não funcionar para receber emails)"
fi

echo ""

# ============= PHASE 1: INSTALAR PHP =============
log "Phase 1: Instalando PHP 8.3 + FPM"

if command -v php &> /dev/null; then
    PHP_VERSION=$(php -v | head -n 1 | cut -d ' ' -f 2 | cut -d '.' -f 1,2)
    warning "PHP $PHP_VERSION já está instalado"
    if [[ ! "$PHP_VERSION" =~ ^8\.[1-9]$ ]]; then
        log "Instalando PHP 8.3 adicional..."
    fi
fi

apt-get update -qq
apt-get install -y -qq \
    software-properties-common \
    > /dev/null 2>&1

add-apt-repository -y ppa:ondrej/php > /dev/null 2>&1
apt-get update -qq

log "Instalando pacotes PHP..."
apt-get install -y -qq \
    php8.3 \
    php8.3-fpm \
    php8.3-cli \
    php8.3-mysql \
    php8.3-imap \
    php8.3-curl \
    php8.3-mbstring \
    php8.3-xml \
    php8.3-zip \
    php8.3-gd \
    php8.3-intl \
    php8.3-ldap \
    php8.3-pspell \
    > /dev/null 2>&1

systemctl enable php8.3-fpm > /dev/null 2>&1
systemctl start php8.3-fpm

info "✓ PHP 8.3 instalado: $(php -v | head -n 1)"

# ============= PHASE 2: INSTALAR MARIADB =============
log "Phase 2: Instalando MariaDB"

if command -v mysql &> /dev/null || command -v mariadb &> /dev/null; then
    info "✓ MariaDB/MySQL já está instalado"
else
    apt-get install -y -qq mariadb-server mariadb-client > /dev/null 2>&1
    systemctl enable mariadb > /dev/null 2>&1
    systemctl start mariadb
    info "✓ MariaDB instalado"
fi

# ============= PHASE 3: CONFIGURAR BANCO DE DADOS =============
log "Phase 3: Configurando Banco de Dados"

# Criar banco e usuário
mysql -e "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || true
mysql -e "DROP USER IF EXISTS '${DB_USER}'@'localhost';" 2>/dev/null || true

mysql -e "CREATE DATABASE ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

info "✓ Banco de dados '${DB_NAME}' criado"
info "✓ Usuário '${DB_USER}' criado com senha aleatória"

# ============= PHASE 4: BAIXAR ROUNDCUBE =============
log "Phase 4: Baixando Roundcube 1.6.10"

cd /tmp
ROUNDCUBE_VERSION="1.6.10"
ROUNDCUBE_URL="https://github.com/roundcube/roundcubemail/releases/download/${ROUNDCUBE_VERSION}/roundcubemail-${ROUNDCUBE_VERSION}-complete.tar.gz"

if [ -f "roundcubemail-${ROUNDCUBE_VERSION}-complete.tar.gz" ]; then
    rm -f "roundcubemail-${ROUNDCUBE_VERSION}-complete.tar.gz"
fi

log "Baixando de: $ROUNDCUBE_URL"
wget -q --show-progress "$ROUNDCUBE_URL" -O "roundcubemail-${ROUNDCUBE_VERSION}-complete.tar.gz"

if [ ! -f "roundcubemail-${ROUNDCUBE_VERSION}-complete.tar.gz" ]; then
    error "Falha ao baixar Roundcube"
fi

info "✓ Roundcube baixado ($(du -h roundcubemail-${ROUNDCUBE_VERSION}-complete.tar.gz | cut -f1))"

# ============= PHASE 5: INSTALAR ROUNDCUBE =============
log "Phase 5: Instalando Roundcube"

tar -xzf "roundcubemail-${ROUNDCUBE_VERSION}-complete.tar.gz"
mv "roundcubemail-${ROUNDCUBE_VERSION}" "$WEBMAIL_DIR"

cd "$WEBMAIL_DIR"

# Importar schema MySQL
log "Importando schema do banco de dados..."
mysql "$DB_NAME" < SQL/mysql.initial.sql

info "✓ Schema do banco importado"

# ============= PHASE 6: CONFIGURAR ROUNDCUBE =============
log "Phase 6: Configurando Roundcube"

cat > config/config.inc.php << EOCONFIG
<?php

\$config = [];

// Database connection
\$config['db_dsnw'] = 'mysql://${DB_USER}:${DB_PASS}@localhost/${DB_NAME}';

// IMAP connection (Dovecot)
\$config['imap_host'] = 'ssl://localhost:993';
\$config['imap_conn_options'] = [
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false,
    ],
];

// SMTP connection (Postfix)
\$config['smtp_host'] = 'tls://localhost:587';
\$config['smtp_user'] = '%u';
\$config['smtp_pass'] = '%p';
\$config['smtp_conn_options'] = [
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false,
    ],
];

// Display settings
\$config['product_name'] = 'Monitor Corporativo Webmail';
\$config['des_key'] = '${ROUNDCUBE_DES_KEY}';
\$config['plugins'] = ['archive', 'zipdownload', 'managesieve'];

// Security
\$config['enable_installer'] = false;
\$config['session_lifetime'] = 30;
\$config['force_https'] = true;
\$config['login_autocomplete'] = 2;

// Default settings
\$config['default_host'] = 'ssl://localhost';
\$config['default_port'] = 993;
\$config['username_domain'] = '${DOMAIN}';
\$config['mail_domain'] = '${DOMAIN}';

// Language
\$config['language'] = 'pt_BR';
\$config['timezone'] = 'America/Sao_Paulo';

// Logging
\$config['log_driver'] = 'file';
\$config['log_dir'] = 'logs/';
\$config['temp_dir'] = 'temp/';

// Performance
\$config['enable_caching'] = true;
\$config['messages_cache'] = 'db';

EOCONFIG

info "✓ Arquivo config/config.inc.php criado"

# Ajustar permissões
chown -R www-data:www-data "$WEBMAIL_DIR"
chmod -R 755 "$WEBMAIL_DIR"
chmod -R 770 "$WEBMAIL_DIR/temp" "$WEBMAIL_DIR/logs"

info "✓ Permissões ajustadas"

# ============= PHASE 7: CONFIGURAR NGINX =============
log "Phase 7: Integrando com Nginx"

# Backup da configuração atual
cp "$NGINX_SITE" "${NGINX_SITE}.backup-$(date +%Y%m%d-%H%M%S)"
info "✓ Backup da configuração Nginx criado"

# Verificar se já existe configuração do webmail
if grep -q "location.*webmail" "$NGINX_SITE"; then
    warning "Bloco 'location /webmail' já existe no Nginx, pulando..."
else
    log "Adicionando bloco /webmail ao Nginx..."
    
    # Adicionar antes do fechamento do bloco server (antes da última chave })
    # Procurar a linha antes do último }
    LAST_BRACE=$(grep -n "^}" "$NGINX_SITE" | tail -1 | cut -d: -f1)
    
    # Criar arquivo temporário com a nova configuração
    head -n $((LAST_BRACE - 1)) "$NGINX_SITE" > "${NGINX_SITE}.tmp"
    
    cat >> "${NGINX_SITE}.tmp" << 'EONFCONFIG'

    # ========== ROUNDCUBE WEBMAIL ==========
    location ^~ /webmail {
        alias /var/www/monitor-corporativo/webmail;
        index index.php index.html;
        
        # Bloquear acesso a diretórios sensíveis
        location ~ ^/webmail/(config|temp|logs|bin|SQL|README|INSTALL|LICENSE|CHANGELOG|UPGRADING)/ {
            deny all;
        }
        
        # Processar PHP
        location ~ ^/webmail/(.+\.php)$ {
            alias /var/www/monitor-corporativo/webmail/$1;
            include snippets/fastcgi-php.conf;
            fastcgi_pass unix:/run/php/php8.3-fpm.sock;
            fastcgi_param SCRIPT_FILENAME $request_filename;
            fastcgi_param PHP_VALUE "upload_max_filesize=20M \n post_max_size=25M";
        }
        
        # Bloquear arquivos ocultos
        location ~ /\. {
            deny all;
            access_log off;
            log_not_found off;
        }
    }

EONFCONFIG
    
    # Adicionar o resto do arquivo
    tail -n +$LAST_BRACE "$NGINX_SITE" >> "${NGINX_SITE}.tmp"
    
    # Substituir o arquivo original
    mv "${NGINX_SITE}.tmp" "$NGINX_SITE"
    
    info "✓ Configuração do webmail adicionada ao Nginx"
fi

# Testar configuração do Nginx
log "Testando configuração do Nginx..."
if nginx -t 2>&1 | tee -a "$LOG_FILE"; then
    info "✓ Configuração do Nginx válida"
    systemctl reload nginx
    info "✓ Nginx recarregado"
else
    error "Erro na configuração do Nginx! Restaurando backup..."
    cp "${NGINX_SITE}.backup-$(date +%Y%m%d-%H%M%S)" "$NGINX_SITE"
    systemctl reload nginx
    exit 1
fi

# ============= PHASE 8: AJUSTES PHP-FPM =============
log "Phase 8: Otimizando PHP-FPM"

PHP_INI="/etc/php/8.3/fpm/php.ini"
if [ -f "$PHP_INI" ]; then
    sed -i 's/upload_max_filesize = .*/upload_max_filesize = 20M/' "$PHP_INI"
    sed -i 's/post_max_size = .*/post_max_size = 25M/' "$PHP_INI"
    sed -i 's/max_execution_time = .*/max_execution_time = 300/' "$PHP_INI"
    sed -i 's/memory_limit = .*/memory_limit = 256M/' "$PHP_INI"
    
    systemctl restart php8.3-fpm
    info "✓ PHP-FPM otimizado e reiniciado"
fi

# ============= PHASE 9: VALIDAÇÃO =============
log "Phase 9: Validação Final"

# Testar acesso ao webmail
sleep 2
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}/webmail/")

if [ "$HTTP_CODE" = "200" ]; then
    info "✓ Webmail acessível (HTTP $HTTP_CODE)"
else
    warning "⚠ Webmail retornou HTTP $HTTP_CODE (pode ser normal se redirecionando)"
fi

# Verificar serviços
systemctl is-active --quiet nginx && info "✓ Nginx rodando" || warning "⚠ Nginx não está rodando"
systemctl is-active --quiet php8.3-fpm && info "✓ PHP-FPM rodando" || warning "⚠ PHP-FPM não está rodando"
systemctl is-active --quiet mariadb && info "✓ MariaDB rodando" || warning "⚠ MariaDB não está rodando"

# ============= PHASE 10: GERAR RELATÓRIO =============
log "Phase 10: Gerando Relatório"

REPORT_FILE="${PROJECT_DIR}/ROUNDCUBE_INSTALL.txt"

cat > "$REPORT_FILE" << EOREPORT
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║       📧  ROUNDCUBE WEBMAIL - INSTALAÇÃO CONCLUÍDA  📧          ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝

Data: $(date '+%d/%m/%Y %H:%M:%S')
Domínio: ${DOMAIN}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 ACESSO AO WEBMAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

URL Principal:   https://${DOMAIN}/webmail

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📧 CREDENCIAIS DE EMAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usuário:  ${EMAIL_USER}@${DOMAIN}
Senha:    ${EMAIL_PASS}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗄️  BANCO DE DADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Nome do Banco:  ${DB_NAME}
Usuário:        ${DB_USER}
Senha:          ${DB_PASS}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 CAMINHOS IMPORTANTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Instalação:       ${WEBMAIL_DIR}
Configuração:     ${WEBMAIL_DIR}/config/config.inc.php
Logs Roundcube:   ${WEBMAIL_DIR}/logs/
Logs PHP-FPM:     /var/log/php8.3-fpm.log
Nginx Config:     ${NGINX_SITE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 COMANDOS ÚTEIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Ver logs do Roundcube
sudo tail -f ${WEBMAIL_DIR}/logs/errors.log

# Ver logs do PHP-FPM
sudo tail -f /var/log/php8.3-fpm.log

# Reiniciar serviços
sudo systemctl restart php8.3-fpm
sudo systemctl reload nginx

# Verificar permissões
sudo chown -R www-data:www-data ${WEBMAIL_DIR}

# Testar banco de dados
mysql -u ${DB_USER} -p ${DB_NAME}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ PRÓXIMOS PASSOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Acesse: https://${DOMAIN}/webmail
2. Faça login com: ${EMAIL_USER}@${DOMAIN} / ${EMAIL_PASS}
3. Configure identidades e assinaturas
4. Teste envio e recebimento de emails

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛡️  SEGURANÇA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Instalador desabilitado (enable_installer = false)
• HTTPS forçado (force_https = true)
• Sessão expira em 30 minutos
• Logs em: ${WEBMAIL_DIR}/logs/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 STATUS DOS SERVIÇOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Nginx:     $(systemctl is-active nginx)
PHP-FPM:   $(systemctl is-active php8.3-fpm)
MariaDB:   $(systemctl is-active mariadb)
Postfix:   $(systemctl is-active postfix 2>/dev/null || echo "não verificado")
Dovecot:   $(systemctl is-active dovecot 2>/dev/null || echo "não verificado")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🐛 TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Se o login não funcionar:
1. Verifique se Postfix/Dovecot estão rodando
2. Teste conexão IMAP: telnet localhost 993
3. Verifique logs: tail -f ${WEBMAIL_DIR}/logs/errors.log
4. Confirme que o usuário de email existe:
   sudo doveadm user ${EMAIL_USER}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTALAÇÃO CONCLUÍDA COM SUCESSO! 🎉

Log completo: ${LOG_FILE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOREPORT

chmod 600 "$REPORT_FILE"
info "✓ Relatório salvo em: $REPORT_FILE"

# ============= CONCLUSÃO =============
echo ""
echo ""
cat << "EOBANNER"
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║             ✅  ROUNDCUBE INSTALADO COM SUCESSO!  ✅            ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
EOBANNER
echo ""
log "🌐 Acesse: https://${DOMAIN}/webmail"
log "📧 Login: ${EMAIL_USER}@${DOMAIN}"
log "🔑 Senha: ${EMAIL_PASS}"
echo ""
log "📄 Relatório completo: $REPORT_FILE"
log "📋 Log de instalação: $LOG_FILE"
echo ""
log "Para ver o relatório completo:"
echo "   cat $REPORT_FILE"
echo ""

exit 0
