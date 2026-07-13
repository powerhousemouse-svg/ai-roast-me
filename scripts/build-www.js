#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');

const staticFiles = [
  'index.html',
  'manifest.json',
  'sw.js',
  'privacy-policy.html'
];

const optionalFiles = ['local-dev-key.js'];

fs.mkdirSync(www, { recursive: true });
fs.mkdirSync(path.join(www, 'js'), { recursive: true });

for (const file of staticFiles) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) {
    console.warn(`[build] skipping missing file: ${file}`);
    continue;
  }
  fs.copyFileSync(src, path.join(www, file));
  console.log(`[build] copied ${file}`);
}

for (const file of optionalFiles) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(www, file));
    console.log(`[build] copied optional ${file}`);
  }
}

execSync(
  'npx esbuild src/capacitor-native.js --bundle --format=iife --global-name=RoastLordNativeBundle --outfile=www/js/capacitor-native.js --platform=browser',
  { cwd: root, stdio: 'inherit' }
);
execSync(
  'npx esbuild src/analytics.js --bundle --format=iife --outfile=www/js/analytics.js --platform=browser',
  { cwd: root, stdio: 'inherit' }
);
execSync(
  'npx esbuild src/analytics.js --bundle --format=iife --outfile=js/analytics.js --platform=browser',
  { cwd: root, stdio: 'inherit' }
);

const logoSrc = path.join(root, 'assets', 'roastlord-logo.png');
if (fs.existsSync(logoSrc)) {
  fs.mkdirSync(path.join(www, 'assets'), { recursive: true });
  fs.copyFileSync(logoSrc, path.join(www, 'assets', 'roastlord-logo.png'));
  console.log('[build] copied assets/roastlord-logo.png');
}

console.log('[build] www/ ready for Capacitor sync');