#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ChromeExtension = require('crx3');

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
    
    // Empacotar extensão com crx3
    console.log('📦 Packing extension with crx3...');
    
    const crx = new ChromeExtension({
      privateKey: privateKey
    });
    
    // Tentar carregar e empacotar
    let crxBuffer;
    try {
      await crx.load(distDir);
      crxBuffer = await crx.pack();
    } catch (loadError) {
      console.error('⚠️  Failed to load dist directory, trying alternative method...');
      console.error('   Error:', loadError.message);
      
      // Fallback: tentar com array de arquivos
      const files = [];
      function walkDir(dir, baseDir = dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkDir(fullPath, baseDir);
          } else {
            files.push({
              path: path.relative(baseDir, fullPath),
              content: fs.readFileSync(fullPath)
            });
          }
        }
      }
      walkDir(distDir);
      
      console.log(`   Found ${files.length} files to pack`);
      await crx.load(files);
      crxBuffer = await crx.pack();
    }
    
    fs.writeFileSync(crxPath, crxBuffer);
    console.log(`✅ CRX created: ${crxPath}`);
  
    // Calcular SHA256 do CRX
    const crxBuffer2 = fs.readFileSync(crxPath);
    const hashSum = crypto.createHash('sha256').update(crxBuffer2).digest('hex');
    
    console.log(`🔐 SHA256 (CRX): ${hashSum}`);
    fs.writeFileSync(path.join(__dirname, 'corpmonitor.sha256'), hashSum);
    
    // Extrair Extension ID usando crx3
    console.log('📋 Extracting Extension ID...');
    
    const extensionId = crx.generateAppId();
    console.log(`✅ Extension ID: ${extensionId}`);
    
    // Salvar Extension ID
    fs.writeFileSync(path.join(__dirname, 'extension-id.txt'), extensionId);
    
    // Ler versão do manifest
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
    console.log(`   - corpmonitor.crx (${(crxBuffer2.length / 1024).toFixed(1)} KB)`);
    console.log(`   - corpmonitor.sha256`);
    console.log(`   - extension-id.txt`);
    console.log(`   - update.xml (with appid=${extensionId})`);
    console.log(`   - key.pem (KEEP SECURE!)`);
    console.log('');
    console.log('⚠️  IMPORTANTE: Adicione Extension ID nos arquivos WiX:');
    console.log('   1. Registry.wxs: [PREENCHER_EXTENSION_ID]');
    console.log('   2. Product.wxs: <?define ExtensionId = "' + extensionId + '" ?>');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   1. Verify dist/ contains all extension files');
    console.error('   2. Check that manifest.json is valid');
    console.error('   3. Ensure crx3 package is installed: npm install');
    console.error('   4. Try: rm -rf dist && npm run build && npm run build:crx');
    process.exit(1);
  }
}

// Executar build
buildCrx();
