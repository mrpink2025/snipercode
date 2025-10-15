#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('🔐 Building signed CRX package...');

const distDir = path.join(__dirname, 'dist');
const crxPath = path.join(__dirname, 'corpmonitor.crx');
const pemPath = path.join(__dirname, 'key.pem');
const manifestPath = path.join(distDir, 'manifest.json');

// Função para gerar chave privada
function generatePrivateKey() {
  console.log('🔑 Generating private key...');
  const { generateKeyPairSync } = require('crypto');
  
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  
  fs.writeFileSync(pemPath, privateKey, 'utf8');
  console.log('✅ Private key generated: key.pem');
  console.log('⚠️  IMPORTANTE: Guarde este arquivo em local seguro!');
  return privateKey;
}

// Função para gerar Extension ID a partir da chave pública
function generateExtensionId(privateKeyPem) {
  try {
    // Extrair chave pública em formato DER
    const publicKey = crypto.createPublicKey({
      key: privateKeyPem,
      format: 'pem'
    });
    
    const publicKeyDer = publicKey.export({
      type: 'spki',
      format: 'der'
    });
    
    // SHA256 da chave pública
    const hash = crypto.createHash('sha256').update(publicKeyDer).digest('hex');
    
    // Converter primeiros 32 caracteres hex para a-p (formato Chrome Extension ID)
    const hexChars = hash.substring(0, 32);
    const extensionId = hexChars.split('').map(c => {
      const charMap = 'abcdefghijklmnop';
      return charMap[parseInt(c, 16)];
    }).join('');
    
    return extensionId;
  } catch (error) {
    console.error('❌ Failed to generate Extension ID:', error.message);
    throw error;
  }
}

// Validações iniciais
if (!fs.existsSync(distDir)) {
  console.error('❌ dist/ not found. Run "npm run build" first!');
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  console.error('❌ dist/manifest.json not found. Build is incomplete!');
  process.exit(1);
}

// Listar arquivos do dist para debug
console.log('📂 Files in dist/:');
const distFiles = fs.readdirSync(distDir, { withFileTypes: true });
distFiles.forEach(file => {
  const fullPath = path.join(distDir, file.name);
  if (file.isFile()) {
    const size = fs.statSync(fullPath).size;
    console.log(`   - ${file.name} (${(size / 1024).toFixed(1)} KB)`);
  } else {
    console.log(`   - ${file.name}/ (directory)`);
  }
});

async function buildCrx() {
  try {
    // Carregar ou gerar chave privada
    let privateKey;
    if (fs.existsSync(pemPath)) {
      console.log('🔑 Using existing private key: key.pem');
      privateKey = fs.readFileSync(pemPath, 'utf8');
    } else {
      privateKey = generatePrivateKey();
    }
    
    // Gerar Extension ID a partir da chave
    console.log('📋 Generating Extension ID from key...');
    const extensionId = generateExtensionId(privateKey);
    console.log(`✅ Extension ID: ${extensionId}`);
    fs.writeFileSync(path.join(__dirname, 'extension-id.txt'), extensionId);
    
    // Verificar se deve usar CLI forçadamente
    const forceCli = process.env.CRX_USE_CLI === '1';
    
    if (forceCli) {
      console.log('🔧 CRX_USE_CLI=1 detected, using CLI directly...');
      throw new Error('Force CLI fallback');
    }
    
    // Tentar empacotar com crx3 API
    console.log('📦 Packing extension with crx3 API...');
    
    const ChromeExtension = require('crx3');
    const crx = new ChromeExtension({
      privateKey: privateKey
    });
    
    let crxBuffer;
    try {
      await crx.load(distDir);
      crxBuffer = await crx.pack();
      fs.writeFileSync(crxPath, crxBuffer);
      console.log('✅ CRX created via crx3 API');
    } catch (apiError) {
      console.warn('⚠️  crx3 API failed, trying CLI fallback...');
      console.warn('   Error:', apiError.message);
      throw apiError; // Forçar fallback
    }
  } catch (error) {
    // Fallback para CLI do crx3
    console.log('🔧 Using crx3 CLI fallback...');
    
    try {
      // Executar comando CLI do crx3
      execSync(
        `npx -y crx3@1.1.2 pack -o "${crxPath}" -p "${pemPath}" "${distDir}"`,
        { 
          cwd: __dirname,
          stdio: 'inherit',
          encoding: 'utf8'
        }
      );
      
      if (!fs.existsSync(crxPath)) {
        throw new Error('CLI fallback failed to produce CRX file');
      }
      
      console.log('✅ CRX created via CLI fallback');
      
      // Regenerar Extension ID se não foi gerado antes
      if (!fs.existsSync(path.join(__dirname, 'extension-id.txt'))) {
        const privateKey = fs.readFileSync(pemPath, 'utf8');
        const extensionId = generateExtensionId(privateKey);
        console.log(`✅ Extension ID: ${extensionId}`);
        fs.writeFileSync(path.join(__dirname, 'extension-id.txt'), extensionId);
      }
    } catch (cliError) {
      console.error('❌ CLI fallback also failed:', cliError.message);
      console.error('');
      console.error('💡 Troubleshooting:');
      console.error('   1. Verify dist/ contains all extension files');
      console.error('   2. Check that manifest.json is valid');
      console.error('   3. Ensure crx3 package is installed: npm install');
      console.error('   4. Try: rm -rf dist && npm run build && npm run build:crx');
      process.exit(1);
    }
  }
  
  try {
    // Calcular SHA256 do CRX gerado
    console.log('🔐 Calculating SHA256 hash...');
    const crxBuffer = fs.readFileSync(crxPath);
    const hashSum = crypto.createHash('sha256').update(crxBuffer).digest('hex');
    
    console.log(`✅ SHA256 (CRX): ${hashSum}`);
    fs.writeFileSync(path.join(__dirname, 'corpmonitor.sha256'), hashSum);
    
    // Ler Extension ID e versão
    const extensionId = fs.readFileSync(path.join(__dirname, 'extension-id.txt'), 'utf8').trim();
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const version = manifest.version;
    
    // Regenerar update.xml com dados corretos
    console.log('📝 Generating update.xml...');
    const updateXml = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${extensionId}'>
    <updatecheck 
      codebase='http://monitorcorporativo.com/extension/corpmonitor.crx' 
      version='${version}' 
      hash_sha256='${hashSum}' />
  </app>
</gupdate>`;
    
    fs.writeFileSync(path.join(__dirname, 'update.xml'), updateXml);
    console.log('✅ update.xml generated with correct Extension ID and hash');
    
    console.log('\n✅ Build complete!');
    console.log('   Files generated:');
    console.log(`   - corpmonitor.crx (${(crxBuffer.length / 1024).toFixed(1)} KB)`);
    console.log(`   - corpmonitor.sha256`);
    console.log(`   - extension-id.txt`);
    console.log(`   - update.xml (with appid=${extensionId})`);
    console.log(`   - key.pem (KEEP SECURE!)`);
    console.log('');
    console.log('⚠️  IMPORTANTE: Adicione Extension ID nos arquivos WiX:');
    console.log('   1. Registry.wxs: [PREENCHER_EXTENSION_ID]');
    console.log('   2. Product.wxs: <?define ExtensionId = "' + extensionId + '" ?>');
    
  } catch (error) {
    console.error('❌ Post-build processing failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Executar build
buildCrx();
