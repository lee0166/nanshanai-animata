#!/usr/bin/env node
/**
 * 模型版本检查脚本
 * 
 * 检查本地模型是否为最新版本，提示用户更新
 * 
 * 使用方法：
 *   node scripts/check-model-update.js
 *   或
 *   npm run check-model-update
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_CONFIG = {
  modelId: 'Xenova/all-MiniLM-L6-v2',
  versionFile: path.join(__dirname, '..', 'data', 'models', '.model-version'),
  configUrl: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/raw/main/config.json'
};

/**
 * 获取远程模型版本信息
 */
async function getRemoteVersion() {
  return new Promise((resolve, reject) => {
    https.get(MODEL_CONFIG.configUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 10000
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const config = JSON.parse(data);
          resolve({
            version: config.transformers_version || 'unknown',
            lastModified: res.headers['last-modified']
          });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * 获取本地模型版本
 */
function getLocalVersion() {
  if (!fs.existsSync(MODEL_CONFIG.versionFile)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(MODEL_CONFIG.versionFile, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 保存本地版本信息
 */
function saveLocalVersion(versionInfo) {
  ensureDir(path.dirname(MODEL_CONFIG.versionFile));
  fs.writeFileSync(MODEL_CONFIG.versionFile, JSON.stringify(versionInfo, null, 2));
}

/**
 * 确保目录存在
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🔍 Checking for model updates...\n');
  
  const localVersion = getLocalVersion();
  
  if (!localVersion) {
    console.log('⚠️  No local version info found.');
    console.log('   Please run: npm run download-model');
    process.exit(1);
  }
  
  console.log(`📦 Local version:  ${localVersion.version || 'unknown'}`);
  console.log(`📅 Last checked:   ${localVersion.checkedAt || 'never'}`);
  console.log('');
  
  try {
    const remoteVersion = await getRemoteVersion();
    console.log(`🌐 Remote version: ${remoteVersion.version}`);
    console.log(`🕐 Last modified:  ${remoteVersion.lastModified}`);
    console.log('');
    
    // 检查是否需要更新
    const needsUpdate = remoteVersion.version !== localVersion.version ||
                       remoteVersion.lastModified !== localVersion.lastModified;
    
    if (needsUpdate) {
      console.log('⚠️  Model update available!');
      console.log('');
      console.log('To update, run:');
      console.log('  npm run download-model');
      console.log('');
      process.exit(0);
    } else {
      console.log('✅ Model is up to date.');
      
      // 更新检查时间
      saveLocalVersion({
        ...localVersion,
        checkedAt: new Date().toISOString()
      });
      
      process.exit(0);
    }
  } catch (error) {
    console.log('❌ Failed to check for updates:', error.message);
    console.log('   Please check your network connection.');
    process.exit(1);
  }
}

main().catch(console.error);
