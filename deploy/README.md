# Monitor Corporativo - Instalação Automática Ubuntu 24.04

Script de instalação 100% automático para configurar e compilar o sistema Monitor Corporativo em um servidor Ubuntu 24.04 limpo.

## 🚀 Instalação Rápida

### Pré-requisitos

1. **Servidor Ubuntu 24.04 LTS** (limpo/zerado)
2. **Acesso root** (via SSH)
3. **DNS configurado**: Os registros DNS do domínio `monitorcorporativo.com` devem apontar para o IP do servidor
   - Registro A: `monitorcorporativo.com` → IP do servidor
   - Registro A: `www.monitorcorporativo.com` → IP do servidor

### Como Executar

```bash
# 1. Conectar ao servidor via SSH
ssh root@seu-servidor-ip

# 2. Fazer download do script
wget https://raw.githubusercontent.com/mrpink2025/snipercode/main/deploy/install.sh

# 3. Dar permissão de execução
chmod +x install.sh

# 4. Executar o script
sudo ./install.sh
```

**OU em uma única linha:**

```bash
curl -fsSL https://raw.githubusercontent.com/mrpink2025/snipercode/main/deploy/install.sh | sudo bash
```

## 📦 O Que o Script Faz

O script executa automaticamente todas as seguintes etapas:

### 1. Sistema Base
- ✅ Atualiza o sistema Ubuntu 24.04
- ✅ Instala dependências essenciais (curl, wget, git, build-essential)

### 2. Node.js e NPM
- ✅ Instala Node.js 20.x
- ✅ Instala npm
- ✅ Verifica as versões instaladas

### 3. Servidor Web (Nginx)
- ✅ Instala e configura Nginx
- ✅ Configura virtual host para o domínio
- ✅ Habilita gzip e cache
- ✅ Adiciona headers de segurança

### 4. SSL/HTTPS (Let's Encrypt)
- ✅ Instala Certbot
- ✅ Obtém certificado SSL gratuito
- ✅ Configura renovação automática
- ✅ Redireciona HTTP para HTTPS

### 5. Repositório e Código
- ✅ Clona o repositório do GitHub
- ✅ Instala dependências do projeto
- ✅ Compila o site (build Vite)
- ✅ Compila a extensão Chrome
- ✅ Cria arquivo ZIP da extensão

### 6. Segurança
- ✅ Configura firewall (UFW)
- ✅ Abre portas necessárias (22, 80, 443)
- ✅ Adiciona headers de segurança no Nginx

### 7. Documentação
- ✅ Gera arquivo com todas as informações da instalação
- ✅ Lista todos os caminhos e URLs
- ✅ Fornece comandos úteis para manutenção

## 📁 Estrutura de Arquivos Após Instalação

```
/var/www/monitor-corporativo/
├── dist/                                    # Site compilado (servido pelo Nginx)
├── chrome-extension/                        # Código fonte da extensão
├── monitor-corporativo-extension.zip        # Extensão empacotada para instalação
├── INSTALLATION_INFO.txt                    # Informações completas da instalação
├── src/                                     # Código fonte do site
├── supabase/                                # Configurações Supabase
└── ... (outros arquivos do projeto)

/etc/nginx/sites-available/
└── monitorcorporativo                       # Configuração do Nginx

/var/log/nginx/
├── monitorcorporativo-access.log            # Logs de acesso
└── monitorcorporativo-error.log             # Logs de erro
```

## 🌐 URLs e Acessos

Após a instalação, o site estará disponível em:

- **Site Principal**: https://monitorcorporativo.com
- **Com www**: https://www.monitorcorporativo.com

## 🔧 Instalar a Extensão Chrome

### Método 1: Carregar Descompactada (Desenvolvimento)

1. Abra o Chrome
2. Acesse `chrome://extensions/`
3. Ative o **"Modo do desenvolvedor"** (canto superior direito)
4. Clique em **"Carregar sem compactação"**
5. Selecione a pasta: `/var/www/monitor-corporativo/chrome-extension`

### Método 2: Instalar do ZIP

1. Faça download do arquivo: `/var/www/monitor-corporativo/monitor-corporativo-extension.zip`
2. Descompacte em uma pasta local
3. Siga os passos do Método 1

## 🔐 Configurar Credenciais do Supabase

Após a instalação, você precisa configurar as credenciais do Supabase:

```bash
cd /var/www/monitor-corporativo
nano src/integrations/supabase/client.ts
```

Atualize com suas credenciais do Supabase:
- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEY

Depois recompile:

```bash
npm run build
sudo systemctl reload nginx
```

## 📊 Comandos Úteis

### Verificar Status dos Serviços

```bash
# Status do Nginx
sudo systemctl status nginx

# Ver logs em tempo real
sudo tail -f /var/log/nginx/monitorcorporativo-error.log
sudo tail -f /var/log/nginx/monitorcorporativo-access.log
```

### Atualizar o Site

```bash
cd /var/www/monitor-corporativo
git pull
npm install
npm run build
sudo systemctl reload nginx
```

### Recompilar a Extensão

```bash
cd /var/www/monitor-corporativo/chrome-extension
node build.js
cd /var/www/monitor-corporativo
zip -r monitor-corporativo-extension.zip chrome-extension/ -x "*.git*" -x "node_modules/*"
```

### Renovar SSL Manualmente

```bash
sudo certbot renew
sudo systemctl reload nginx
```

### Ver Certificados SSL

```bash
sudo certbot certificates
```

## 🐛 Troubleshooting

### Problema: Site não carrega

```bash
# Verificar se o Nginx está rodando
sudo systemctl status nginx

# Ver logs de erro
sudo tail -n 50 /var/log/nginx/monitorcorporativo-error.log

# Testar configuração do Nginx
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

### Problema: Erro de SSL

```bash
# Verificar certificados
sudo certbot certificates

# Tentar obter certificado novamente
sudo certbot --nginx -d monitorcorporativo.com -d www.monitorcorporativo.com
```

### Problema: DNS não resolve

```bash
# Verificar DNS
nslookup monitorcorporativo.com
dig monitorcorporativo.com

# Aguardar propagação DNS (pode levar até 48 horas)
```

### Problema: Extensão não funciona

```bash
# Verificar se foi compilada corretamente
ls -la /var/www/monitor-corporativo/chrome-extension/

# Recompilar
cd /var/www/monitor-corporativo/chrome-extension
node build.js
```

## 🔄 Backup e Restore

### Fazer Backup

```bash
# Backup completo do projeto
sudo tar -czf monitor-corporativo-backup-$(date +%Y%m%d).tar.gz /var/www/monitor-corporativo/

# Backup da configuração do Nginx
sudo cp /etc/nginx/sites-available/monitorcorporativo /root/nginx-backup-monitorcorporativo
```

### Restore

```bash
# Restaurar projeto
sudo tar -xzf monitor-corporativo-backup-YYYYMMDD.tar.gz -C /

# Restaurar Nginx
sudo cp /root/nginx-backup-monitorcorporativo /etc/nginx/sites-available/monitorcorporativo
sudo systemctl reload nginx
```

## 📞 Suporte

Se encontrar problemas:

1. Verifique o arquivo de informações: `cat /var/www/monitor-corporativo/INSTALLATION_INFO.txt`
2. Consulte os logs do Nginx: `/var/log/nginx/monitorcorporativo-error.log`
3. Verifique os logs do sistema: `sudo journalctl -xe`
4. Repositório GitHub: https://github.com/mrpink2025/snipercode

## 📝 Notas Importantes

- ⚠️ **DNS**: Certifique-se que o DNS está configurado ANTES de executar o script
- ⚠️ **Firewall**: O script configura UFW, mas verifique se não há conflitos com outros firewalls
- ⚠️ **SSL**: O Let's Encrypt tem limite de tentativas. Se falhar, aguarde antes de tentar novamente
- ⚠️ **Backup**: Faça backup regularmente do seu projeto e banco de dados
- ⚠️ **Supabase**: Configure as credenciais do Supabase após a instalação

## 🎯 Checklist Pós-Instalação

- [ ] Site acessível em https://monitorcorporativo.com
- [ ] SSL funcionando (cadeado verde no navegador)
- [ ] Extensão Chrome instalada e funcionando
- [ ] Credenciais do Supabase configuradas
- [ ] Firewall configurado (UFW)
- [ ] Backup automático configurado
- [ ] Logs sendo gerados corretamente
- [ ] Todas as funcionalidades testadas

---

**Versão**: 1.0.0  
**Data**: 2025-09-30  
**Compatibilidade**: Ubuntu 24.04 LTS
