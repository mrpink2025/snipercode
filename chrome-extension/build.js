#!/usr/bin/env node

// Build script for CorpMonitor Chrome Extension
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Building CorpMonitor Chrome Extension...');

// Create build directory
const buildDir = path.join(__dirname, 'dist');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir);
}

// Copy extension files
const filesToCopy = [
  'manifest.json',
  'background.js',
  'popup.html',
  'popup.js',
  'content.js',
  'config.js',
  'service-worker-utils.js',
  'debug-console.js'
];

console.log('📁 Copying extension files...');
filesToCopy.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(buildDir, file);
  
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`   ✓ ${file}`);
  } else {
    console.warn(`   ⚠️  ${file} not found`);
  }
});

// Create icons directory and copy icons
const iconsDir = path.join(buildDir, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

// Copy real icons from icons directory
console.log('🎨 Copying icons...');
const iconSizes = [16, 32, 48, 128];
iconSizes.forEach(size => {
  const srcIcon = path.join(__dirname, 'icons', `icon${size}.png`);
  const destIcon = path.join(iconsDir, `icon${size}.png`);
  
  if (fs.existsSync(srcIcon)) {
    fs.copyFileSync(srcIcon, destIcon);
    console.log(`   ✓ icon${size}.png (real icon)`);
  } else {
    console.warn(`   ⚠️  icon${size}.png not found - generating placeholder`);
    // Create minimal placeholder if real icon doesn't exist
    fs.writeFileSync(destIcon, Buffer.from('PNG placeholder for icon ' + size));
  }
});

// Create packages for distribution
console.log('📦 Creating distribution packages...');
try {
  // Create zip for manual installation
  const zipPath = path.join(__dirname, 'corpmonitor-extension.zip');
  
  if (process.platform === 'win32') {
    // Windows - use PowerShell
    execSync(`powershell "Compress-Archive -Path '${buildDir}\\*' -DestinationPath '${zipPath}' -Force"`);
  } else {
    // Unix-like systems - use zip
    execSync(`cd "${buildDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
  }
  
  console.log(`   ✓ ZIP package: ${zipPath}`);
  
  // Copy ZIP as CRX for download compatibility (Chrome will handle it)
  const crxPath = path.join(__dirname, 'corpmonitor-extension.crx');
  fs.copyFileSync(zipPath, crxPath);
  console.log(`   ✓ CRX package: ${crxPath}`);
  
  // Generate SHA256 hash for security verification
  const crypto = require('crypto');
  const fileBuffer = fs.readFileSync(zipPath);
  const hashSum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  
  fs.writeFileSync(path.join(__dirname, 'package.sha256'), `${hashSum}  corpmonitor-extension.zip`);
  console.log(`   ✓ SHA256 hash: ${hashSum.substring(0, 16)}...`);
  
} catch (error) {
  console.warn('   ⚠️  Could not create packages:', error.message);
  console.log('   💡 Manual packaging may be required');
}

// Generate installation instructions
const instructionsPath = path.join(__dirname, 'INSTALLATION.md');
const instructions = `# CorpMonitor Extension Installation

## Development Installation (Unpacked)

1. Open Chrome and navigate to \`chrome://extensions/\`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" button
4. Select the \`dist/\` folder from this directory
5. The extension should now appear in your extensions list

## Production Installation (.zip)

1. Use the generated \`corpmonitor-extension.zip\` file
2. Upload to Chrome Web Store for distribution
3. Or install locally by extracting and loading as unpacked

## Enterprise Deployment

For corporate deployment, use Group Policy with the following settings:

### Registry Keys (Windows)
\`\`\`
[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionInstallForcelist]
"1"="[EXTENSION_ID];https://clients2.google.com/service/update2/crx"
\`\`\`

### Chrome ADMX Template
Include the extension ID in your Chrome ADMX policy template.

## Verification

After installation, you should see:
- 🛡️ CorpMonitor icon in the Chrome toolbar
- Extension popup when clicking the icon
- Monitoring capabilities active (with user consent)

## Troubleshooting

- **Extension not loading**: Check Chrome developer mode is enabled
- **No icon showing**: Verify manifest.json and icon files are correct
- **Monitoring not working**: Check extension permissions and user consent

## Support

For technical support, contact your IT administrator or refer to the CorpMonitor dashboard at your corporate portal.
`;

fs.writeFileSync(instructionsPath, instructions);
console.log(`📖 Installation instructions created: ${instructionsPath}`);

console.log('');
console.log('✅ Build completed successfully!');
console.log('');
console.log('Next steps:');
console.log('1. Review the dist/ folder contents');
console.log('2. Test the extension by loading it unpacked in Chrome');
console.log('3. Read INSTALLATION.md for deployment instructions');
console.log('4. Package for distribution when ready');
console.log('');
console.log('🎉 CorpMonitor Chrome Extension is ready!');