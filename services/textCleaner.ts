/**
 * 文本清洗服务
 * 用于清洗上传的小说文本，统一格式，便于后续解析
 */

export type LanguageType = 'zh' | 'en' | 'mixed';

export interface Chapter {
  title: string;
  content: string;
  index: number;
  dialogues?: Dialogue[];
  language?: LanguageType;
}

export interface Dialogue {
  character: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

export interface TextCleanResult {
  originalText: string;
  cleanedText: string;
  chapters: Chapter[];
  dialogues: Dialogue[];
  characters: string[];
  language: LanguageType;
  stats: {
    originalLength: number;
    cleanedLength: number;
    chapterCount: number;
    dialogueCount: number;
    characterCount: number;
    removedChars: number;
  };
}

export class TextCleaner {
  /**
   * 检测文本语言类型
   * @param text 文本
   * @returns 语言类型
   */
  static detectLanguage(text: string): LanguageType {
    if (!text || typeof text !== 'string') {
      return 'zh';
    }

    // 中文字符检测
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
    // 英文字符检测
    const englishChars = text.match(/[a-zA-Z]/g)?.length || 0;
    // 总字符数（去除空白字符）
    const totalChars = text.replace(/\s/g, '').length;

    if (totalChars === 0) {
      return 'zh';
    }

    const chineseRatio = chineseChars / totalChars;
    const englishRatio = englishChars / totalChars;

    // 如果中文比例超过30%，认为是中文（基于主流应用实践）
    if (chineseRatio > 0.3) {
      return 'zh';
    }
    // 如果英文比例超过30%，认为是英文（基于主流应用实践）
    else if (englishRatio > 0.3) {
      return 'en';
    }
    // 否则认为是混合语言
    else {
      return 'mixed';
    }
  }

  /**
   * 清洗文本
   * @param text 原始文本
   * @param language 语言类型（可选，自动检测）
   * @returns 清洗后的文本
   */
  static clean(text: string, language?: LanguageType): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    // 自动检测语言
    const detectedLanguage = language || this.detectLanguage(text);
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

    // 8. 标点符号规范化
    // 8.1 中文/混合语言：保留全角标点（基于GB/T 15834-2011国家标准）
    // 中文正文应使用全角标点，不进行转换
    // 8.2 英文语言：全角标点转换为半角
    if (detectedLanguage === 'en') {
      const fullWidthToHalfWidthMap: { [key: string]: string } = {
        '，': ',',
        '。': '.',
        '！': '!',
        '？': '?',
        '：': ':',
        '；': ';',
        '（': '(',
        '）': ')',
        '【': '[',
        '】': ']',
        '“': '"',
        '”': '"',
        '‘': "'",
        '’': "'",
        '、': ',',
        '《': '<',
        '》': '>',
        '～': '~',
        '￥': '$',
        '％': '%',
        '＋': '+',
        '－': '-',
        '×': '*',
        '÷': '/',
        '＝': '=',
        '＃': '#',
        '＠': '@',
        '＆': '&',
        '＊': '*',
        '＿': '_',
        '｜': '|',
        '＼': '\\',
        '［': '[',
        '］': ']',
        '｛': '{',
        '｝': '}',
      };

      Object.entries(fullWidthToHalfWidthMap).forEach(([full, half]) => {
        cleaned = cleaned.replace(new RegExp(full, 'g'), half);
      });
    }

    // 8.2 统一处理省略号（将各种形式的省略号统一为...）
    cleaned = cleaned.replace(/[…．．．。。。]/g, '...');
    cleaned = cleaned.replace(/\.{4,}/g, '...');

    // 8.3 统一处理破折号（将各种形式的破折号统一为--）
    cleaned = cleaned.replace(/[—−－]/g, '--');
    cleaned = cleaned.replace(/-{3,}/g, '--');

    // 8.4 处理智能引号
    // 左双引号
    cleaned = cleaned.replace(/[“”]/g, '"');
    // 左单引号
    cleaned = cleaned.replace(/[‘’]/g, "'");

    // 8.5 清理多余的特殊字符
    // 清理连续的感叹号
    cleaned = cleaned.replace(/!{3,}/g, '!!');
    // 清理连续的问号
    cleaned = cleaned.replace(/\?{3,}/g, '??');
    // 清理连续的逗号
    cleaned = cleaned.replace(/,{3,}/g, ',');
    // 清理连续的冒号
    cleaned = cleaned.replace(/:{3,}/g, ':');
    // 清理连续的分号
    cleaned = cleaned.replace(/;{3,}/g, ';');
    // 清理连续的括号
    cleaned = cleaned.replace(/\({3,}/g, '(');
    cleaned = cleaned.replace(/\){3,}/g, ')');
    cleaned = cleaned.replace(/\[{3,}/g, '[');
    cleaned = cleaned.replace(/\]{3,}/g, ']');
    cleaned = cleaned.replace(/\{{3,}/g, '{');
    cleaned = cleaned.replace(/\}{3,}/g, '}');

    // 9. 语言特定处理
    if (detectedLanguage === 'zh') {
      // 中文特定处理
      // 确保中文标点后有空格
      cleaned = cleaned.replace(/([，。！？；：])([^\s])/g, '$1 $2');
      // 确保中文与英文/数字之间有空格
      cleaned = cleaned.replace(/([\u4e00-\u9fa5])([a-zA-Z0-9])/g, '$1 $2');
      cleaned = cleaned.replace(/([a-zA-Z0-9])([\u4e00-\u9fa5])/g, '$1 $2');
    } else if (detectedLanguage === 'en') {
      // 英文特定处理
      // 确保英文标点后有空格
      cleaned = cleaned.replace(/([.!?;:])([^\s])/g, '$1 $2');
      // 确保英文标点前没有空格
      cleaned = cleaned.replace(/([^\s])([.!?;:])/g, '$1$2');
    } else if (detectedLanguage === 'mixed') {
      // 混合语言处理
      // 确保中文标点后有空格
      cleaned = cleaned.replace(/([，。！？；：])([^\s])/g, '$1 $2');
      // 确保英文标点后有空格
      cleaned = cleaned.replace(/([.!?;:])([^\s])/g, '$1 $2');
      // 确保英文标点前没有空格
      cleaned = cleaned.replace(/([^\s])([.!?;:])/g, '$1$2');
      // 确保中文与英文/数字之间有空格
      cleaned = cleaned.replace(/([\u4e00-\u9fa5])([a-zA-Z0-9])/g, '$1 $2');
      cleaned = cleaned.replace(/([a-zA-Z0-9])([\u4e00-\u9fa5])/g, '$1 $2');
    }

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
      // Episode X + 标题
      /^Episode\s+\d+[.:]?\s*[^\n]*$/im,
      // Section X + 标题
      /^Section\s+\d+[.:]?\s*[^\n]*$/im,
      // 场景 X + 标题
      /^场景\s*[一二三四五六七八九十百千万\d]+[.:]?\s*[^\n]*$/m,
      // 幕 X + 标题
      /^幕\s*[一二三四五六七八九十百千万\d]+[.:]?\s*[^\n]*$/m,
      // X. 标题
      /^\d+[.．、]\s*[^\n]+$/m,
      // X - 标题
      /^\d+\s*-\s*[^\n]+$/m,
      // [X] 标题
      /^\[\d+\]\s*[^\n]+$/m,
      // (X) 标题
      /^\(\d+\)\s*[^\n]+$/m,
    ];

    // 找到所有章节标题的位置
    const chapterPositions: { title: string; start: number; end: number }[] = [];

    // 收集所有匹配的章节标题
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
      }
    }

    // 按位置排序
    chapterPositions.sort((a, b) => a.start - b.start);

    // 去重，避免重复匹配
    const uniquePositions: { title: string; start: number; end: number }[] = [];
    let lastEnd = -1;
    for (const pos of chapterPositions) {
      if (pos.start > lastEnd) {
        uniquePositions.push(pos);
        lastEnd = pos.end;
      }
    }

    // 使用去重后的位置
    const finalPositions = uniquePositions.length > 0 ? uniquePositions : chapterPositions;

    // 根据位置提取章节内容
    if (finalPositions.length > 0) {
      finalPositions.forEach((pos, index) => {
        const nextPos = finalPositions[index + 1];
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
   * @param progressCallback 进度回调函数
   * @returns 清洗结果
   */
  static process(text: string, progressCallback?: (progress: number) => void): TextCleanResult {
    const originalLength = text.length;

    // 步骤1：检测语言（10%进度）
    if (progressCallback) {
      progressCallback(0);
    }
    const language = this.detectLanguage(text);
    if (progressCallback) {
      progressCallback(10);
    }

    // 步骤2：清洗文本（40%进度）
    const cleanedText = this.clean(text, language);
    if (progressCallback) {
      progressCallback(50);
    }

    const cleanedLength = cleanedText.length;

    // 步骤3：提取章节（30%进度）
    const chapters = this.extractChapters(cleanedText);
    // 为每个章节添加语言信息
    const enhancedChapters = chapters.map(chapter => ({
      ...chapter,
      language: this.detectLanguage(chapter.content),
    }));
    if (progressCallback) {
      progressCallback(80);
    }

    // 步骤4：完成处理（20%进度）
    if (progressCallback) {
      progressCallback(100);
    }

    return {
      originalText: text,
      cleanedText,
      chapters: enhancedChapters,
      dialogues: [],
      characters: [],
      language,
      stats: {
        originalLength,
        cleanedLength,
        chapterCount: chapters.length,
        dialogueCount: 0,
        characterCount: 0,
        removedChars: originalLength - cleanedLength,
      },
    };
  }

  /**
   * 智能分段
   * 将长文本按段落分割，适用于没有明显章节标记的文本
   * @param text 文本
   * @param maxChunkSize 每段最大字符数
   * @param progressCallback 进度回调函数
   * @returns 分段后的文本数组
   */
  static smartChunk(
    text: string,
    maxChunkSize: number = 3000,
    progressCallback?: (progress: number) => void
  ): string[] {
    // 分块处理，避免一次性加载全部文本
    const chunks: string[] = [];
    const totalLength = text.length;
    let processedLength = 0;
    let currentChunk = '';
    let startIndex = 0;
    const chunkSize = Math.min(100000, totalLength); // 每次处理的块大小

    // 分块处理文本
    while (startIndex < totalLength) {
      // 计算当前处理的块
      const endIndex = Math.min(startIndex + chunkSize, totalLength);
      const chunkText = text.substring(startIndex, endIndex);

      // 清洗当前块
      const cleanedChunk = this.clean(chunkText);
      const paragraphs = cleanedChunk.split('\n\n');

      // 处理段落
      for (const para of paragraphs) {
        const trimmedPara = para.trim();
        if (!trimmedPara) continue;

        // 如果当前段落加上已有内容超过限制，且已有内容不为空
        if (currentChunk.length + trimmedPara.length > maxChunkSize && currentChunk.length > 0) {
          // 尝试在句子边界处分割
          const lastSentenceEnd = this.findLastSentenceEnd(currentChunk);
          if (lastSentenceEnd > 0) {
            // 分割到句子末尾
            const chunkToAdd = currentChunk.substring(0, lastSentenceEnd).trim();
            chunks.push(chunkToAdd);
            // 剩余部分作为新块的开始
            const remaining = currentChunk.substring(lastSentenceEnd).trim();
            currentChunk = remaining ? remaining + '\n\n' + trimmedPara : trimmedPara;
          } else {
            // 如果找不到句子边界，按原有逻辑处理
            chunks.push(currentChunk.trim());
            currentChunk = trimmedPara;
          }
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
        }
      }

      // 更新处理进度
      startIndex = endIndex;
      processedLength = endIndex;
      const progress = Math.min(100, Math.round((processedLength / totalLength) * 100));
      if (progressCallback) {
        progressCallback(progress);
      }
    }

    // 添加最后一段
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // 完成处理
    if (progressCallback) {
      progressCallback(100);
    }

    return chunks;
  }

  /**
   * 查找最后一个句子结束位置
   * @param text 文本
   * @returns 最后一个句子结束的位置
   */
  private static findLastSentenceEnd(text: string): number {
    // 句子结束标点
    const sentenceEndings = /[。！？；.!?;]/g;
    let lastMatch = -1;
    let match;

    while ((match = sentenceEndings.exec(text)) !== null) {
      lastMatch = match.index + match[0].length;
    }

    return lastMatch;
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
    if (/(\n{5,})/.test(text)) {
      issues.push('存在过多连续空行');
    }

    // 检测行尾空格
    if (/[ \t]+\n/.test(text)) {
      issues.push('存在行尾空格');
    }

    return issues;
  }

  /**
   * 识别对话内容
   * @param text 文本
   * @returns 对话列表
   */
  static identifyDialogues(text: string): Dialogue[] {
    const dialogues: Dialogue[] = [];

    // 对话模式匹配
    const dialoguePatterns = [
      // 模式1: "角色名：对话内容"
      /([^：\n]+)：([^\n]+)/g,
      // 模式2: "角色名:" 对话内容
      /([^:\n]+):\s*([^\n]+)/g,
      // 模式3: "角色名说：对话内容"
      /([^说：\n]+)说：([^\n]+)/g,
      // 模式4: "角色名说道：对话内容"
      /([^说道：\n]+)说道：([^\n]+)/g,
      // 模式5: "角色名:" 对话内容（带引号）
      /([^:\n]+):\s*["'”“]([^"'”“\n]+)["'”“]/g,
      // 模式6: [角色名] 对话内容
      /\[([^\]\n]+)\]\s*([^\n]+)/g,
      // 模式7: (角色名) 对话内容
      /\(([^\)\n]+)\)\s*([^\n]+)/g,
      // 模式8: 角色名\n对话内容
      /^([^\n]+)$\s*\n^([^\n]+)$/gm,
    ];

    // 应用所有模式
    dialoguePatterns.forEach(pattern => {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        matches.forEach(match => {
          if (match.index !== undefined) {
            const character = match[1].trim();
            const content = match[2].trim();

            // 过滤无效对话
            if (character && content && character.length < 50 && content.length < 500) {
              dialogues.push({
                character,
                content,
                startIndex: match.index,
                endIndex: match.index + match[0].length,
              });
            }
          }
        });
      }
    });

    // 去重，避免重复识别
    const uniqueDialogues = this.removeDuplicateDialogues(dialogues);

    // 排序，按位置顺序
    uniqueDialogues.sort((a, b) => a.startIndex - b.startIndex);

    return uniqueDialogues;
  }

  /**
   * 移除重复对话
   * @param dialogues 对话列表
   * @returns 去重后的对话列表
   */
  private static removeDuplicateDialogues(dialogues: Dialogue[]): Dialogue[] {
    const unique: Dialogue[] = [];
    const seen = new Set<string>();

    dialogues.forEach(dialogue => {
      const key = `${dialogue.startIndex}-${dialogue.endIndex}-${dialogue.character}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(dialogue);
      }
    });

    return unique;
  }

  /**
   * 统一对话格式
   * @param text 文本
   * @returns 统一格式后的文本
   */
  static unifyDialogueFormat(text: string): string {
    let result = text;

    // 统一对话格式为 "角色名：对话内容"
    const dialoguePatterns = [
      // 模式1: "角色名:" 对话内容
      /([^:\n]+):\s*([^\n]+)/g,
      // 模式2: "角色名说：对话内容"
      /([^说：\n]+)说：([^\n]+)/g,
      // 模式3: "角色名说道：对话内容"
      /([^说道：\n]+)说道：([^\n]+)/g,
      // 模式4: "角色名:" 对话内容（带引号）
      /([^:\n]+):\s*["'”“]([^"'”“\n]+)["'”“]/g,
      // 模式5: [角色名] 对话内容
      /\[([^\]\n]+)\]\s*([^\n]+)/g,
      // 模式6: (角色名) 对话内容
      /\(([^\)\n]+)\)\s*([^\n]+)/g,
    ];

    dialoguePatterns.forEach(pattern => {
      result = result.replace(pattern, (match, character, content) => {
        return `${character.trim()}：${content.trim()}`;
      });
    });

    return result;
  }

  /**
   * 提取对话角色信息
   * @param dialogues 对话列表
   * @returns 角色列表
   */
  static extractCharacters(dialogues: Dialogue[]): string[] {
    const characters = new Set<string>();

    dialogues.forEach(dialogue => {
      // 过滤无效角色名
      if (dialogue.character && dialogue.character.length < 50) {
        characters.add(dialogue.character);
      }
    });

    return Array.from(characters).sort();
  }

  /**
   * 增强的文本处理，包含对话识别
   * @param text 原始文本
   * @param progressCallback 进度回调函数
   * @returns 增强的清洗结果
   */
  static enhancedProcess(
    text: string,
    progressCallback?: (progress: number) => void
  ): TextCleanResult {
    const originalLength = text.length;

    // 步骤1：检测语言（5%进度）
    if (progressCallback) {
      progressCallback(0);
    }
    const language = this.detectLanguage(text);
    if (progressCallback) {
      progressCallback(5);
    }

    // 步骤2：清洗文本（20%进度）
    let cleanedText = this.clean(text, language);
    if (progressCallback) {
      progressCallback(25);
    }

    // 步骤3：统一对话格式（25%进度）
    cleanedText = this.unifyDialogueFormat(cleanedText);
    if (progressCallback) {
      progressCallback(50);
    }

    const cleanedLength = cleanedText.length;

    // 步骤4：提取章节（15%进度）
    const chapters = this.extractChapters(cleanedText);
    if (progressCallback) {
      progressCallback(65);
    }

    // 步骤5：识别对话（15%进度）
    const dialogues = this.identifyDialogues(cleanedText);
    if (progressCallback) {
      progressCallback(80);
    }

    // 步骤6：提取角色（10%进度）
    const characters = this.extractCharacters(dialogues);
    if (progressCallback) {
      progressCallback(90);
    }

    // 步骤7：为章节添加对话和语言信息（10%进度）
    const enhancedChapters = chapters.map(chapter => {
      const chapterDialogues = dialogues.filter(dialogue => {
        const chapterStart = cleanedText.indexOf(chapter.content);
        const chapterEnd = chapterStart + chapter.content.length;
        return dialogue.startIndex >= chapterStart && dialogue.endIndex <= chapterEnd;
      });

      return {
        ...chapter,
        dialogues: chapterDialogues,
        language: this.detectLanguage(chapter.content),
      };
    });

    if (progressCallback) {
      progressCallback(100);
    }

    return {
      originalText: text,
      cleanedText,
      chapters: enhancedChapters,
      dialogues,
      characters,
      language,
      stats: {
        originalLength,
        cleanedLength,
        chapterCount: chapters.length,
        dialogueCount: dialogues.length,
        characterCount: characters.length,
        removedChars: originalLength - cleanedLength,
      },
    };
  }
}

export default TextCleaner;
