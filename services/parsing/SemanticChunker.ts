/**
 * Semantic Chunker
 *
 * 基于语义的分块策略，解决固定字符分块切断叙事逻辑的问题
 * 基于文档《融合方案_实施细节与代码示例》第2.1节
 *
 * @module services/parsing/SemanticChunker
 * @version 1.0.0
 */

export interface ChunkBoundary {
  position: number;
  type: 'chapter' | 'scene' | 'paragraph' | 'sentence';
  confidence: number;
}

export interface SemanticChunk {
  id: string;
  content: string;
  prevContext: string;
  boundaries: ChunkBoundary[];
  metadata: {
    characters: string[];
    sceneHint: string;
    importance: number;
    wordCount: number;
    chunkType: 'dialogue' | 'action' | 'description' | 'transition';
  };
}

export interface ChunkerOptions {
  maxTokens?: number;
  preserveParagraphs?: boolean;
  extractMetadata?: boolean;
}

export class SemanticChunker {
  // 分隔符规则(按优先级排序)
  private readonly SEPARATORS = [
    { pattern: /【第[一二三四五六七八九十百千万]+[章回]】/g, type: 'chapter' as const, weight: 100 },
    { pattern: /第[一二三四五六七八九十百千万]+章/g, type: 'chapter' as const, weight: 100 },
    { pattern: /Chapter\s+\d+/gi, type: 'chapter' as const, weight: 100 },
    { pattern: /\n{2,}/g, type: 'paragraph' as const, weight: 50 },
    { pattern: /[。！？；]/g, type: 'sentence' as const, weight: 20 },
  ];

  private options: ChunkerOptions;

  constructor(options: ChunkerOptions = {}) {
    this.options = {
      maxTokens: 4000,
      preserveParagraphs: true,
      extractMetadata: false,
      ...options
    };
  }

  /**
   * 主分块方法
   * 按照文档要求的分层策略进行语义分块
   */
  async chunk(content: string): Promise<SemanticChunk[]> {
    // 步骤1: 识别所有潜在分割点
    const boundaries = this.identifyBoundaries(content);

    // 步骤2: 生成分块
    const chunks = this.createChunks(content, boundaries);

    // 步骤3: 为每个分块添加上下文
    this.addContext(chunks);

    // 步骤4: 提取元数据（如果启用）
    if (this.options.extractMetadata) {
      await this.enrichMetadata(chunks);
    }

    return chunks;
  }

  /**
   * 识别所有潜在分割点
   */
  private identifyBoundaries(content: string): ChunkBoundary[] {
    const boundaries: ChunkBoundary[] = [];

    for (const separator of this.SEPARATORS) {
      let match;
      const pattern = new RegExp(separator.pattern.source, separator.pattern.flags);
      while ((match = pattern.exec(content)) !== null) {
        boundaries.push({
          position: match.index + match[0].length,
          type: separator.type,
          confidence: separator.weight
        });
      }
    }

    // 按位置排序并去重
    return boundaries
      .sort((a, b) => a.position - b.position)
      .filter((boundary, index, arr) => {
        // 移除位置过于接近的边界（保留置信度更高的）
        if (index === 0) return true;
        const prev = arr[index - 1];
        return boundary.position - prev.position > 10;
      });
  }

  /**
   * 基于边界和token限制生成分块
   */
  private createChunks(content: string, boundaries: ChunkBoundary[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    let currentChunk = '';
    let lastBoundary = 0;
    let chunkBoundaries: ChunkBoundary[] = [];

    // 估算: 1 token ≈ 1.5个中文字符
    const maxChars = (this.options.maxTokens || 4000) * 1.5;

    for (const boundary of boundaries) {
      const segment = content.slice(lastBoundary, boundary.position);

      if ((currentChunk + segment).length > maxChars && currentChunk.length > 0) {
        // 保存当前分块
        chunks.push(this.createChunk(chunks.length, currentChunk, chunkBoundaries));
        currentChunk = segment;
        chunkBoundaries = [boundary];
      } else {
        currentChunk += segment;
        chunkBoundaries.push(boundary);
      }

      lastBoundary = boundary.position;
    }

    // 处理最后一段
    const finalSegment = content.slice(lastBoundary);
    if (finalSegment.length > 0) {
      currentChunk += finalSegment;
    }

    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(chunks.length, currentChunk, chunkBoundaries));
    }

    return chunks;
  }

  /**
   * 创建单个分块
   */
  private createChunk(index: number, content: string, boundaries: ChunkBoundary[]): SemanticChunk {
    return {
      id: `chunk_${index}`,
      content: content.trim(),
      prevContext: '',
      boundaries,
      metadata: {
        characters: [],
        sceneHint: '',
        importance: 5,
        wordCount: content.length,
        chunkType: this.detectChunkType(content)
      }
    };
  }

  /**
   * 检测分块类型
   */
  private detectChunkType(content: string): SemanticChunk['metadata']['chunkType'] {
    const dialoguePattern = /[""。，][^""]*说[：:""]/g;
    const actionPattern = /[^。，]{3,}[了着过][。，]/g;

    const dialogueMatches = content.match(dialoguePattern) || [];
    const actionMatches = content.match(actionPattern) || [];

    if (dialogueMatches.length > actionMatches.length) {
      return 'dialogue';
    } else if (actionMatches.length > 0) {
      return 'action';
    } else if (content.length < 200) {
      return 'transition';
    } else {
      return 'description';
    }
  }

  /**
   * 为每个分块添加前序上下文
   */
  private addContext(chunks: SemanticChunk[]): void {
    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1];
      const currentChunk = chunks[i];

      // 取前500字作为上下文
      currentChunk.prevContext = prevChunk.content.slice(-500);
    }
  }

  /**
   * 提取分块元数据（简化版，不依赖LLM）
   * 用于快速提取基础信息
   */
  private async enrichMetadata(chunks: SemanticChunk[]): Promise<void> {
    for (const chunk of chunks) {
      // 提取可能的人名（简单的中文姓名匹配）
      const namePattern = /[\u4e00-\u9fa5]{2,4}(?:[说|道|问|答|笑|哭|怒|喜])/g;
      const names = chunk.content.match(namePattern) || [];
      chunk.metadata.characters = [...new Set(names.map(n => n.slice(0, -1)))];

      // 场景提示（简单的地点词匹配）
      const locationPattern = /(?:在|于|到|去|来)([\u4e00-\u9fa5]{2,6})(?:里|中|上|下|前|后|内|外|旁|边|处|地方)/g;
      const locations: string[] = [];
      let match;
      while ((match = locationPattern.exec(chunk.content)) !== null) {
        locations.push(match[1]);
      }
      chunk.metadata.sceneHint = locations[0] || '';

      // 重要性评分（基于关键词）
      const importantKeywords = ['冲突', '战斗', '死亡', '爱', '恨', '秘密', '真相', '决战', '转折'];
      const keywordCount = importantKeywords.filter(kw => chunk.content.includes(kw)).length;
      chunk.metadata.importance = Math.min(10, 5 + keywordCount);
    }
  }

  /**
   * 获取指定位置所在的分块
   */
  getChunkAtPosition(chunks: SemanticChunk[], position: number): SemanticChunk | null {
    let currentPos = 0;
    for (const chunk of chunks) {
      const chunkEnd = currentPos + chunk.content.length;
      if (position >= currentPos && position < chunkEnd) {
        return chunk;
      }
      currentPos = chunkEnd;
    }
    return null;
  }

  /**
   * 合并相邻的小分块
   */
  mergeSmallChunks(chunks: SemanticChunk[], minSize: number = 500): SemanticChunk[] {
    const merged: SemanticChunk[] = [];
    let currentMerge: SemanticChunk | null = null;

    for (const chunk of chunks) {
      if (!currentMerge) {
        currentMerge = { ...chunk };
      } else if (currentMerge.content.length < minSize) {
        // 合并
        currentMerge.content += '\n\n' + chunk.content;
        currentMerge.metadata.wordCount += chunk.metadata.wordCount;
        currentMerge.boundaries.push(...chunk.boundaries);
        currentMerge.metadata.importance = Math.max(
          currentMerge.metadata.importance,
          chunk.metadata.importance
        );
      } else {
        merged.push(currentMerge);
        currentMerge = { ...chunk };
      }
    }

    if (currentMerge) {
      merged.push(currentMerge);
    }

    // 重新编号
    merged.forEach((chunk, index) => {
      chunk.id = `chunk_${index}`;
    });

    return merged;
  }
}
