/**
 * 嵌入模型下载状态
 */
export interface ModelDownloadState {
  isDownloading: boolean;
  progress: number;
  status: 'idle' | 'downloading' | 'completed' | 'error';
  error?: string;
  modelName?: string;
}

/**
 * 嵌入服务
 * 用于文本嵌入和语义搜索
 */
export class EmbeddingService {
  private static instance: EmbeddingService;

  private constructor() {}

  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  /**
   * 获取文本嵌入向量
   */
  async getEmbedding(text: string): Promise<number[]> {
    // 实现文本嵌入逻辑
    throw new Error('Not implemented');
  }

  /**
   * 批量获取文本嵌入
   */
  async getEmbeddings(texts: string[]): Promise<number[][]> {
    // 实现批量文本嵌入逻辑
    throw new Error('Not implemented');
  }
}
