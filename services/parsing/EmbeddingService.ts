/**
 * EmbeddingService - 文本向量化服务
 * 使用本地Embedding模型，无需外部API
 * 
 * 注意：浏览器环境无法通过 env.remoteHost 配置下载源
 * 模型文件需要通过预下载脚本提前准备到本地缓存
 * 
 * 预下载命令：npm run download-model
 * 
 * @module services/parsing/EmbeddingService
 * @version 3.0.0
 */

import { pipeline, Pipeline, env } from '@xenova/transformers';

// 配置 Transformers.js 使用本地模型缓存
// 浏览器环境：配置本地路径，避免从 CDN 下载
if (typeof window !== 'undefined') {
  // 浏览器环境：使用相对路径，让库从 /models/ 加载
  // 模型文件放在 public/models/ 目录，Vite 会自动提供静态文件服务
  env.remoteHost = window.location.origin;
  env.remotePathTemplate = '/models/{model}/{file}';
  
  // 配置 ONNX Runtime WASM 文件路径，避免从 CDN 下载
  // WASM 文件放在 public/ort-wasm/ 目录
  if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
    env.backends.onnx.wasm.wasmPaths = '/ort-wasm/';
  }
}
// Node.js 环境：使用 ModelScope 镜像（用于预下载脚本）
else {
  env.remoteHost = 'https://www.modelscope.cn';
  env.remotePathTemplate = '{model}/resolve/master/{file}';
}

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  dimensions: number;
}

export interface ModelDownloadState {
  status: 'idle' | 'checking' | 'downloading' | 'success' | 'error';
  progress: number; // 0-100
  totalSize?: string;
  downloadedSize?: string;
  error?: string;
  retryCount: number;
  localModelExists: boolean;
}

export class EmbeddingService {
  private embedder: Pipeline | null = null;
  private modelName: string;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;
  
  // 下载状态管理
  private downloadState: ModelDownloadState = {
    status: 'idle',
    progress: 0,
    retryCount: 0,
    localModelExists: false
  };
  private downloadListeners: ((state: ModelDownloadState) => void)[] = [];

  constructor(
    modelName: string = 'Xenova/all-MiniLM-L6-v2' // 轻量级模型，384维
  ) {
    this.modelName = modelName;
  }

  /**
   * 检查本地模型是否存在
   */
  private checkLocalModel(): boolean {
    // 在浏览器环境中，@xenova/transformers 会自动检查本地缓存
    // 缓存位置：/data/models/Xenova/all-MiniLM-L6-v2/
    // 我们假设如果之前运行过 download-model 脚本，模型就会存在
    
    // 注意：由于浏览器安全限制，无法直接检查文件系统
    // 我们通过尝试加载来判断模型是否存在
    return false; // 默认返回 false，让 initialize 方法去尝试加载
  }

  /**
   * 订阅下载状态
   */
  onDownloadProgress(callback: (state: ModelDownloadState) => void): () => void {
    this.downloadListeners.push(callback);
    // 立即通知当前状态
    callback(this.downloadState);
    return () => {
      this.downloadListeners = this.downloadListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * 更新下载状态
   */
  private updateDownloadState(state: Partial<ModelDownloadState>): void {
    this.downloadState = { ...this.downloadState, ...state };
    this.downloadListeners.forEach(cb => cb(this.downloadState));
  }

  /**
   * 获取当前下载状态
   */
  getDownloadState(): ModelDownloadState {
    return { ...this.downloadState };
  }

  /**
   * 初始化Embedding模型
   * 
   * 浏览器环境：依赖本地缓存，如果模型不存在会失败
   * Node.js 环境：可以从 ModelScope 下载
   */
  async initialize(): Promise<void> {
    if (this.embedder) {
      this.updateDownloadState({ status: 'success', progress: 100, localModelExists: true });
      return; // 已初始化
    }

    if (this.isInitializing && this.initPromise) {
      return this.initPromise; // 等待初始化完成
    }

    this.isInitializing = true;
    this.updateDownloadState({ status: 'checking', progress: 0 });
    this.initPromise = this.doInitialize();

    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      console.log(`[EmbeddingService] Loading model: ${this.modelName}`);
      
      // 检查是否在浏览器环境
      const isBrowser = typeof window !== 'undefined';
      
      if (isBrowser) {
        console.log('[EmbeddingService] Browser environment detected');
        console.log('[EmbeddingService] Checking local model cache...');
        
        // 浏览器环境：尝试加载本地模型
        // 如果模型不存在，会抛出错误
        this.updateDownloadState({ status: 'downloading', progress: 50 });
        
        try {
          this.embedder = await pipeline(
            'feature-extraction',
            this.modelName,
            {
              quantized: true,
              revision: 'main',
              cache_dir: './data/models'
            }
          );
          
          this.updateDownloadState({ 
            status: 'success', 
            progress: 100,
            localModelExists: true 
          });
          console.log('[EmbeddingService] Model loaded from local cache');
        } catch (error) {
          // 本地模型不存在，显示友好错误
          console.error('[EmbeddingService] Local model not found');
          this.updateDownloadState({ 
            status: 'error', 
            progress: 0,
            localModelExists: false,
            error: '本地模型不存在，请先运行 npm run download-model 下载模型文件'
          });
          throw new Error('Local model not found. Please run "npm run download-model" first.');
        }
      } else {
        // Node.js 环境：可以从 ModelScope 下载
        console.log('[EmbeddingService] Node.js environment detected');
        console.log('[EmbeddingService] Downloading from ModelScope if needed...');
        
        this.updateDownloadState({ status: 'downloading', progress: 0 });
        
        this.embedder = await pipeline(
          'feature-extraction',
          this.modelName,
          {
            quantized: true,
            revision: 'main',
            cache_dir: './data/models'
          }
        );
        
        this.updateDownloadState({ 
          status: 'success', 
          progress: 100,
          localModelExists: true 
        });
        console.log('[EmbeddingService] Model loaded successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateDownloadState({ 
        status: 'error', 
        error: errorMessage,
        localModelExists: false
      });
      console.error('[EmbeddingService] Failed to load model:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * 重试下载
   * 在浏览器环境中，重试没有意义，因为无法下载
   * 在 Node.js 环境中，可以尝试重新下载
   */
  async retryDownload(): Promise<void> {
    const isBrowser = typeof window !== 'undefined';
    
    if (isBrowser) {
      // 浏览器环境：无法重试下载，直接失败
      throw new Error('Browser environment cannot download models. Please run "npm run download-model" in Node.js environment.');
    }
    
    // Node.js 环境：可以重试
    this.downloadState.retryCount++;
    this.embedder = null;
    this.updateDownloadState({ 
      status: 'downloading', 
      progress: 0,
      error: undefined 
    });
    await this.initialize();
  }

  /**
   * 获取手动下载指引
   */
  getManualDownloadGuide(): {
    modelName: string;
    downloadCommand: string;
    targetPath: string;
    instructions: string[];
    requirements: string[];
  } {
    return {
      modelName: 'Xenova/all-MiniLM-L6-v2',
      downloadCommand: 'npm run download-model',
      targetPath: './data/models/Xenova/all-MiniLM-L6-v2/',
      instructions: [
        '1. 确保已安装 Node.js 环境',
        '2. 在项目根目录运行命令：npm run download-model',
        '3. 等待脚本下载完成（约 80MB）',
        '4. 刷新浏览器页面',
        '5. 重新开启智能记忆功能'
      ],
      requirements: [
        'Node.js 环境（用于运行下载脚本）',
        '约 80MB 磁盘空间',
        '网络连接（用于从 ModelScope 下载）'
      ]
    };
  }

  /**
   * 生成文本向量
   * @param text 输入文本
   * @returns 向量结果
   */
  async embed(text: string): Promise<EmbeddingResult> {
    await this.initialize();

    if (!this.embedder) {
      throw new Error('Embedding model not initialized');
    }

    // 限制文本长度（模型有最大输入限制）
    const maxLength = 512;
    const truncatedText = text.length > maxLength 
      ? text.substring(0, maxLength) 
      : text;

    // 生成向量
    const output = await this.embedder(truncatedText, {
      pooling: 'mean',
      normalize: true
    });

    // 提取向量数据
    const embedding = Array.from(output.data) as number[];

    return {
      text: truncatedText,
      embedding,
      dimensions: embedding.length
    };
  }

  /**
   * 批量生成向量
   * @param texts 文本列表
   * @returns 向量结果列表
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    await this.initialize();

    if (!this.embedder) {
      throw new Error('Embedding model not initialized');
    }

    console.log(`[EmbeddingService] Embedding ${texts.length} texts...`);

    const results: EmbeddingResult[] = [];

    // 批量处理，避免内存溢出
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(text => this.embed(text))
      );
      
      results.push(...batchResults);
      
      if (i + batchSize < texts.length) {
        console.log(`[EmbeddingService] Progress: ${Math.min(i + batchSize, texts.length)}/${texts.length}`);
      }
    }

    console.log(`[EmbeddingService] Embedded ${results.length} texts successfully`);
    return results;
  }

  /**
   * 计算两个向量的余弦相似度
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 获取模型信息
   */
  getModelInfo(): { name: string; dimensions: number } {
    return {
      name: this.modelName,
      dimensions: 384
    };
  }
}

// 单例实例
export const embeddingService = new EmbeddingService();
