#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const BACKUP_DIR = path.join(process.cwd(), '.backup');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupName = `backup-${timestamp}`;
const backupPath = path.join(BACKUP_DIR, backupName);

console.log('Creating backup:', backupName);
console.log('Backup path:', backupPath);

const EXCLUDE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  '.backup',
  '*.log',
  '*.tmp',
  '*.temp'
];

function shouldExclude(file) {
  return EXCLUDE_PATTERNS.some(pattern => {
    if (pattern.endsWith('/*')) {
      return file === pattern.replace('/*', '');
    }
    return file === pattern;
  });
}

function copyFiles(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);

  files.forEach(file => {
    if (shouldExclude(file)) {
      return;
    }

    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);
    const stat = fs.statSync(sourcePath);

    if (stat.isDirectory()) {
      copyFiles(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}

try {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  copyFiles('.', backupPath);

  const backupInfo = {
    timestamp: new Date().toISOString(),
    backupName,
    backupPath
  };

  fs.writeFileSync(
    path.join(backupPath, 'backup-info.json'),
    JSON.stringify(backupInfo, null, 2)
  );

  console.log('✅ Backup created successfully!');
  console.log('Backup name:', backupName);
  console.log('Backup location:', backupPath);
} catch (error) {
  console.error('❌ Failed to create backup:', error);
  process.exit(1);
}
