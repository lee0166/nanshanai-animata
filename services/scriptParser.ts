/**
 * Script Parser Service
 *
 * Provides intelligent script/novel parsing capabilities using LLM models.
 * Features:
 * - Multi-stage parsing pipeline (metadata → characters → scenes → shots)
 * - Concurrent processing with rate limiting
 * - Automatic error recovery and resume support
 * - LRU caching for performance optimization
 * - Progress tracking and cancellation support
 *
 * @module services/scriptParser
 * @author Kmeng AI Team
 * @version 1.0.0
 */

import { Script, ScriptParseState, ScriptMetadata, ScriptCharacter, ScriptScene, Shot, ParseStage } from '../types';
import { storageService } from './storage';

/**
 * Script Parser Configuration
 * @constant {Object}
 */
const CONFIG = {
  /** Maximum characters per chunk for long texts */
  maxChunkSize: 6000,
  /** Default model for parsing */
  defaultModel: 'gpt-4o-mini',
  /** Maximum retry attempts for API calls */
  maxRetries: 3,
  /** Initial retry delay in ms (exponential backoff) */
  retryDelay: 2000,
  /** API call timeout in ms (60 seconds) */
  timeout: 60000,
  /** Maximum concurrent API calls - reduced to 1 to avoid rate limiting */
  concurrency: 1,
  /** Delay between API calls in ms */
  callDelay: 1000,
};

// Prompts for each parsing stage
const PROMPTS = {
  metadata: `
请快速分析以下剧本/小说内容，提取基础元数据：

【剧本内容】
{content}

请提取：
1. 作品标题
2. 总字数
3. 预估时长（如"10分钟"）
4. 主要角色数量
5. 主要角色名称列表（仅名称）
6. 主要场景数量
7. 主要场景名称列表（仅名称）
8. 章节/幕数
9. 故事类型（古装/现代/科幻/悬疑等）
10. 整体基调（喜剧/悲剧/正剧）

请严格按以下JSON格式输出，不要添加任何其他内容：
{
  "title": "作品标题",
  "wordCount": 15000,
  "estimatedDuration": "10分钟",
  "characterCount": 8,
  "characterNames": ["角色1", "角色2"],
  "sceneCount": 12,
  "sceneNames": ["场景1", "场景2"],
  "chapterCount": 5,
  "genre": "古装宅斗",
  "tone": "爽剧"
}
`,

  character: `
请基于以下剧本内容，分析角色"{characterName}"。

【剧本内容】
{content}

请提取以下信息，严格按JSON格式输出（确保所有字段都存在）：
{
  "name": "角色名",
  "gender": "male/female/unknown",
  "age": "18",
  "identity": "身份/职业",
  "appearance": {
    "height": "身高描述",
    "build": "体型",
    "face": "面容特征",
    "hair": "发型",
    "clothing": "服饰风格"
  },
  "personality": ["性格1", "性格2"],
  "signatureItems": ["标志性物品1"],
  "emotionalArc": [
    {"phase": "初始", "emotion": "情绪状态"}
  ],
  "relationships": [
    {"character": "相关角色名", "relation": "关系描述"}
  ],
  "visualPrompt": "仅描述外貌特征：性别、年龄、面容、发型、服饰、体型、标志性物品。禁止：剧情、情绪、背景、关系。格式示例：古代少女约16岁，瓜子脸柳叶眉丹凤眼，乌黑长发挽成垂鬟分肖髻，身着淡紫色绣花襦裙外披白色纱衣，体态纤细，手持团扇。80-120字"
}

重要提示：
1. age字段必须是纯数字（如"18"），不要带"岁"字
2. visualPrompt必须纯净：只描述外貌形象，禁止包含剧情、情绪、环境、关系
3. 如果信息不足，使用合理的默认值填充所有字段
4. 必须返回完整的JSON，不能省略任何字段
`,

  charactersBatch: `
请基于以下剧本内容，一次性分析所有角色。

【剧本内容】
{content}

【角色列表】
{characterNames}

请为每个角色提取以下信息，严格按JSON数组格式输出（确保所有字段都存在）：
[
  {
    "name": "角色名",
    "gender": "male/female/unknown",
    "age": "18",
    "identity": "身份/职业",
    "appearance": {
      "height": "身高描述",
      "build": "体型",
      "face": "面容特征",
      "hair": "发型",
      "clothing": "服饰风格"
    },
    "personality": ["性格1", "性格2"],
    "signatureItems": ["标志性物品1"],
    "emotionalArc": [{"phase": "初始", "emotion": "情绪状态"}],
    "relationships": [{"character": "相关角色名", "relation": "关系描述"}],
    "visualPrompt": "仅描述外貌特征：性别、年龄、面容、发型、服饰、体型、标志性物品。禁止：剧情、情绪、背景、关系。示例：古代少女约16岁，瓜子脸柳叶眉，乌黑长发挽髻，身着淡紫色绣花襦裙，体态纤细，手持团扇。60-80字"
  }
]

重要提示：
1. 必须返回JSON数组，包含所有角色
2. age字段必须是纯数字
3. visualPrompt必须纯净：只描述外貌形象，禁止包含剧情、情绪、环境、关系
4. 如果信息不足，使用合理的默认值
`,

  scenesBatch: `
请基于以下剧本内容，一次性分析所有场景。

【剧本内容】
{content}

【场景列表】
{sceneNames}

请为每个场景提取以下信息，严格按JSON数组格式输出（确保所有字段都存在）：
[
  {
    "name": "场景名",
    "locationType": "indoor/outdoor/unknown",
    "description": "场景描述，30字以内",
    "timeOfDay": "时间段",
    "season": "季节",
    "weather": "天气",
    "environment": {
      "architecture": "建筑风格",
      "furnishings": ["陈设1"],
      "lighting": "光线条件",
      "colorTone": "色调氛围"
    },
    "sceneFunction": "场景作用",
    "visualPrompt": "用于AI生图的描述，50字以内",
    "characters": ["场景中出现的角色名"]
  }
]

重要提示：
1. 必须返回JSON数组，包含所有场景
2. description和visualPrompt控制在50字以内，节省token
3. 如果信息不足，使用合理的默认值
`,

  itemsBatch: `
请基于以下剧本内容，提取所有重要道具/物品。

【剧本内容】
{content}

请提取以下类型的道具：
1. 武器（剑、枪、法器等）
2. 工具（特殊工具、设备等）
3. 珠宝饰品（项链、戒指等）
4. 文档（信件、地图、秘籍等）
5. 生物/灵兽（宠物、坐骑等）
6. 其他重要物品

请严格按JSON数组格式输出：
[
  {
    "name": "道具名称",
    "description": "道具描述，50字以内",
    "category": "weapon/tool/jewelry/document/creature/animal/other",
    "owner": "所属角色名（如有）",
    "importance": "major/minor",
    "visualPrompt": "用于AI生图的描述，50字以内"
  }
]

重要提示：
1. 只提取对剧情有重要作用的道具
2. 普通物品（如桌椅、衣服）不需要提取
3. 必须返回JSON数组
`,

  shotsBatch: `
请为以下所有场景生成分镜脚本。

【剧本内容】
{content}

【场景信息】
{scenesInfo}

请为每个场景生成3-5个关键分镜，严格按JSON数组格式输出：
[
  {
    "sceneName": "场景名称",
    "sequence": 1,
    "shotType": "full",
    "cameraMovement": "static",
    "description": "画面描述，30字以内",
    "dialogue": "台词（可选）",
    "sound": "音效（可选）",
    "duration": 3,
    "characters": ["角色名"]
  }
]

景别选项：extreme_long, long, full, medium, close_up, extreme_close_up
运镜选项：static, push, pull, pan, tilt, track, crane

重要提示：
1. 每个场景生成3-5个关键分镜
2. description控制在30字以内，节省token
3. 必须包含sceneName字段用于区分场景
`,

  scene: `
请分析以下剧本中的场景"{sceneName}"。

【剧本内容】
{content}

请提取以下信息，严格按JSON格式输出（确保所有字段都存在）：
{
  "name": "场景名",
  "locationType": "indoor/outdoor/unknown",
  "description": "场景描述",
  "timeOfDay": "时间段",
  "season": "季节",
  "weather": "天气",
  "environment": {
    "architecture": "建筑风格",
    "furnishings": ["陈设1"],
    "lighting": "光线条件",
    "colorTone": "色调氛围"
  },
  "sceneFunction": "场景在故事中的作用",
  "visualPrompt": "用于AI生图的详细视觉描述，100字以内",
  "characters": ["场景中出现的角色名"]
}

重要提示：
1. 如果信息不足，使用合理的默认值填充所有字段
2. 必须返回完整的JSON，不能省略任何字段
`,

  shots: `
请为以下场景生成分镜脚本。

【场景信息】
场景名称: {sceneName}
场景描述: {sceneDescription}
涉及角色: {characters}

【剧本原文】
{content}

请生成详细分镜，要求：
1. 每个镜头包含：序号、景别、运镜方式、画面描述、台词、音效、预估时长、涉及角色
2. 景别选项：extreme_long(极远景), long(远景), full(全景), medium(中景), close_up(近景), extreme_close_up(极近景)
3. 运镜选项：static(固定), push(推), pull(拉), pan(摇), tilt(升降), track(移), crane(升降)
4. 每个场景生成5-15个镜头

请严格按以下JSON数组格式输出：
[
  {
    "sequence": 1,
    "shotType": "full",
    "cameraMovement": "static",
    "description": "画面描述",
    "dialogue": "台词（可选）",
    "sound": "音效（可选）",
    "duration": 3,
    "characters": ["角色名"]
  }
]
`
};

export interface ParseProgressCallback {
  (stage: ParseStage, progress: number, message?: string): void;
}

/**
 * Concurrency limiter for controlling parallel API calls
 * Implements a simple semaphore pattern to limit concurrent executions
 *
 * @example
 * const limiter = new ConcurrencyLimiter(2);
 * const results = await Promise.all([
 *   limiter.run(() => fetchData1()),
 *   limiter.run(() => fetchData2()),
 *   limiter.run(() => fetchData3()), // Will wait until one slot is free
 * ]);
 */
class ConcurrencyLimiter {
  /** Maximum number of concurrent executions allowed */
  private concurrency: number;
  /** Current number of running executions */
  private running: number = 0;
  /** Queue of pending execution resolvers */
  private queue: Array<() => void> = [];

  /**
   * Creates a new concurrency limiter
   * @param concurrency - Maximum number of concurrent executions
   */
  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  /**
   * Execute a function with concurrency limiting
   * @param fn - Async function to execute
   * @returns Promise that resolves with the function's return value
   * @template T - Return type of the function
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }

    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next?.();
      }
    }
  }
}

/**
 * LRU (Least Recently Used) cache with TTL support
 * Used to cache parsed character and scene data to avoid redundant API calls
 *
 * Features:
 * - LRU eviction policy: removes least recently used items when capacity is reached
 * - TTL (Time To Live): automatically expires entries after specified duration
 * - Hash-based keys: converts content to hash for efficient storage
 *
 * @example
 * const cache = new ParseCache(50, 3600000); // 50 items, 1 hour TTL
 * cache.set(content, parsedData);
 * const data = cache.get(content); // Returns cached data or null
 */
class ParseCache {
  /** Internal cache storage using Map to maintain insertion order for LRU */
  private cache: Map<string, { result: any; timestamp: number }> = new Map();
  /** Maximum number of items to store */
  private maxSize: number;
  /** Time to live in milliseconds */
  private ttl: number;

  /**
   * Creates a new parse cache
   * @param maxSize - Maximum number of items to store (default: 100)
   * @param ttl - Time to live in milliseconds (default: 3600000 = 1 hour)
   */
  constructor(maxSize: number = 100, ttl: number = 3600000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Generates a hash for the given content
   * Uses DJB2 algorithm for fast hashing
   * @param content - Content to hash
   * @returns Hex string hash
   * @private
   */
  private hash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Retrieves a cached value
   * Updates access order for LRU tracking
   * Checks TTL and removes expired entries
   *
   * @param content - Original content used as cache key
   * @returns Cached result or null if not found or expired
   */
  get(content: string): any | null {
    const key = this.hash(content);
    const entry = this.cache.get(key);

    if (entry) {
      // Check TTL
      if (Date.now() - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        return null;
      }
      // Move to end (LRU) - mark as recently used
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.result;
    }
    return null;
  }

  /**
   * Stores a value in the cache
   * Evicts oldest item if capacity is reached
   *
   * @param content - Content to use as cache key
   * @param result - Result to cache
   */
  set(content: string, result: any): void {
    const key = this.hash(content);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, { result, timestamp: Date.now() });
  }

  /**
   * Clears all cached entries
   */
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Main script parser class
 * Provides comprehensive script/novel parsing capabilities using LLM models
 *
 * Parsing Pipeline:
 * 1. Metadata extraction - Extract basic info (title, characters, scenes count)
 * 2. Character analysis - Detailed analysis of each character
 * 3. Scene analysis - Detailed analysis of each scene
 * 4. Shot generation - Generate shot list for each scene
 *
 * Features:
 * - Concurrent processing with rate limiting
 * - Automatic retry with exponential backoff
 * - Progress tracking and cancellation
 * - Error recovery and resume support
 * - LRU caching for performance
 *
 * @example
 * const parser = createScriptParser('your-api-key');
 * const state = await parser.parseScript(
 *   scriptId,
 *   projectId,
 *   content,
 *   (stage, progress, message) => console.log(`${stage}: ${progress}% - ${message}`)
 * );
 */
export class ScriptParser {
  /** API key for LLM service */
  private apiKey: string;
  /** Base URL for LLM API */
  private apiUrl: string;
  /** Model name to use for parsing */
  private model: string;
  /** AbortController for cancellation support */
  private abortController: AbortController | null = null;
  /** Concurrency limiter for API calls */
  private limiter: ConcurrencyLimiter;
  /** Cache for parsed results */
  private cache: ParseCache;
  /** Hash of current content for cache key generation */
  private contentHash: string = '';

  /**
   * Creates a new script parser instance
   * @param apiKey - API key for LLM service
   * @param apiUrl - Base URL for LLM API (default: OpenAI)
   * @param model - Model name to use (default: gpt-4o-mini)
   */
  constructor(apiKey: string, apiUrl: string = 'https://api.openai.com/v1', model: string = CONFIG.defaultModel) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    this.model = model;
    this.limiter = new ConcurrencyLimiter(CONFIG.concurrency);
    this.cache = new ParseCache(50, 3600000); // Cache up to 50 items for 1 hour
  }

  /**
   * Cancels any ongoing parsing operation
   * Aborts the current API request if one is in progress
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Generates a hash for content caching
   * Uses DJB2 algorithm for consistent hashing
   * @param content - Content to hash
   * @returns Hex string hash
   * @private
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Splits long text into chunks while preserving paragraph integrity
   * Ensures paragraphs are not split across chunks
   *
   * @param text - Text to split
   * @param maxChunkSize - Maximum size of each chunk (default: 8000)
   * @returns Array of text chunks
   * @private
   */
  private chunkText(text: string, maxChunkSize: number = CONFIG.maxChunkSize): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split('\n\n');
    let currentChunk = '';

    for (const para of paragraphs) {
      if (currentChunk.length + para.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = para;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Makes API request to LLM with timeout and automatic retry
   * Implements exponential backoff for rate limiting and server errors
   *
   * Features:
   * - 60 second timeout
   * - Up to 3 retry attempts
   * - Exponential backoff (1s, 2s, 4s)
   * - Automatic retry on 429 (rate limit) and 5xx errors
   * - Cancellation support via AbortController
   *
   * @param prompt - Prompt to send to LLM
   * @param retryCount - Current retry attempt (used internally)
   * @returns LLM response text
   * @throws Error if API call fails after all retries
   * @private
   */
  private async callLLM(prompt: string, retryCount: number = 0): Promise<string> {
    console.log(`[ScriptParser] callLLM called, retryCount: ${retryCount}`);
    console.log(`[ScriptParser] API URL: ${this.apiUrl}`);
    console.log(`[ScriptParser] Model: ${this.model}`);

    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => this.abortController?.abort(), CONFIG.timeout);

    try {
      // Use LLMProvider instead of direct fetch to properly handle proxy
      const { llmProvider } = await import('./ai/providers/LLMProvider');

      const config = {
        id: 'temp',
        name: 'Temp',
        provider: 'llm',
        modelId: this.model,
        apiUrl: this.apiUrl,
        apiKey: this.apiKey,
        type: 'llm' as const,
        parameters: [],
        capabilities: {
          supportsImageInput: false,
          supportsVideoInput: false,
          supportsTextOutput: true,
          supportsImageOutput: false,
          supportsVideoOutput: false,
          maxTokens: 4000,
          maxInputTokens: 8000
        }
      };

      console.log('[ScriptParser] Calling LLMProvider.generateText...');
      const result = await llmProvider.generateText(
        prompt,
        config,
        '你是一个专业的剧本分析助手，擅长从小说/剧本中提取结构化信息。请严格按照要求的JSON格式输出。'
      );

      clearTimeout(timeoutId);

      if (!result.success) {
        const errorMsg = result.error || 'Unknown error';
        console.error(`[ScriptParser] LLMProvider error: ${errorMsg}`);

        // Retry on rate limit or server errors
        if (retryCount < CONFIG.maxRetries) {
          const delay = CONFIG.retryDelay * Math.pow(2, retryCount);
          console.warn(`API error, retrying in ${delay}ms... (attempt ${retryCount + 1}/${CONFIG.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.callLLM(prompt, retryCount + 1);
        }

        throw new Error(`LLM API Error: ${errorMsg}`);
      }

      console.log(`[ScriptParser] LLM response received, length: ${result.data?.length || 0}`);
      return result.data || '';
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error(`[ScriptParser] callLLM error: ${error.message}`, error);

      // Retry on network errors
      if (error.name === 'TypeError' || error.name === 'AbortError') {
        if (retryCount < CONFIG.maxRetries) {
          const delay = CONFIG.retryDelay * Math.pow(2, retryCount);
          console.warn(`Network error, retrying in ${delay}ms... (attempt ${retryCount + 1}/${CONFIG.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.callLLM(prompt, retryCount + 1);
        }
      }

      throw error;
    }
  }

  /**
   * Extracts and parses JSON from LLM response
   * Handles various formatting issues commonly found in LLM outputs:
   * - Markdown code blocks (```json ... ```)
   * - Trailing commas
   * - Single quotes instead of double quotes
   * - Unquoted object keys
   *
   * @param response - Raw LLM response text
   * @returns Parsed JSON object
   * @throws Error if JSON cannot be parsed
   * @template T - Expected return type
   * @private
   */
  private extractJSON<T>(response: string): T {
    // Try to extract JSON from markdown code blocks
    let jsonStr = response.trim();

    // Remove markdown code block markers
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    // Try to find complete JSON object or array using bracket matching
    const extracted = this.findCompleteJSON(jsonStr);
    if (extracted) {
      jsonStr = extracted;
    }

    // Try to parse directly first
    try {
      return JSON.parse(jsonStr) as T;
    } catch (e) {
      // If direct parse fails, try to fix common JSON errors
      console.log('[ScriptParser] Direct JSON parse failed, attempting to fix...');
    }

    // Fix common JSON errors
    jsonStr = jsonStr
      // Remove trailing commas
      .replace(/,\s*([}\]])/g, '$1')
      // Fix single quotes used as JSON key quotes (e.g., 'key': value)
      .replace(/'(\w+)'\s*:/g, '"$1":')
      // Fix unquoted keys (but not in string values)
      .replace(/(\w+):\s*("|'|\[|\{|\d|true|false|null)/g, '"$1":$2')
      // Fix Chinese quotes to regular quotes
      .replace(/[""]/g, '"')
      // Fix escaped Chinese quotes
      .replace(/\\[""]/g, '\\"');

    try {
      return JSON.parse(jsonStr) as T;
    } catch (e) {
      console.error('Failed to parse JSON:', jsonStr);
      console.error('Original response:', response);
      throw new Error('Invalid JSON response from LLM');
    }
  }

  /**
   * Find complete JSON object or array using bracket matching
   * This handles nested structures correctly
   * Returns the longer one when both are found (usually the complete structure)
   */
  private findCompleteJSON(str: string): string | null {
    // Try to find both object and array
    let objResult = this.findMatchingBrackets(str, '{', '}');
    let arrResult = this.findMatchingBrackets(str, '[', ']');

    // If both found, return the longer one (usually the complete structure)
    if (objResult && arrResult) {
      return objResult.length > arrResult.length ? objResult : arrResult;
    }

    // Return whichever is found
    if (objResult) return objResult;
    if (arrResult) return arrResult;

    return null;
  }

  /**
   * Find matching brackets using stack-based approach
   */
  private findMatchingBrackets(str: string, open: string, close: string): string | null {
    let count = 0;
    let start = -1;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      // Handle escape sequences
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      // Handle strings
      if (char === '"' && !inString) {
        inString = true;
        continue;
      }
      if (char === '"' && inString) {
        inString = false;
        continue;
      }

      // Skip everything inside strings
      if (inString) continue;

      // Count brackets
      if (char === open) {
        if (count === 0) start = i;
        count++;
      } else if (char === close) {
        count--;
        if (count === 0 && start !== -1) {
          return str.substring(start, i + 1);
        }
      }
    }

    return null;
  }

  /**
   * Validate and fill missing fields for character data
   */
  private validateCharacter(character: Partial<ScriptCharacter>, name: string): ScriptCharacter {
    return {
      name: character.name || name,
      gender: character.gender || 'unknown',
      age: character.age || '25',
      identity: character.identity || '未知身份',
      appearance: {
        height: character.appearance?.height || '中等身高',
        build: character.appearance?.build || '标准体型',
        face: character.appearance?.face || '面容端正',
        hair: character.appearance?.hair || '普通发型',
        clothing: character.appearance?.clothing || '日常服饰',
      },
      personality: character.personality?.length ? character.personality : ['性格温和'],
      signatureItems: character.signatureItems?.length ? character.signatureItems : [],
      emotionalArc: character.emotionalArc?.length ? character.emotionalArc : [{ phase: '初始', emotion: '平静' }],
      relationships: character.relationships?.length ? character.relationships : [],
      visualPrompt: character.visualPrompt || `${name}的角色形象`,
    };
  }

  /**
   * Validate and fill missing fields for scene data
   */
  private validateScene(scene: Partial<ScriptScene>, name: string): ScriptScene {
    return {
      name: scene.name || name,
      locationType: scene.locationType || 'unknown',
      description: scene.description || name,
      timeOfDay: scene.timeOfDay || '白天',
      season: scene.season || '春季',
      weather: scene.weather || '晴朗',
      environment: {
        architecture: scene.environment?.architecture || '普通建筑',
        furnishings: scene.environment?.furnishings?.length ? scene.environment.furnishings : ['基本陈设'],
        lighting: scene.environment?.lighting || '自然光',
        colorTone: scene.environment?.colorTone || '明亮',
      },
      sceneFunction: scene.sceneFunction || '推进剧情',
      visualPrompt: scene.visualPrompt || `${name}的场景画面`,
      characters: scene.characters?.length ? scene.characters : [],
    };
  }

  /**
   * Stage 1: Extract metadata
   */
  async extractMetadata(content: string): Promise<ScriptMetadata> {
    console.log('[ScriptParser] ========== Stage 1: Extract Metadata ==========');
    console.log(`[ScriptParser] Content length: ${content.length} characters`);

    const prompt = PROMPTS.metadata.replace('{content}', content.substring(0, 3000));
    console.log(`[ScriptParser] Prompt length: ${prompt.length} characters`);
    console.log('[ScriptParser] Sending request to LLM...');

    const response = await this.callLLM(prompt);
    console.log(`[ScriptParser] LLM response received, length: ${response.length} characters`);

    const metadata = this.extractJSON<ScriptMetadata>(response);
    console.log('[ScriptParser] Metadata extracted successfully:');
    console.log(`  - Title: ${metadata.title}`);
    console.log(`  - Word Count: ${metadata.wordCount}`);
    console.log(`  - Characters: ${metadata.characterCount} (${metadata.characterNames?.join(', ')})`);
    console.log(`  - Scenes: ${metadata.sceneCount} (${metadata.sceneNames?.join(', ')})`);
    console.log(`  - Genre: ${metadata.genre}`);
    console.log(`  - Tone: ${metadata.tone}`);

    return metadata;
  }

  /**
   * Stage 2: Extract character details (with caching)
   */
  async extractCharacter(content: string, characterName: string): Promise<ScriptCharacter> {
    console.log(`[ScriptParser] ---------- Extracting Character: ${characterName} ----------`);

    // Check cache first
    const cacheKey = `char:${characterName}:${this.hashContent(content.substring(0, 1000))}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`[ScriptParser] Cache hit for character: ${characterName}`);
      return cached as ScriptCharacter;
    }

    // Extract relevant paragraphs containing the character
    const paragraphs = content.split('\n\n');
    const relevantParagraphs = paragraphs.filter(p =>
      p.includes(characterName) ||
      p.includes(characterName.split('').join('.*?')) // Fuzzy match for Chinese names
    );
    console.log(`[ScriptParser] Found ${relevantParagraphs.length} paragraphs mentioning ${characterName}`);

    // If not enough content, use the whole text
    const characterContent = relevantParagraphs.length > 3
      ? relevantParagraphs.join('\n\n')
      : content;
    console.log(`[ScriptParser] Character content length: ${characterContent.length} characters`);

    const prompt = PROMPTS.character
      .replace('{content}', characterContent.substring(0, 5000))
      .replace('{characterName}', characterName);
    console.log(`[ScriptParser] Prompt length: ${prompt.length} characters`);

    const response = await this.callLLM(prompt);
    console.log(`[ScriptParser] LLM response received, length: ${response.length} characters`);

    const rawCharacter = this.extractJSON<Partial<ScriptCharacter>>(response);
    console.log(`[ScriptParser] Raw character data parsed`);

    // Validate and fill missing fields
    const character = this.validateCharacter(rawCharacter, characterName);
    console.log(`[ScriptParser] Character validated and completed:`);
    console.log(`  - Name: ${character.name}`);
    console.log(`  - Gender: ${character.gender}`);
    console.log(`  - Age: ${character.age}`);
    console.log(`  - Identity: ${character.identity}`);
    console.log(`  - Personality: ${character.personality?.join(', ')}`);
    console.log(`  - Visual Prompt: ${character.visualPrompt?.substring(0, 50)}...`);

    // Cache the result
    this.cache.set(cacheKey, character);

    return character;
  }

  /**
   * Stage 3: Extract scene details (with caching)
   */
  async extractScene(content: string, sceneName: string): Promise<ScriptScene> {
    console.log(`[ScriptParser] ---------- Extracting Scene: ${sceneName} ----------`);

    // Check cache first
    const cacheKey = `scene:${sceneName}:${this.hashContent(content.substring(0, 1000))}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`[ScriptParser] Cache hit for scene: ${sceneName}`);
      return cached as ScriptScene;
    }

    // Extract relevant paragraphs containing the scene
    const paragraphs = content.split('\n\n');
    const relevantParagraphs = paragraphs.filter(p =>
      p.includes(sceneName) ||
      p.toLowerCase().includes(sceneName.toLowerCase())
    );
    console.log(`[ScriptParser] Found ${relevantParagraphs.length} paragraphs mentioning ${sceneName}`);

    const sceneContent = relevantParagraphs.length > 2
      ? relevantParagraphs.join('\n\n')
      : content;
    console.log(`[ScriptParser] Scene content length: ${sceneContent.length} characters`);

    const prompt = PROMPTS.scene
      .replace('{content}', sceneContent.substring(0, 5000))
      .replace('{sceneName}', sceneName);
    console.log(`[ScriptParser] Prompt length: ${prompt.length} characters`);

    const response = await this.callLLM(prompt);
    console.log(`[ScriptParser] LLM response received, length: ${response.length} characters`);

    const rawScene = this.extractJSON<Partial<ScriptScene>>(response);
    console.log(`[ScriptParser] Raw scene data parsed`);

    // Validate and fill missing fields
    const scene = this.validateScene(rawScene, sceneName);
    console.log(`[ScriptParser] Scene validated and completed:`);
    console.log(`  - Name: ${scene.name}`);
    console.log(`  - Location Type: ${scene.locationType}`);
    console.log(`  - Time of Day: ${scene.timeOfDay}`);
    console.log(`  - Weather: ${scene.weather}`);
    console.log(`  - Characters: ${scene.characters?.join(', ')}`);
    console.log(`  - Visual Prompt: ${scene.visualPrompt?.substring(0, 50)}...`);

    // Cache the result
    this.cache.set(cacheKey, scene);
    return scene;
  }

  /**
   * Stage 4: Generate shots for a scene
   */
  async generateShots(
    content: string,
    sceneName: string,
    sceneDescription: string,
    characters: string[]
  ): Promise<Shot[]> {
    console.log(`[ScriptParser] ---------- Generating Shots for Scene: ${sceneName} ----------`);

    // Extract scene-specific content
    const paragraphs = content.split('\n\n');
    const sceneStartIndex = paragraphs.findIndex(p =>
      p.includes(sceneName) || p.toLowerCase().includes(sceneName.toLowerCase())
    );

    let sceneContent = content;
    if (sceneStartIndex >= 0) {
      // Take content from scene start to next scene or end
      const nextSceneIndex = paragraphs.slice(sceneStartIndex + 1).findIndex(p =>
        p.includes('场景') || p.includes('地点') || p.includes('第') && p.includes('章')
      );
      const endIndex = nextSceneIndex >= 0 ? sceneStartIndex + 1 + nextSceneIndex : paragraphs.length;
      sceneContent = paragraphs.slice(sceneStartIndex, endIndex).join('\n\n');
    }
    console.log(`[ScriptParser] Scene content length: ${sceneContent.length} characters`);

    const prompt = PROMPTS.shots
      .replace('{content}', sceneContent.substring(0, 6000))
      .replace('{sceneName}', sceneName)
      .replace('{sceneDescription}', sceneDescription)
      .replace('{characters}', characters.join(', '));
    console.log(`[ScriptParser] Prompt length: ${prompt.length} characters`);
    console.log(`[ScriptParser] Characters in scene: ${characters.join(', ')}`);

    const response = await this.callLLM(prompt);
    console.log(`[ScriptParser] LLM response received, length: ${response.length} characters`);

    const shots = this.extractJSON<Shot[]>(response);
    console.log(`[ScriptParser] Generated ${shots.length} shots`);

    // Log first few shots
    shots.slice(0, 3).forEach((shot, i) => {
      console.log(`[ScriptParser] Shot ${i + 1}:`);
      console.log(`  - Sequence: ${shot.sequence}`);
      console.log(`  - Type: ${shot.shotType}`);
      console.log(`  - Movement: ${shot.cameraMovement}`);
      console.log(`  - Duration: ${shot.duration}s`);
      console.log(`  - Description: ${shot.description?.substring(0, 40)}...`);
    });

    // Add IDs and scene name to shots
    return shots.map((shot, index) => ({
      ...shot,
      id: shot.id || crypto.randomUUID(),
      sceneName,
      sequence: shot.sequence || index + 1
    }));
  }

  /**
   * Batch extract all characters in one API call
   */
  async extractAllCharacters(content: string, characterNames: string[]): Promise<ScriptCharacter[]> {
    if (characterNames.length === 0) return [];
    if (characterNames.length === 1) {
      return [await this.extractCharacter(content, characterNames[0])];
    }

    console.log(`[ScriptParser] ---------- Batch Extracting ${characterNames.length} Characters ----------`);

    const prompt = PROMPTS.charactersBatch
      .replace('{content}', content.substring(0, 4000))
      .replace('{characterNames}', characterNames.join('\n'));

    console.log(`[ScriptParser] Batch prompt length: ${prompt.length} characters`);

    const response = await this.callLLM(prompt);
    console.log(`[ScriptParser] Batch response received, length: ${response.length} characters`);

    const characters = this.extractJSON<ScriptCharacter[]>(response);
    console.log(`[ScriptParser] Parsed ${characters.length} characters from batch response`);

    // Validate and ensure all characters have required fields
    return characters.map((char, index) => this.validateCharacter(char, characterNames[index] || char.name || `角色${index + 1}`));
  }

  /**
   * Batch extract all scenes in one API call
   */
  async extractAllScenes(content: string, sceneNames: string[]): Promise<ScriptScene[]> {
    if (sceneNames.length === 0) return [];
    if (sceneNames.length === 1) {
      return [await this.extractScene(content, sceneNames[0])];
    }

    console.log(`[ScriptParser] ---------- Batch Extracting ${sceneNames.length} Scenes ----------`);

    const prompt = PROMPTS.scenesBatch
      .replace('{content}', content.substring(0, 4000))
      .replace('{sceneNames}', sceneNames.join('\n'));

    console.log(`[ScriptParser] Batch prompt length: ${prompt.length} characters`);

    const response = await this.callLLM(prompt);
    console.log(`[ScriptParser] Batch response received, length: ${response.length} characters`);

    const scenes = this.extractJSON<ScriptScene[]>(response);
    console.log(`[ScriptParser] Parsed ${scenes.length} scenes from batch response`);

    // Validate and ensure all scenes have required fields
    return scenes.map((scene, index) => this.validateScene(scene, sceneNames[index] || scene.name || `场景${index + 1}`));
  }

  /**
   * Batch generate all shots in one API call
   */
  async generateAllShots(content: string, scenes: ScriptScene[]): Promise<Shot[]> {
    if (scenes.length === 0) return [];
    if (scenes.length === 1) {
      const shots = await this.generateShots(content, scenes[0].name, scenes[0].description, scenes[0].characters);
      return shots.map((shot, index) => ({
        ...shot,
        id: shot.id || crypto.randomUUID(),
        sceneName: scenes[0].name,
        sequence: shot.sequence || index + 1
      }));
    }

    console.log(`[ScriptParser] ---------- Batch Generating Shots for ${scenes.length} Scenes ----------`);

    const scenesInfo = scenes.map(s => `- ${s.name}: ${s.description?.substring(0, 50) || '无描述'}... (角色: ${s.characters?.join(', ') || '无'})`).join('\n');

    const prompt = PROMPTS.shotsBatch
      .replace('{content}', content.substring(0, 3000))
      .replace('{scenesInfo}', scenesInfo);

    console.log(`[ScriptParser] Batch prompt length: ${prompt.length} characters`);

    const response = await this.callLLM(prompt);
    console.log(`[ScriptParser] Batch response received, length: ${response.length} characters`);

    const shots = this.extractJSON<Shot[]>(response);
    console.log(`[ScriptParser] Parsed ${shots.length} shots from batch response`);

    // Ensure all shots have IDs and scene names
    return shots.map((shot, index) => ({
      ...shot,
      id: shot.id || crypto.randomUUID(),
      sequence: shot.sequence || index + 1
    }));
  }

  /**
   * Full parsing pipeline with progress tracking and error recovery
   */
  async parseScript(
    scriptId: string,
    projectId: string,
    content: string,
    onProgress?: ParseProgressCallback,
    resumeFromState?: ScriptParseState
  ): Promise<ScriptParseState> {
    // Try to resume from provided state or load from storage
    let state: ScriptParseState = resumeFromState || {
      stage: 'idle',
      progress: 0
    };

    // If no resume state provided, try to load from storage
    if (!resumeFromState) {
      try {
        const savedState = await this.loadState(scriptId, projectId);
        if (savedState && savedState.stage !== 'completed' && savedState.stage !== 'error') {
          console.log(`[ScriptParser] Resuming from saved state: ${savedState.stage}`);
          state = savedState;
          onProgress?.(state.stage, state.progress, `从 ${state.stage} 阶段恢复...`);
        }
      } catch (e) {
        console.warn('[ScriptParser] Failed to load saved state:', e);
      }
    }

    try {
      // Stage 1: Metadata (skip if already completed)
      if (!state.metadata) {
        state.stage = 'metadata';
        state.progress = 10;
        onProgress?.('metadata', 10, '正在提取元数据...');
        
        state.metadata = await this.extractMetadata(content);
        state.progress = 20;
        await this.saveState(scriptId, projectId, state);
      } else {
        console.log('[ScriptParser] Skipping metadata extraction (already exists)');
        onProgress?.('metadata', 20, '元数据已存在，跳过...');
      }

      // Stage 2: Characters (with concurrency control and resume support)
      state.stage = 'characters';
      state.progress = 25;
      onProgress?.('characters', 25, '正在分析角色...');

      // Resume from existing characters if available
      const existingCharacters = state.characters || [];
      const existingCharacterNames = new Set(existingCharacters.map(c => c.name));
      const characters: ScriptCharacter[] = [...existingCharacters];
      const characterNames = state.metadata.characterNames || [];

      // Filter out already processed characters
      const remainingCharacterNames = characterNames.filter(name => !existingCharacterNames.has(name));

      if (remainingCharacterNames.length > 0) {
        console.log(`[ScriptParser] Processing ${remainingCharacterNames.length} remaining characters`);

        // Process characters concurrently with limit
        const characterPromises = remainingCharacterNames.map((name, index) =>
          this.limiter.run(async () => {
            const overallIndex = existingCharacters.length + index;
            onProgress?.('characters', 25 + (overallIndex / characterNames.length) * 25, `正在分析角色: ${name}`);

            try {
              const character = await this.extractCharacter(content, name);
              characters.push(character);
            } catch (e) {
              console.error(`Failed to extract character ${name}:`, e);
              // Add placeholder character
              characters.push({
                name,
                appearance: {},
                personality: [],
                signatureItems: [],
                emotionalArc: [],
                relationships: [],
                visualPrompt: name
              });
            }

            state.characters = characters;
            state.progress = 25 + ((overallIndex + 1) / characterNames.length) * 25;
            await this.saveState(scriptId, projectId, state);
          })
        );

        await Promise.all(characterPromises);
      } else {
        console.log('[ScriptParser] All characters already processed, skipping...');
        onProgress?.('characters', 50, '角色已存在，跳过...');
      }

      // Stage 3: Scenes (with concurrency control and resume support)
      state.stage = 'scenes';
      state.progress = 50;
      onProgress?.('scenes', 50, '正在分析场景...');

      // Resume from existing scenes if available
      const existingScenes = state.scenes || [];
      const existingSceneNames = new Set(existingScenes.map(s => s.name));
      const scenes: ScriptScene[] = [...existingScenes];
      const sceneNames = state.metadata.sceneNames || [];

      // Filter out already processed scenes
      const remainingSceneNames = sceneNames.filter(name => !existingSceneNames.has(name));

      if (remainingSceneNames.length > 0) {
        console.log(`[ScriptParser] Processing ${remainingSceneNames.length} remaining scenes`);

        // Process scenes concurrently with limit
        const scenePromises = remainingSceneNames.map((name, index) =>
          this.limiter.run(async () => {
            const overallIndex = existingScenes.length + index;
            onProgress?.('scenes', 50 + (overallIndex / sceneNames.length) * 20, `正在分析场景: ${name}`);

            try {
              const scene = await this.extractScene(content, name);
              scenes.push(scene);
            } catch (e) {
              console.error(`Failed to extract scene ${name}:`, e);
              // Add placeholder scene
              scenes.push({
                name,
                locationType: 'unknown',
                description: name,
                environment: {},
                sceneFunction: '',
                visualPrompt: name,
                characters: []
              });
            }

            state.scenes = scenes;
            state.progress = 50 + ((overallIndex + 1) / sceneNames.length) * 20;
            await this.saveState(scriptId, projectId, state);
          })
        );

        await Promise.all(scenePromises);
      } else {
        console.log('[ScriptParser] All scenes already processed, skipping...');
        onProgress?.('scenes', 70, '场景已存在，跳过...');
      }

      // Stage 4: Shots (with concurrency control and resume support)
      state.stage = 'shots';
      state.progress = 70;
      onProgress?.('shots', 70, '正在生成分镜...');

      // Resume from existing shots if available
      const existingShots = state.shots || [];
      const existingSceneShots = new Map<string, Shot[]>();
      existingShots.forEach(shot => {
        if (!existingSceneShots.has(shot.sceneName)) {
          existingSceneShots.set(shot.sceneName, []);
        }
        existingSceneShots.get(shot.sceneName)!.push(shot);
      });

      const allShots: Shot[] = [...existingShots];

      // Filter out scenes that already have shots
      const remainingScenes = scenes.filter(scene => !existingSceneShots.has(scene.name));

      if (remainingScenes.length > 0) {
        console.log(`[ScriptParser] Processing shots for ${remainingScenes.length} remaining scenes`);

        // Process shots concurrently with limit
        const shotPromises = remainingScenes.map((scene, index) =>
          this.limiter.run(async () => {
            const overallIndex = scenes.length - remainingScenes.length + index;
            onProgress?.('shots', 70 + (overallIndex / scenes.length) * 25, `正在生成分镜: ${scene.name}`);

            // 重试机制：最多3次
            let retries = 3;
            let lastError: any;
            
            while (retries > 0) {
              try {
                const shots = await this.generateShots(
                  content,
                  scene.name,
                  scene.description,
                  scene.characters
                );
                allShots.push(...shots);
                break; // 成功，跳出重试循环
              } catch (e) {
                lastError = e;
                retries--;
                console.error(`[ScriptParser] Failed to generate shots for scene ${scene.name}, retries left: ${retries}`, e);
                if (retries > 0) {
                  // 等待1秒后重试
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
            }
            
            // 如果3次都失败了，记录错误但不中断整个流程
            if (retries === 0) {
              console.error(`[ScriptParser] All retries failed for scene ${scene.name}:`, lastError);
            }

            state.shots = allShots;
            state.progress = 70 + ((overallIndex + 1) / scenes.length) * 25;
            await this.saveState(scriptId, projectId, state);
          })
        );

        await Promise.all(shotPromises);
      } else {
        console.log('[ScriptParser] All shots already generated, skipping...');
        onProgress?.('shots', 95, '分镜已存在，跳过...');
      }

      // Complete
      state.stage = 'completed';
      state.progress = 100;
      onProgress?.('completed', 100, '解析完成！');
      await this.saveState(scriptId, projectId, state);

    } catch (error: any) {
      state.stage = 'error';
      state.error = error.message;
      onProgress?.('error', state.progress, `解析失败: ${error.message}`);
      await this.saveState(scriptId, projectId, state);
      throw error;
    }

    return state;
  }

  /**
   * Save parsing state to storage
   */
  private async saveState(scriptId: string, projectId: string, state: ScriptParseState): Promise<void> {
    await storageService.updateScriptParseState(scriptId, projectId, () => state);
  }

  /**
   * Load parsing state from storage
   */
  private async loadState(scriptId: string, projectId: string): Promise<ScriptParseState | null> {
    try {
      const script = await storageService.getScript(scriptId, projectId);
      if (script && script.parseState) {
        return script.parseState;
      }
    } catch (e) {
      console.warn('[ScriptParser] Failed to load state:', e);
    }
    return null;
  }

  /**
   * Parse only metadata (lightweight)
   */
  async parseMetadataOnly(content: string): Promise<ScriptMetadata> {
    return this.extractMetadata(content);
  }

  /**
   * Parse a specific stage only (for manual step-by-step parsing)
   * @param stage - The parsing stage to execute
   * @param content - Script content
   * @param currentState - Current parse state
   * @param onProgress - Progress callback
   * @returns Updated parse state
   */
  async parseStage(
    stage: 'metadata' | 'characters' | 'scenes' | 'shots',
    content: string,
    currentState: ScriptParseState,
    onProgress?: ParseProgressCallback
  ): Promise<ScriptParseState> {
    const state: ScriptParseState = { ...currentState };

    try {
      switch (stage) {
        case 'metadata': {
          state.stage = 'metadata';
          state.progress = 10;
          onProgress?.('metadata', 10, '正在提取元数据...');
          state.metadata = await this.extractMetadata(content);
          state.progress = 20;
          break;
        }

        case 'characters': {
          if (!state.metadata) {
            throw new Error('Metadata must be extracted before characters');
          }
          state.stage = 'characters';
          state.progress = 25;
          onProgress?.('characters', 25, '正在分析所有角色...');

          try {
            // Use batch extraction for all characters (1 API call instead of N)
            const characters = await this.extractAllCharacters(content, state.metadata.characterNames || []);
            state.characters = characters;
            console.log(`[ScriptParser] Batch extracted ${characters.length} characters in 1 API call`);
          } catch (e) {
            console.error('[ScriptParser] Batch character extraction failed, falling back to individual extraction:', e);
            // Fallback to individual extraction
            const characters: ScriptCharacter[] = [];
            const characterNames = state.metadata.characterNames || [];

            for (let i = 0; i < characterNames.length; i++) {
              const name = characterNames[i];
              onProgress?.('characters', 25 + (i / characterNames.length) * 25, `正在分析角色: ${name}`);

              try {
                const character = await this.extractCharacter(content, name);
                characters.push(character);
              } catch (e) {
                console.error(`Failed to extract character ${name}:`, e);
                characters.push({
                  name,
                  appearance: {},
                  personality: [],
                  signatureItems: [],
                  emotionalArc: [],
                  relationships: [],
                  visualPrompt: name
                });
              }

              if (i < characterNames.length - 1) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.callDelay));
              }
            }
            state.characters = characters;
          }

          state.progress = 50;
          break;
        }

        case 'scenes': {
          if (!state.metadata) {
            throw new Error('Metadata must be extracted before scenes');
          }
          state.stage = 'scenes';
          state.progress = 50;
          onProgress?.('scenes', 50, '正在分析所有场景...');

          try {
            // Use batch extraction for all scenes (1 API call instead of N)
            const scenes = await this.extractAllScenes(content, state.metadata.sceneNames || []);
            state.scenes = scenes;
            console.log(`[ScriptParser] Batch extracted ${scenes.length} scenes in 1 API call`);
          } catch (e) {
            console.error('[ScriptParser] Batch scene extraction failed, falling back to individual extraction:', e);
            // Fallback to individual extraction
            const scenes: ScriptScene[] = [];
            const sceneNames = state.metadata.sceneNames || [];

            for (let i = 0; i < sceneNames.length; i++) {
              const name = sceneNames[i];
              onProgress?.('scenes', 50 + (i / sceneNames.length) * 20, `正在分析场景: ${name}`);

              try {
                const scene = await this.extractScene(content, name);
                scenes.push(scene);
              } catch (e) {
                console.error(`Failed to extract scene ${name}:`, e);
                scenes.push({
                  name,
                  locationType: 'unknown',
                  description: name,
                  environment: {},
                  sceneFunction: '',
                  visualPrompt: name,
                  characters: []
                });
              }

              if (i < sceneNames.length - 1) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.callDelay));
              }
            }
            state.scenes = scenes;
          }

          state.progress = 70;
          break;
        }

        case 'shots': {
          if (!state.scenes || state.scenes.length === 0) {
            throw new Error('Scenes must be extracted before shots');
          }
          state.stage = 'shots';
          state.progress = 70;
          onProgress?.('shots', 70, '正在生成所有分镜...');

          try {
            // Use batch generation for all shots (1 API call instead of N)
            const allShots = await this.generateAllShots(content, state.scenes);
            state.shots = allShots;
            console.log(`[ScriptParser] Batch generated ${allShots.length} shots in 1 API call`);
          } catch (e) {
            console.error('[ScriptParser] Batch shots generation failed, falling back to individual generation:', e);
            // Fallback to individual generation
            const allShots: Shot[] = [];

            for (let i = 0; i < state.scenes.length; i++) {
              const scene = state.scenes[i];
              onProgress?.('shots', 70 + (i / state.scenes.length) * 25, `正在生成分镜: ${scene.name}`);

              try {
                const shots = await this.generateShots(
                  content,
                  scene.name,
                  scene.description,
                  scene.characters
                );
                allShots.push(...shots);
              } catch (e) {
                console.error(`Failed to generate shots for scene ${scene.name}:`, e);
              }

              if (i < state.scenes.length - 1) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.callDelay));
              }
            }
            state.shots = allShots;
          }

          state.progress = 95;

          // Mark as completed after shots generation
          state.stage = 'completed';
          state.progress = 100;
          onProgress?.('completed', 100, '解析完成');
          break;
        }
      }

      return state;
    } catch (error: any) {
      state.stage = 'error';
      state.error = error.message;
      throw error;
    }
  }
}

// Export singleton instance creator
export function createScriptParser(apiKey: string, apiUrl?: string, model?: string): ScriptParser {
  return new ScriptParser(apiKey, apiUrl, model);
}

// Export helper classes for testing
export { ConcurrencyLimiter, ParseCache };
