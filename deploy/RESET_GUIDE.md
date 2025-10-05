# Guia de Reset Completo do Servidor - CorpMonitor

## ⚠️ ATENÇÃO

Este script **APAGA TUDO** e reconfigura o servidor do zero. Use apenas se:
- Você tem certeza absoluta do que está fazendo
- Você quer começar completamente do zero
- Você tem um backup manual adicional (além do backup automático do script)

## 📋 O Que o Script Faz

### Fase 1: Backup Crítico
- Cria backup completo de `/var/www/monitor-corporativo`
- Backup da configuração Nginx
- Salva em `/var/backups/monitor-corporativo/`

### Fase 2: Parar Serviços
- Para Nginx
- Encerra processos Node relacionados ao projeto

### Fase 3: Remover Tudo
- **APAGA** `/var/www/monitor-corporativo`
- Remove configuração Nginx (`/etc/nginx/sites-available/monitor-corporativo`)
- Remove symlink (`/etc/nginx/sites-enabled/monitor-corporativo`)
- Limpa cache Nginx
- Remove logs antigos

### Fase 4: Instalar Dependências
- Atualiza lista de pacotes
- Instala: `nginx`, `git`, `nodejs`, `npm`, `curl`, `zip`, `unzip`

### Fase 5: Criar Estrutura
- Cria diretórios:
  - `/var/www/monitor-corporativo/dist/` (site)
  - `/var/www/monitor-corporativo/chrome-extension/` (código extensão)
  - `/var/www/monitor-corporativo/updates/` (arquivos CRX/ZIP)
  - `/var/www/monitor-corporativo/logs/` (logs aplicação)
  - `/var/www/monitor-corporativo/backups/` (backups locais)
- Define permissões corretas (www-data)

### Fase 6: Copiar Arquivos
- Copia arquivos do projeto para o servidor
- Você pode customizar esta parte para:
  - Copiar de diretório local
  - Clonar de repositório Git
  - Baixar de S3/Cloud Storage

### Fase 7: Compilar Extensão
- Instala dependências npm da extensão
- Executa build (`npm run build`)
- Copia `corpmonitor.zip`, `corpmonitor.crx`, `corpmonitor.sha256`
- Copia `privacy-policy.html` para o site

### Fase 8: Configurar Nginx
- Cria configuração completa do zero
- Configura SSL/TLS
- Define rotas para:
  - Site principal (/)
  - Privacy policy (/privacy-policy.html)
  - Updates da extensão (/updates/)
- Habilita site
- Valida configuração

### Fase 9: Iniciar Serviços
- Inicia Nginx
- Habilita auto-start do Nginx
- Recarrega configuração

### Fase 10: Validação
- Testa se Nginx está rodando
- Verifica se site responde (localhost)
- Confirma existência de arquivos críticos
- Valida estrutura de diretórios

### Fase 11: Relatório
- Gera relatório detalhado em `/var/www/monitor-corporativo/DEPLOYMENT_REPORT.txt`
- Lista URLs, comandos de teste, próximos passos

## 🚀 Como Usar

### Pré-requisitos

1. **Servidor Ubuntu/Debian** com acesso root
2. **Certificado SSL** configurado (Let's Encrypt recomendado)
3. **Arquivos do projeto** disponíveis (local ou Git)
4. **DNS** apontando para o servidor

### Instalação

```bash
# 1. Fazer upload do script
scp deploy/reset-and-deploy-complete.sh root@monitorcorporativo.com:/tmp/

# 2. Conectar via SSH
ssh root@monitorcorporativo.com

# 3. Dar permissão de execução
chmod +x /tmp/reset-and-deploy-complete.sh

# 4. Executar (vai pedir confirmação)
sudo /tmp/reset-and-deploy-complete.sh
```

### Confirmação Necessária

O script vai pedir que você digite **`SIM`** (em maiúsculas) para confirmar.

Se você digitar qualquer outra coisa, o script será cancelado.

## 📊 Arquivos Gerados

Após execução bem-sucedida:

```
/var/www/monitor-corporativo/
├── dist/
│   ├── index.html
│   ├── privacy-policy.html
│   └── assets/
├── chrome-extension/
│   ├── dist/
│   ├── corpmonitor.zip
│   ├── corpmonitor.crx
│   └── corpmonitor.sha256
├── updates/
│   ├── corpmonitor.crx
│   ├── corpmonitor.zip
│   └── corpmonitor.sha256
├── logs/
├── backups/
└── DEPLOYMENT_REPORT.txt

/var/backups/monitor-corporativo/
├── pre-reset-backup-YYYYMMDD-HHMMSS.tar.gz
└── nginx-backup-YYYYMMDD-HHMMSS.conf

/etc/nginx/sites-available/
└── monitor-corporativo

/etc/nginx/sites-enabled/
└── monitor-corporativo -> ../sites-available/monitor-corporativo
```

## 🧪 Validação Pós-Deploy

### Testes Automáticos (já inclusos no script)
- ✅ Nginx rodando
- ✅ Site acessível em localhost
- ✅ Arquivos críticos existem

### Testes Manuais (você deve fazer)

```bash
# 1. Testar site principal
curl -I https://monitorcorporativo.com
# Esperado: HTTP/2 200 ou 301->200

# 2. Testar política de privacidade
curl -I https://monitorcorporativo.com/privacy-policy.html
# Esperado: HTTP/2 200

# 3. Testar download da extensão
curl -I https://monitorcorporativo.com/updates/corpmonitor.crx
# Esperado: HTTP/2 200

# 4. Verificar checksum
curl https://monitorcorporativo.com/updates/corpmonitor.sha256
sha256sum /var/www/monitor-corporativo/updates/corpmonitor.zip
# Os hashes devem ser idênticos

# 5. Verificar logs
tail -f /var/log/nginx/monitor-corporativo-access.log
tail -f /var/log/nginx/monitor-corporativo-error.log
```

### Testes no Navegador

1. **Site Principal**: Abrir `https://monitorcorporativo.com`
   - ✅ Deve carregar sem erros
   - ✅ Sem warnings de SSL

2. **Privacy Policy**: Abrir `https://monitorcorporativo.com/privacy-policy.html`
   - ✅ Deve mostrar política em português
   - ✅ Sem erros 404

3. **Download Extensão**: Abrir `https://monitorcorporativo.com/updates/corpmonitor.crx`
   - ✅ Deve fazer download do arquivo
   - ✅ Tamanho do arquivo > 0 bytes

## 🔄 Rollback (Se Algo Der Errado)

### Rollback Rápido

```bash
# Restaurar do backup
sudo tar -xzf /var/backups/monitor-corporativo/pre-reset-backup-*.tar.gz \
    -C /var/www/

# Restaurar configuração Nginx
sudo cp /var/backups/monitor-corporativo/nginx-backup-*.conf \
    /etc/nginx/sites-available/monitor-corporativo

# Recarregar Nginx
sudo nginx -t && sudo systemctl reload nginx
```

### Rollback Completo (Reexecutar Script Antigo)

Se você tinha um script de deploy anterior funcionando:

```bash
# Executar script antigo
sudo /caminho/para/script-antigo.sh
```

## ⚙️ Customizações

### Mudar Domínio

Edite o script e altere:

```bash
DOMAIN="seu-dominio.com"
```

### Mudar Diretório do Projeto

Edite o script e altere:

```bash
PROJECT_ROOT="/var/www/seu-projeto"
```

### Adicionar Clone do Git

No script, na **Fase 6**, descomente:

```bash
# Option 2: Clone from Git
echo "Clonando do repositório Git..."
git clone https://github.com/your-org/monitor-corporativo.git "$PROJECT_ROOT/temp"
cp -r "$PROJECT_ROOT/temp/"* "$PROJECT_ROOT/"
rm -rf "$PROJECT_ROOT/temp"
```

E configure a URL do seu repositório.

## 🔐 Segurança

### SSL/TLS

O script assume que você tem certificados Let's Encrypt em:

```
/etc/letsencrypt/live/monitorcorporativo.com/fullchain.pem
/etc/letsencrypt/live/monitorcorporativo.com/privkey.pem
```

Se você não tem SSL configurado:

```bash
# Instalar Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obter certificado
sudo certbot --nginx -d monitorcorporativo.com -d www.monitorcorporativo.com

# Renovação automática (já configurado pelo Certbot)
sudo systemctl status certbot.timer
```

### Firewall

Certifique-se de que as portas estão abertas:

```bash
# Permitir HTTP e HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Verificar status
sudo ufw status
```

## 📞 Suporte e Troubleshooting

### Nginx não inicia

```bash
# Ver logs de erro
sudo journalctl -u nginx -n 50 --no-pager

# Testar configuração
sudo nginx -t
```

### Site não carrega

```bash
# Verificar se Nginx está rodando
sudo systemctl status nginx

# Ver logs de acesso e erro
sudo tail -100 /var/log/nginx/monitor-corporativo-error.log
```

### Certificado SSL inválido

```bash
# Renovar certificado
sudo certbot renew --nginx

# Testar certificado
curl -vI https://monitorcorporativo.com 2>&1 | grep -i ssl
```

### Extensão não baixa

```bash
# Verificar se arquivo existe
ls -lh /var/www/monitor-corporativo/updates/

# Verificar permissões
sudo chown -R www-data:www-data /var/www/monitor-corporativo/updates/
sudo chmod 755 /var/www/monitor-corporativo/updates/
sudo chmod 644 /var/www/monitor-corporativo/updates/*
```

## 📚 Documentação Adicional

- **Submissão Chrome Store**: `chrome-extension/CHROME_STORE_SUBMISSION.md`
- **Build da Extensão**: `chrome-extension/INSTALLATION.md`
- **Quick Start**: `chrome-extension/QUICK_START.md`

## ✅ Checklist Final

Após executar o script:

- [ ] Site principal acessível via HTTPS
- [ ] Privacy policy acessível e correto
- [ ] Extensão CRX baixável
- [ ] Checksum SHA256 válido
- [ ] Nginx rodando sem erros
- [ ] Logs sem warnings críticos
- [ ] Backup salvo e acessível
- [ ] DNS configurado corretamente
- [ ] SSL válido e não expirado
- [ ] Firewall configurado

## 🎯 Próximos Passos

1. **Testar tudo manualmente** (checklist acima)
2. **Fazer screenshot** da privacy policy para Chrome Store
3. **Submeter extensão** ao Chrome Web Store
4. **Configurar monitoramento** (opcional: UptimeRobot, Pingdom)
5. **Documentar credenciais** e configurações específicas

---

**Desenvolvido por**: Equipe CorpMonitor  
**Última atualização**: Janeiro 2025  
**Versão do Script**: 1.0.0  

---

**⚠️ IMPORTANTE**: Sempre faça backups manuais adicionais antes de executar este script!
