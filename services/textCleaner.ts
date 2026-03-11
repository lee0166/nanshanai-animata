/**
 * 文本清洗服务
 * 用于清洗上传的小说文本，统一格式，便于后续解析
 */

export interface Chapter {
  title: string;
  content: string;
  index: number;
}

export interface TextCleanResult {
  cleanedText: string;
  chapters: Chapter[];
  stats: {
    originalLength: number;
    cleanedLength: number;
    chapterCount: number;
    removedChars: number;
  };
}

export class TextCleaner {
  /**
   * 清洗文本
   * @param text 原始文本
   * @returns 清洗后的文本
   */
  static clean(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    let cleaned = text;

    // 1. 统一换行符
    cleaned = cleaned.replace(/\r\n/g, '\n');
    cleaned = cleaned.replace(/\r/g, '\n');

    // 2. 去除控制字符（保留换行、制表符）
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

    // 3. 合并多余空行（3个及以上换行合并为2个）
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // 4. 去除行首行尾空白（不包括换行符）
    cleaned = cleaned.replace(/^[ \t]+|[ \t]+$/gm, '');

    // 5. 统一空格（多个空格合并为一个）
    cleaned = cleaned.replace(/[ \t]+/g, ' ');

    // 6. 去除空行中的空格
    cleaned = cleaned.replace(/\n[ \t]+\n/g, '\n\n');

    // 7. 去除全文首尾空白
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * 提取章节结构
   * @param text 清洗后的文本
   * @returns 章节列表
   */
  static extractChapters(text: string): Chapter[] {
    const chapters: Chapter[] = [];

    // 章节标题匹配模式（只匹配标题行）
    const chapterTitlePatterns = [
      // 第X章/集/回/节 + 标题
      /^第[一二三四五六七八九十百千万\d]+[章集回节][^\n]*$/m,
      // Chapter X + 标题
      /^Chapter\s+\d+[.:]?\s*[^\n]*$/im,
      // X. 标题
      /^\d+[.．、]\s*[^\n]+$/m,
    ];

    // 找到所有章节标题的位置
    const chapterPositions: { title: string; start: number; end: number }[] = [];

    for (const pattern of chapterTitlePatterns) {
      const matches = [...text.matchAll(new RegExp(pattern, 'gm'))];
      if (matches.length > 0) {
        matches.forEach(match => {
          if (match.index !== undefined) {
            chapterPositions.push({
              title: match[0].trim(),
              start: match.index,
              end: match.index + match[0].length,
            });
          }
        });
        break; // 使用第一个成功匹配的模式
      }
    }

    // 根据位置提取章节内容
    if (chapterPositions.length > 0) {
      chapterPositions.forEach((pos, index) => {
        const nextPos = chapterPositions[index + 1];
        const contentStart = pos.end;
        const contentEnd = nextPos ? nextPos.start : text.length;
        const content = text.slice(contentStart, contentEnd).trim();

        chapters.push({
          title: pos.title,
          content,
          index: index + 1,
        });
      });
    } else {
      // 如果没有匹配到章节，将整个文本作为一个章节
      chapters.push({
        title: '全文',
        content: text,
        index: 1,
      });
    }

    return chapters;
  }

  /**
   * 清洗并分析文本
   * @param text 原始文本
   * @returns 清洗结果
   */
  static process(text: string): TextCleanResult {
    const originalLength = text.length;
    const cleanedText = this.clean(text);
    const cleanedLength = cleanedText.length;
    const chapters = this.extractChapters(cleanedText);

    return {
      cleanedText,
      chapters,
      stats: {
        originalLength,
        cleanedLength,
        chapterCount: chapters.length,
        removedChars: originalLength - cleanedLength,
      },
    };
  }

  /**
   * 智能分段
   * 将长文本按段落分割，适用于没有明显章节标记的文本
   * @param text 文本
   * @param maxChunkSize 每段最大字符数
   * @returns 分段后的文本数组
   */
  static smartChunk(text: string, maxChunkSize: number = 3000): string[] {
    const cleaned = this.clean(text);
    const paragraphs = cleaned.split('\n\n');
    const chunks: string[] = [];
    let currentChunk = '';

    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      if (!trimmedPara) continue;

      // 如果当前段落加上已有内容超过限制，且已有内容不为空
      if (currentChunk.length + trimmedPara.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = trimmedPara;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
      }
    }

    // 添加最后一段
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * 检测文本编码问题
   * @param text 文本
   * @returns 编码问题列表
   */
  static detectEncodingIssues(text: string): string[] {
    const issues: string[] = [];

    // 检测乱码字符
    const garbledPattern = /[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
    if (garbledPattern.test(text)) {
      issues.push('包含乱码字符');
    }

    // 检测混合换行符
    if (text.includes('\r\n') && text.includes('\n') && text.includes('\r')) {
      issues.push('混合使用多种换行符');
    }

    // 检测过多空行
    if (/\n{5,}/.test(text)) {
      issues.push('存在过多连续空行');
    }

    // 检测行尾空格
    if (/[ \t]+\n/.test(text)) {
      issues.push('存在行尾空格');
    }

    return issues;
  }
}

export default TextCleaner;
