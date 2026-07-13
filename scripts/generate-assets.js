#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

const pyScript = path.join(__dirname, 'generate-assets.py');
execSync(`python3 "${pyScript}"`, { stdio: 'inherit' });