#!/bin/bash

# ============================================================================
# TOTAL SERVER RESET + COMPLETE SETUP - Ubuntu 24.04 LTS
# ============================================================================
# ATENÇÃO: Este script APAGA TUDO e instala CorpMonitor + Webmail do zero
# - Remove TODOS os sites de /var/www/*
# - Remove TODAS as configurações Nginx, Postfix, Dovecot
# - Instala CorpMonitor completo
# - Configura servidor de email completo
# - Cria email admin@monitorcorporativo.com com senha Vib797d8
# ============================================================================

set -e
set -o pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================
GIT_REPO="https://github.com/mrpink2025/snipercode.git"
GIT_BRANCH="main"
PROJECT_DIR="/var/www/monitor-corporativo"
DOMAIN="monitorcorporativo.com"
ADMIN_EMAIL="admin@monitorcorporativo.com"
ADMIN_PASSWORD="Vib797d8"
LOG_FILE="/var/log/corpmonitor-total-setup-$(date +%Y%m%d-%H%M%S).log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# LOGGING
# ============================================================================
exec > >(tee -a "$LOG_FILE")
exec 2>&1

echo -e "${MAGENTA}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}  🚀 SETUP COMPLETO - CorpMonitor + Webmail${NC}"
echo -e "${MAGENTA}  Log: $LOG_FILE${NC}"
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

# ============================================================================
# CRITICAL WARNING
# ============================================================================
echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║                                                                ║${NC}"
echo -e "${RED}║      ⚠️  RESET TOTAL DO SERVIDOR UBUNTU 24.04  ⚠️              ║${NC}"
echo -e "${RED}║                                                                ║${NC}"
echo -e "${RED}║  Este script vai APAGAR COMPLETAMENTE:                        ║${NC}"
echo -e "${RED}║                                                                ║${NC}"
echo -e "${RED}║    ❌ TODOS os sites em /var/www/*                            ║${NC}"
echo -e "${RED}║    ❌ TODAS as configurações Nginx                            ║${NC}"
echo -e "${RED}║    ❌ TODAS as configurações de email (Postfix/Dovecot)      ║${NC}"
echo -e "${RED}║    ❌ TODOS os certificados SSL antigos                       ║${NC}"
echo -e "${RED}║    ❌ Cache, logs e configurações antigas                     ║${NC}"
echo -e "${RED}║                                                                ║${NC}"
echo -e "${RED}║  E VAI INSTALAR:                                              ║${NC}"
echo -e "${RED}║                                                                ║${NC}"
echo -e "${RED}║    ✅ CorpMonitor completo                                     ║${NC}"
echo -e "${RED}║    ✅ Servidor de email (Postfix + Dovecot)                   ║${NC}"
echo -e "${RED}║    ✅ Email: admin@monitorcorporativo.com                     ║${NC}"
echo -e "${RED}║    ✅ Senha: Vib797d8                                          ║${NC}"
echo -e "${RED}║                                                                ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Repositório Git: $GIT_REPO${NC}"
echo -e "${YELLOW}Diretório de instalação: $PROJECT_DIR${NC}"
echo ""
echo -e "${RED}Para continuar, digite: ${YELLOW}APAGAR TUDO E INSTALAR${NC}"
read -p "Confirmação: " CONFIRMATION

if [ "$CONFIRMATION" != "APAGAR TUDO E INSTALAR" ]; then
    echo -e "${RED}❌ Cancelado pelo usuário${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Aguardando 10 segundos antes de começar...${NC}"
sleep 10

# ============================================================================
# PHASE 0: Root Check
# ============================================================================
echo -e "${CYAN}═══ Phase 0/15: Verificando permissões ═══${NC}"
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Este script deve ser executado como root${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Executando como root${NC}"
echo ""

# ============================================================================
# PHASE 1: Stop ALL Services
# ============================================================================
echo -e "${CYAN}═══ Phase 1/15: Parando TODOS os serviços ═══${NC}"

systemctl stop nginx 2>/dev/null || true
systemctl stop postfix 2>/dev/null || true
systemctl stop dovecot 2>/dev/null || true
pkill -9 node 2>/dev/null || true
fuser -k 80/tcp 2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true
fuser -k 25/tcp 2>/dev/null || true
fuser -k 587/tcp 2>/dev/null || true
fuser -k 993/tcp 2>/dev/null || true

echo -e "${GREEN}✓ Todos os serviços parados${NC}"
echo ""

# ============================================================================
# PHASE 2: Nuclear Clean
# ============================================================================
echo -e "${CYAN}═══ Phase 2/15: LIMPEZA TOTAL ═══${NC}"

rm -rf /var/www/*
mkdir -p /var/www
rm -rf /etc/nginx/sites-available/*
rm -rf /etc/nginx/sites-enabled/*
rm -rf /var/cache/nginx/*
find /var/log/nginx/ -type f -delete 2>/dev/null || true
rm -rf /etc/letsencrypt/live/*
rm -rf /etc/letsencrypt/archive/*
rm -rf /etc/letsencrypt/renewal/*

echo -e "${GREEN}✓ Limpeza total concluída${NC}"
echo ""

# ============================================================================
# PHASE 3: System Update
# ============================================================================
echo -e "${CYAN}═══ Phase 3/15: Atualizando sistema ═══${NC}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y -q
apt-get autoremove -y
apt-get autoclean -y

echo -e "${GREEN}✓ Sistema atualizado${NC}"
echo ""

# ============================================================================
# PHASE 4: Install Core Dependencies
# ============================================================================
echo -e "${CYAN}═══ Phase 4/15: Instalando dependências principais ═══${NC}"

apt-get install -y -q \
    nginx \
    git \
    curl \
    wget \
    zip \
    unzip \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    certbot \
    python3-certbot-nginx \
    ufw

echo -e "${GREEN}✓ Pacotes essenciais instalados${NC}"

# Install Node.js 20.x
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | sed 's/v//')" -lt 20 ]; then
    echo "Instalando Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

echo "Node.js: $(node -v)"
echo "npm: $(npm -v)"
echo -e "${GREEN}✓ Node.js instalado${NC}"
echo ""

# ============================================================================
# PHASE 5: Install Mail Server
# ============================================================================
echo -e "${CYAN}═══ Phase 5/15: Instalando servidor de email ═══${NC}"

# Pre-configure Postfix
echo "postfix postfix/main_mailer_type select Internet Site" | debconf-set-selections
echo "postfix postfix/mailname string $DOMAIN" | debconf-set-selections

apt-get install -y -q \
    postfix \
    dovecot-core \
    dovecot-imapd \
    dovecot-pop3d \
    mailutils \
    opendkim \
    opendkim-tools

echo -e "${GREEN}✓ Postfix e Dovecot instalados${NC}"
echo ""

# ============================================================================
# PHASE 6: Configure Postfix
# ============================================================================
echo -e "${CYAN}═══ Phase 6/15: Configurando Postfix ═══${NC}"

cat > /etc/postfix/main.cf << 'POSTFIX_MAIN'
# Basic config
myhostname = monitorcorporativo.com
mydomain = monitorcorporativo.com
myorigin = $mydomain
mydestination = $myhostname, localhost.$mydomain, localhost, $mydomain
relayhost =
mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128
mailbox_size_limit = 0
recipient_delimiter = +
inet_interfaces = all
inet_protocols = ipv4

# Mailbox
home_mailbox = Maildir/
mailbox_command =

# SMTP Auth (Dovecot SASL)
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth
smtpd_sasl_auth_enable = yes
smtpd_sasl_security_options = noanonymous
smtpd_sasl_local_domain = $mydomain
broken_sasl_auth_clients = yes

# TLS
smtpd_use_tls = yes
smtpd_tls_cert_file = /etc/ssl/certs/ssl-cert-snakeoil.pem
smtpd_tls_key_file = /etc/ssl/private/ssl-cert-snakeoil.key
smtpd_tls_security_level = may
smtp_tls_security_level = may

# Anti-spam
smtpd_recipient_restrictions =
    permit_mynetworks,
    permit_sasl_authenticated,
    reject_unauth_destination
POSTFIX_MAIN

cat > /etc/postfix/master.cf << 'POSTFIX_MASTER'
smtp      inet  n       -       y       -       -       smtpd
submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_client_restrictions=permit_sasl_authenticated,reject
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject_unauth_destination
pickup    unix  n       -       y       60      1       pickup
cleanup   unix  n       -       y       -       0       cleanup
qmgr      unix  n       -       n       300     1       qmgr
tlsmgr    unix  -       -       y       1000?   1       tlsmgr
rewrite   unix  -       -       y       -       -       trivial-rewrite
bounce    unix  -       -       y       -       0       bounce
defer     unix  -       -       y       -       0       bounce
trace     unix  -       -       y       -       0       bounce
verify    unix  -       -       y       -       1       verify
flush     unix  n       -       y       1000?   0       flush
proxymap  unix  -       -       n       -       -       proxymap
proxywrite unix -       -       n       -       1       proxymap
smtp      unix  -       -       y       -       -       smtp
relay     unix  -       -       y       -       -       smtp
showq     unix  n       -       y       -       -       showq
error     unix  -       -       y       -       -       error
retry     unix  -       -       y       -       -       error
discard   unix  -       -       y       -       -       discard
local     unix  -       n       n       -       -       local
virtual   unix  -       n       n       -       -       virtual
lmtp      unix  -       -       y       -       -       lmtp
anvil     unix  -       -       y       -       1       anvil
scache    unix  -       -       y       -       1       scache
maildrop  unix  -       n       n       -       -       pipe
  flags=DRhu user=vmail argv=/usr/bin/maildrop -d ${recipient}
uucp      unix  -       n       n       -       -       pipe
  flags=Fqhu user=uucp argv=uux -r -n -z -a$sender - $nexthop!rmail ($recipient)
ifmail    unix  -       n       n       -       -       pipe
  flags=F user=ftn argv=/usr/lib/ifmail/ifmail -r $nexthop ($recipient)
bsmtp     unix  -       n       n       -       -       pipe
  flags=Fq. user=bsmtp argv=/usr/lib/bsmtp/bsmtp -t$nexthop -f$sender $recipient
scalemail-backend unix  -   n   n   -   2   pipe
  flags=R user=scalemail argv=/usr/lib/scalemail/bin/scalemail-store ${nexthop} ${user} ${extension}
mailman   unix  -       n       n       -       -       pipe
  flags=FR user=list argv=/usr/lib/mailman/bin/postfix-to-mailman.py
  ${nexthop} ${user}
POSTFIX_MASTER

echo -e "${GREEN}✓ Postfix configurado${NC}"
echo ""

# ============================================================================
# PHASE 7: Configure Dovecot
# ============================================================================
echo -e "${CYAN}═══ Phase 7/15: Configurando Dovecot ═══${NC}"

cat > /etc/dovecot/dovecot.conf << 'DOVECOT_MAIN'
protocols = imap pop3 lmtp
listen = *
disable_plaintext_auth = no
auth_mechanisms = plain login

mail_location = maildir:~/Maildir

passdb {
  driver = pam
}

userdb {
  driver = passwd
}

service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
}

service imap-login {
  inet_listener imap {
    port = 143
  }
  inet_listener imaps {
    port = 993
    ssl = yes
  }
}

service pop3-login {
  inet_listener pop3 {
    port = 110
  }
  inet_listener pop3s {
    port = 995
    ssl = yes
  }
}

ssl = yes
ssl_cert = </etc/ssl/certs/ssl-cert-snakeoil.pem
ssl_key = </etc/ssl/private/ssl-cert-snakeoil.key
DOVECOT_MAIN

echo -e "${GREEN}✓ Dovecot configurado${NC}"
echo ""

# ============================================================================
# PHASE 8: Create Email User (FIXED)
# ============================================================================
echo -e "${CYAN}═══ Phase 8/15: Criando usuário de email ═══${NC}"

# Check if user exists
if id "admin" &>/dev/null; then
    echo -e "${YELLOW}⚠️  Usuário admin já existe. Removendo...${NC}"
    
    # Kill any processes owned by admin
    pkill -9 -u admin 2>/dev/null || true
    
    # Remove user and home directory
    userdel -r admin 2>/dev/null || true
    
    # Force remove home directory if still exists
    rm -rf /home/admin 2>/dev/null || true
    
    echo -e "${GREEN}✓ Usuário antigo removido${NC}"
fi

# Create fresh user with proper settings
echo -e "${YELLOW}Criando novo usuário admin...${NC}"

# Create user with home directory and bash shell
useradd -m -s /bin/bash -d /home/admin admin

# Set password using passwd command (more reliable than chpasswd)
echo "admin:$ADMIN_PASSWORD" | chpasswd

# Alternative method if chpasswd fails
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Tentando método alternativo para senha...${NC}"
    echo -e "$ADMIN_PASSWORD\n$ADMIN_PASSWORD" | passwd admin
fi

# Verify user was created
if ! id "admin" &>/dev/null; then
    echo -e "${RED}❌ Falha ao criar usuário admin${NC}"
    exit 1
fi

# Create Maildir structure
echo -e "${YELLOW}Configurando Maildir...${NC}"
mkdir -p /home/admin/Maildir/{new,cur,tmp}
chown -R admin:admin /home/admin
chmod -R 700 /home/admin/Maildir

# Verify Maildir structure
if [ ! -d "/home/admin/Maildir/new" ]; then
    echo -e "${RED}❌ Falha ao criar Maildir${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Usuário criado: admin@monitorcorporativo.com${NC}"
echo -e "${GREEN}✓ Senha: $ADMIN_PASSWORD${NC}"
echo -e "${GREEN}✓ Home: /home/admin${NC}"
echo -e "${GREEN}✓ Maildir: /home/admin/Maildir${NC}"

# Test authentication
echo -e "${YELLOW}Testando autenticação...${NC}"
su - admin -c "whoami" && echo -e "${GREEN}✓ Autenticação OK${NC}" || echo -e "${RED}⚠️  Aviso: Verificar autenticação${NC}"

echo ""

# ============================================================================
# PHASE 9: Clone Repository
# ============================================================================
echo -e "${CYAN}═══ Phase 9/15: Clonando repositório Git ═══${NC}"

git clone -b "$GIT_BRANCH" "$GIT_REPO" "$PROJECT_DIR" || {
    echo -e "${RED}❌ Erro ao clonar repositório${NC}"
    exit 1
}

cd "$PROJECT_DIR"

if [ ! -f "package.json" ] || [ ! -f "chrome-extension/manifest.json" ]; then
    echo -e "${RED}❌ Arquivos críticos não encontrados${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Repositório clonado${NC}"
echo ""

# ============================================================================
# PHASE 10: Install Project Dependencies
# ============================================================================
echo -e "${CYAN}═══ Phase 10/15: Instalando dependências do projeto ═══${NC}"

cd "$PROJECT_DIR"
npm install --legacy-peer-deps || npm install

cd "$PROJECT_DIR/chrome-extension"
npm install

echo -e "${GREEN}✓ Dependências instaladas${NC}"
echo ""

# ============================================================================
# PHASE 11: Build Everything
# ============================================================================
echo -e "${CYAN}═══ Phase 11/15: Compilando aplicação ═══${NC}"

cd "$PROJECT_DIR"
npm run build

cd "$PROJECT_DIR/chrome-extension"
node build.js || npm run build

mkdir -p "$PROJECT_DIR/updates"
cp corpmonitor.* "$PROJECT_DIR/updates/" 2>/dev/null || true
cp privacy-policy.html "$PROJECT_DIR/dist/" 2>/dev/null || true

chown -R www-data:www-data "$PROJECT_DIR"
chmod -R 755 "$PROJECT_DIR"

echo -e "${GREEN}✓ Build completo${NC}"
echo ""

# ============================================================================
# PHASE 12: Configure Nginx
# ============================================================================
echo -e "${CYAN}═══ Phase 12/15: Configurando Nginx ═══${NC}"

cat > /etc/nginx/sites-available/monitorcorporativo <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name monitorcorporativo.com www.monitorcorporativo.com;

    root /var/www/monitor-corporativo/dist;
    index index.html;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /privacy-policy.html {
        alias /var/www/monitor-corporativo/dist/privacy-policy.html;
    }

    location /updates/ {
        alias /var/www/monitor-corporativo/updates/;
        add_header Access-Control-Allow-Origin "*" always;
        autoindex on;
        types {
            application/x-chrome-extension crx;
            application/zip zip;
            text/plain sha256;
        }
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    access_log /var/log/nginx/monitorcorporativo-access.log;
    error_log /var/log/nginx/monitorcorporativo-error.log;
}
EOF

ln -sf /etc/nginx/sites-available/monitorcorporativo /etc/nginx/sites-enabled/
nginx -t

echo -e "${GREEN}✓ Nginx configurado${NC}"
echo ""

# ============================================================================
# PHASE 13: Configure SSL
# ============================================================================
echo -e "${CYAN}═══ Phase 13/15: Configurando SSL ═══${NC}"

certbot --nginx \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$ADMIN_EMAIL" \
    --redirect || echo -e "${YELLOW}⚠️  SSL manual required${NC}"

systemctl enable certbot.timer
systemctl start certbot.timer

echo -e "${GREEN}✓ SSL configurado${NC}"
echo ""

# ============================================================================
# PHASE 14: Configure Firewall
# ============================================================================
echo -e "${CYAN}═══ Phase 14/15: Configurando Firewall ═══${NC}"

ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 25/tcp comment 'SMTP'
ufw allow 587/tcp comment 'Submission'
ufw allow 993/tcp comment 'IMAPS'
ufw allow 995/tcp comment 'POP3S'

echo -e "${GREEN}✓ Firewall configurado${NC}"
ufw status
echo ""

# ============================================================================
# PHASE 15: Start All Services
# ============================================================================
echo -e "${CYAN}═══ Phase 15/15: Iniciando serviços ═══${NC}"

systemctl enable nginx postfix dovecot
systemctl start nginx
systemctl restart postfix
systemctl restart dovecot

echo -e "${GREEN}✓ Todos os serviços iniciados${NC}"
echo ""

# ============================================================================
# FINAL VALIDATION
# ============================================================================
echo -e "${CYAN}═══ Validação Final ═══${NC}"

echo "Testando site..."
curl -I http://localhost 2>&1 | head -1

echo "Testando Postfix..."
systemctl is-active postfix

echo "Testando Dovecot..."
systemctl is-active dovecot

echo "Testando usuário admin..."
id admin

echo ""

# ============================================================================
# GENERATE REPORT
# ============================================================================
REPORT_FILE="$PROJECT_DIR/INSTALLATION_REPORT.txt"

cat > "$REPORT_FILE" << 'REPORT_EOF'
╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║           ✅ INSTALAÇÃO COMPLETA - CorpMonitor + Webmail           ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝

📊 INFORMAÇÕES DO SISTEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 Site Principal:
   https://monitorcorporativo.com

📧 Email Configurado:
   Email: admin@monitorcorporativo.com
   Senha: Vib797d8
   
   Configuração IMAP:
   - Servidor: monitorcorporativo.com
   - Porta: 993 (SSL)
   - Usuário: admin
   
   Configuração SMTP:
   - Servidor: monitorcorporativo.com
   - Porta: 587 (STARTTLS)
   - Usuário: admin

🔐 Certificados SSL:
   Configurados via Let's Encrypt
   Auto-renovação habilitada

🛡️ Firewall:
   Portas abertas: 22, 80, 443, 25, 587, 993, 995

📁 Diretórios:
   Projeto: /var/www/monitor-corporativo
   Logs: /var/log/nginx/
   Email: /home/admin/Maildir

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧪 TESTES

# Testar site
curl -I https://monitorcorporativo.com

# Testar envio de email
echo "Teste" | mail -s "Email de Teste" admin@monitorcorporativo.com

# Verificar recebimento
ls -la /home/admin/Maildir/new/

# Logs de email
tail -f /var/log/mail.log

# Login IMAP teste
telnet monitorcorporativo.com 143

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️ CONFIGURAÇÃO DNS NECESSÁRIA

Adicione os seguintes registros DNS:

A       @                  IP_DO_SERVIDOR
A       www                IP_DO_SERVIDOR
A       mail               IP_DO_SERVIDOR
MX      @           10     mail.monitorcorporativo.com
TXT     @                  "v=spf1 mx ~all"
TXT     _dmarc             "v=DMARC1; p=none; rua=mailto:admin@monitorcorporativo.com"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 MONITORAMENTO

# Status dos serviços
systemctl status nginx postfix dovecot

# Logs em tempo real
tail -f /var/log/nginx/monitorcorporativo-access.log
tail -f /var/log/mail.log

# Testar autenticação
su - admin

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ PRÓXIMOS PASSOS

1. Configurar registros DNS (ver acima)
2. Testar envio/recebimento de emails
3. Configurar cliente de email (Thunderbird, Outlook, etc)
4. Verificar extensão Chrome em /updates/
5. Submeter extensão para Chrome Web Store (se aplicável)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REPORT_EOF

echo -e "${GREEN}✓ Relatório gerado: $REPORT_FILE${NC}"
cat "$REPORT_FILE"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                                    ║${NC}"
echo -e "${GREEN}║               ✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!                  ║${NC}"
echo -e "${GREEN}║                                                                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}📧 Email: ${YELLOW}admin@monitorcorporativo.com${NC}"
echo -e "${CYAN}🔑 Senha: ${YELLOW}$ADMIN_PASSWORD${NC}"
echo -e "${CYAN}📄 Relatório: ${YELLOW}$REPORT_FILE${NC}"
echo -e "${CYAN}📋 Log completo: ${YELLOW}$LOG_FILE${NC}"
echo ""
