#!/usr/bin/env node
/**
 * 下载 ONNX Runtime WASM 文件
 *
 * 从多个 CDN 源下载 WASM 文件到 public/ort-wasm/ 目录
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WASM_DIR = path.join(__dirname, '..', 'public', 'ort-wasm');

// WASM 文件列表和多个下载源
const WASM_FILES = [
  {
    name: 'ort-wasm-simd.wasm',
    sources: [
      'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/ort-wasm-simd.wasm',
      'https://unpkg.com/@xenova/transformers@2.17.2/dist/ort-wasm-simd.wasm',
      'https://www.jsdelivr.com/package/npm/@xenova/transformers/files/dist/ort-wasm-simd.wasm',
    ],
  },
  {
    name: 'ort-wasm.wasm',
    sources: [
      'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/ort-wasm.wasm',
      'https://unpkg.com/@xenova/transformers@2.17.2/dist/ort-wasm.wasm',
    ],
  },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    https
      .get(
        url,
        {
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        },
        response => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            file.close();
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
            downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            return;
          }

          if (response.statusCode !== 200) {
            file.close();
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }

          const totalSize = parseInt(response.headers['content-length'] || '0', 10);
          let downloadedSize = 0;

          response.on('data', chunk => {
            downloadedSize += chunk.length;
            if (totalSize > 0) {
              const progress = Math.round((downloadedSize / totalSize) * 100);
              process.stdout.write(`\r[Download] ${progress}%`);
            }
          });

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            console.log(`\n[Download] Completed`);
            resolve();
          });

          file.on('error', err => {
            file.close();
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
            reject(err);
          });
        }
      )
      .on('error', err => {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      })
      .on('timeout', () => {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(new Error('Timeout'));
      });
  });
}

async function downloadWithFallback(fileInfo) {
  const destPath = path.join(WASM_DIR, fileInfo.name);

  // 检查文件是否已存在
  if (fs.existsSync(destPath)) {
    const stats = fs.statSync(destPath);
    if (stats.size > 1000000) {
      // 大于 1MB 认为有效
      console.log(
        `[Skip] ${fileInfo.name} already exists (${(stats.size / 1024 / 1024).toFixed(2)} MB)`
      );
      return true;
    }
  }

  console.log(`\n[File] ${fileInfo.name}`);

  for (const source of fileInfo.sources) {
    console.log(`[Try] ${source}`);
    try {
      await downloadFile(source, destPath);
      return true;
    } catch (error) {
      console.warn(`[Failed] ${error.message}`);
      continue;
    }
  }

  return false;
}

async function main() {
  console.log('='.repeat(60));
  console.log('ONNX Runtime WASM Download Script');
  console.log('='.repeat(60));
  console.log(`Target Directory: ${WASM_DIR}`);
  console.log('');

  ensureDir(WASM_DIR);

  let successCount = 0;
  let failCount = 0;

  for (const fileInfo of WASM_FILES) {
    const success = await downloadWithFallback(fileInfo);
    if (success) {
      successCount++;
    } else {
      failCount++;
      console.error(`[Error] Failed to download ${fileInfo.name} from all sources`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Download Summary');
  console.log('='.repeat(60));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log('');

  if (failCount === 0) {
    console.log('🎉 All WASM files downloaded successfully!');
    process.exit(0);
  } else {
    console.log('⚠️  Some files failed to download.');
    console.log('You may need to manually download them from:');
    console.log('https://github.com/microsoft/onnxruntime/releases');
    process.exit(1);
  }
}

main().catch(console.error);
