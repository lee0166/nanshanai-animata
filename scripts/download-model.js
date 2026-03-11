#!/usr/bin/env node
/**
 * 模型预下载脚本
 *
 * 从 Hugging Face / ModelScope 下载 Embedding 模型文件到本地缓存
 * 浏览器环境将使用本地模型，避免下载失败
 *
 * 使用方法：
 *   node scripts/download-model.js
 *   或
 *   npm run download-model
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 模型配置
const MODEL_CONFIG = {
  modelId: 'Xenova/all-MiniLM-L6-v2',
  revision: 'main',
  // 多个下载源，按顺序尝试
  sources: [
    {
      name: 'Hugging Face',
      baseUrl: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main',
    },
    {
      name: 'ModelScope',
      baseUrl: 'https://www.modelscope.cn/models/Xenova/all-MiniLM-L6-v2/resolve/main',
    },
  ],
  files: [
    'config.json',
    'tokenizer.json',
    'tokenizer_config.json',
    'vocab.txt',
    'onnx/model_quantized.onnx',
  ],
};

// 本地缓存路径（Node.js 使用）
const CACHE_DIR = path.join(__dirname, '..', 'data', 'models', 'Xenova', 'all-MiniLM-L6-v2');

// Public 目录路径（浏览器使用）
const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'models', 'Xenova', 'all-MiniLM-L6-v2');

/**
 * 确保目录存在
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[Download] Created directory: ${dir}`);
  }
}

/**
 * 下载单个文件（支持多源）
 */
async function downloadFileWithFallback(file, destPath) {
  const errors = [];

  for (const source of MODEL_CONFIG.sources) {
    const fileUrl = `${source.baseUrl}/${file}`;
    console.log(`[Download] Trying ${source.name}: ${fileUrl}`);

    try {
      await downloadFile(fileUrl, destPath);
      console.log(`[Success] Downloaded from ${source.name}`);
      return; // 成功则返回
    } catch (error) {
      console.warn(`[Warning] ${source.name} failed: ${error.message}`);
      errors.push(`${source.name}: ${error.message}`);
    }
  }

  // 所有源都失败
  throw new Error(`All sources failed:\n${errors.join('\n')}`);
}

/**
 * 下载单个文件
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        },
        response => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            // 跟随重定向
            file.close();
            if (fs.existsSync(dest)) {
              fs.unlinkSync(dest);
            }
            downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            return;
          }

          if (response.statusCode !== 200) {
            file.close();
            if (fs.existsSync(dest)) {
              fs.unlinkSync(dest);
            }
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }

          const totalSize = parseInt(response.headers['content-length'] || '0', 10);
          let downloadedSize = 0;
          let lastProgress = -1;

          response.on('data', chunk => {
            downloadedSize += chunk.length;
            if (totalSize > 0) {
              const progress = Math.round((downloadedSize / totalSize) * 100);
              if (progress !== lastProgress && progress % 10 === 0) {
                process.stdout.write(`\r[Download] Progress: ${progress}%`);
                lastProgress = progress;
              }
            }
          });

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            console.log(`\n[Download] Completed: ${path.basename(dest)}`);
            resolve();
          });

          file.on('error', err => {
            file.close();
            if (fs.existsSync(dest)) {
              fs.unlinkSync(dest);
            }
            reject(err);
          });
        }
      )
      .on('error', err => {
        file.close();
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest);
        }
        reject(err);
      });
  });
}

/**
 * 检查文件是否已存在且有效
 */
function fileExistsAndValid(filePath, minSize = 1000) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const stats = fs.statSync(filePath);
  return stats.size > minSize;
}

/**
 * 主函数
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Embedding Model Download Script');
  console.log('='.repeat(60));
  console.log(`Model: ${MODEL_CONFIG.modelId}`);
  console.log(`Cache Directory: ${CACHE_DIR}`);
  console.log(`Sources: ${MODEL_CONFIG.sources.map(s => s.name).join(', ')}`);
  console.log('');

  // 确保缓存目录存在
  ensureDir(CACHE_DIR);
  ensureDir(path.join(CACHE_DIR, 'onnx'));
  ensureDir(PUBLIC_DIR);
  ensureDir(path.join(PUBLIC_DIR, 'onnx'));

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  // 下载每个文件
  for (const file of MODEL_CONFIG.files) {
    const fileName = path.basename(file);
    const cachePath = path.join(CACHE_DIR, file);
    const publicPath = path.join(PUBLIC_DIR, file);

    console.log(`\n[File] ${fileName}`);

    // 检查文件是否已存在（任一位置）
    if (fileExistsAndValid(cachePath) || fileExistsAndValid(publicPath)) {
      const existingPath = fileExistsAndValid(cachePath) ? cachePath : publicPath;
      const stats = fs.statSync(existingPath);
      console.log(`[Skip] File already exists (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

      // 如果文件只存在于一个位置，复制到另一个位置
      if (fileExistsAndValid(cachePath) && !fileExistsAndValid(publicPath)) {
        fs.copyFileSync(cachePath, publicPath);
        console.log(`[Copy] Copied to public directory`);
      } else if (fileExistsAndValid(publicPath) && !fileExistsAndValid(cachePath)) {
        fs.copyFileSync(publicPath, cachePath);
        console.log(`[Copy] Copied to cache directory`);
      }

      skipCount++;
      continue;
    }

    try {
      // 下载到缓存目录
      await downloadFileWithFallback(file, cachePath);
      // 复制到 public 目录
      fs.copyFileSync(cachePath, publicPath);
      console.log(`[Copy] Copied to public directory`);
      successCount++;
    } catch (error) {
      console.error(`\n[Error] Failed to download ${fileName}:`, error.message);
      failCount++;
    }
  }

  // 输出结果
  console.log('\n' + '='.repeat(60));
  console.log('Download Summary');
  console.log('='.repeat(60));
  console.log(`✅ Success: ${successCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log(`❌ Failed:  ${failCount}`);
  console.log('');

  if (failCount === 0) {
    console.log('🎉 All files downloaded successfully!');

    // 保存版本信息
    const configPath = path.join(CACHE_DIR, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const versionInfo = {
          version: config.transformers_version || 'unknown',
          modelId: MODEL_CONFIG.modelId,
          downloadedAt: new Date().toISOString(),
          checkedAt: new Date().toISOString(),
        };
        fs.writeFileSync(
          path.join(path.dirname(CACHE_DIR), '.model-version'),
          JSON.stringify(versionInfo, null, 2)
        );
        console.log('💾 Version info saved.');
      } catch (e) {
        console.warn('⚠️  Failed to save version info:', e.message);
      }
    }

    console.log('You can now use the Vector Memory feature in the browser.');
    process.exit(0);
  } else if (successCount + skipCount > 0) {
    console.log('⚠️  Some files failed to download, but core files are available.');
    console.log('You can try again later or download manually from:');
    console.log('https://huggingface.co/Xenova/all-MiniLM-L6-v2/tree/main');
    process.exit(0);
  } else {
    console.log('❌ All downloads failed.');
    console.log('Please check your network connection and try again.');
    console.log('Alternative download URL:');
    console.log('https://huggingface.co/Xenova/all-MiniLM-L6-v2/tree/main');
    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  console.error('[Fatal Error]', error);
  process.exit(1);
});
