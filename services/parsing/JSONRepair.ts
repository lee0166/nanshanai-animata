/**
 * JSON Repair Utility
 *
 * 自动修复LLM返回的各种JSON格式错误
 * 基于文档《融合方案_实施细节与代码示例》第4.4节
 *
 * @module services/parsing/JSONRepair
 * @version 1.0.0
 */

export interface JSONRepairResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  repairAttempts: string[];
}

export class JSONRepair {
  /**
   * 尝试多种策略修复并解析JSON
   * 按照文档要求的多级修复策略
   */
  static repairAndParse<T>(response: string): JSONRepairResult<T> {
    const repairAttempts: string[] = [];
    let jsonStr = response.trim();

    // 策略1: 提取代码块中的JSON
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
      repairAttempts.push('extracted_from_code_block');
    }

    // 策略2: 使用括号匹配找到完整的JSON
    const extracted = this.findCompleteJSON(jsonStr);
    if (extracted && extracted !== jsonStr) {
      jsonStr = extracted;
      repairAttempts.push('bracket_matching');
    }

    // 尝试直接解析
    try {
      return {
        success: true,
        data: JSON.parse(jsonStr) as T,
        repairAttempts,
      };
    } catch (e) {
      // 继续尝试修复
    }

    // 策略3: 修复常见JSON错误
    const fixed = this.fixCommonErrors(jsonStr);
    if (fixed !== jsonStr) {
      repairAttempts.push('fixed_common_errors');
      try {
        return {
          success: true,
          data: JSON.parse(fixed) as T,
          repairAttempts,
        };
      } catch (e) {
        // 继续尝试
      }
    }

    // 策略4: 激进修复（处理更复杂的错误）
    const aggressivelyFixed = this.fixAggressively(fixed);
    if (aggressivelyFixed !== fixed) {
      repairAttempts.push('aggressive_fix');
      try {
        return {
          success: true,
          data: JSON.parse(aggressivelyFixed) as T,
          repairAttempts,
        };
      } catch (e) {
        // 继续尝试
      }
    }

    // 策略5: 尝试提取部分有效的JSON
    const partial = this.extractPartialJSON(aggressivelyFixed);
    if (partial) {
      repairAttempts.push('partial_extraction');
      try {
        return {
          success: true,
          data: JSON.parse(partial) as T,
          repairAttempts,
        };
      } catch (e) {
        // 失败
      }
    }

    // 所有策略都失败
    return {
      success: false,
      error: `Failed to parse JSON after ${repairAttempts.length} repair attempts. Last attempt: ${aggressivelyFixed.substring(0, 200)}...`,
      repairAttempts,
    };
  }

  /**
   * 修复常见JSON错误
   */
  private static fixCommonErrors(str: string): string {
    return (
      str
        // 移除尾随逗号
        .replace(/,\s*([}\]])/g, '$1')
        // 修复单引号作为键引号 (例如 'name': value)
        .replace(/'([^']+)'\s*:/g, '"$1":')
        // 修复单引号作为字符串值 (例如: 'value')
        .replace(/:\s*'([^']*)'/g, ': "$1"')
        // 修复未加引号的键（但不在字符串值中）
        .replace(/(\w+):\s*("|'|\[|\{|\d|true|false|null)/g, '"$1":$2')
        // 修复中文引号
        .replace(/[""]/g, '"')
        // 修复转义的中文引号
        .replace(/\\[""]/g, '\\"')
        // 修复多余的逗号
        .replace(/,+/g, ',')
        // 修复缺少的逗号（在某些简单情况下）
        .replace(/}\s*{/g, '},{')
        .replace(/]\s*\[/g, '],[')
        // 修复undefined值
        .replace(/:\s*undefined\s*([,}])/g, ':null$1')
        // 修复函数值
        .replace(/:\s*function\s*\([^)]*\)\s*\{[^}]*\}/g, ':null')
    );
  }

  /**
   * 激进修复策略
   */
  private static fixAggressively(str: string): string {
    return (
      str
        // 移除所有非JSON内容（在JSON结构外的内容）
        .replace(/^[^{\[]+/, '')
        .replace(/[^}\]]+$/, '')
        // 修复嵌套引号问题
        .replace(/"([^"]*)"([^"]*)"([^"]*)"/g, (match, p1, p2, p3) => {
          // 如果中间部分包含冒号，可能是键值对，保留结构
          if (p2.includes(':')) {
            return `"${p1}"${p2.replace(/"/g, '\\"')}"${p3}"`;
          }
          return match;
        })
        // 修复Unicode转义序列
        .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
          try {
            return String.fromCharCode(parseInt(hex, 16));
          } catch {
            return match;
          }
        })
    );
  }

  /**
   * 提取部分有效的JSON
   * 当完整解析失败时，尝试提取有效的部分
   */
  private static extractPartialJSON(str: string): string | null {
    // 尝试找到最大的有效JSON对象
    for (let i = str.length; i > 0; i--) {
      const substring = str.substring(0, i);
      try {
        JSON.parse(substring);
        return substring;
      } catch {
        continue;
      }
    }
    return null;
  }

  /**
   * 使用括号匹配找到完整的JSON对象或数组
   */
  private static findCompleteJSON(str: string): string | null {
    const objResult = this.findMatchingBrackets(str, '{', '}');
    const arrResult = this.findMatchingBrackets(str, '[', ']');

    if (objResult && arrResult) {
      return objResult.length > arrResult.length ? objResult : arrResult;
    }

    return objResult || arrResult || null;
  }

  /**
   * 使用栈匹配括号
   */
  private static findMatchingBrackets(str: string, open: string, close: string): string | null {
    let count = 0;
    let start = -1;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !inString) {
        inString = true;
        continue;
      }
      if (char === '"' && inString) {
        inString = false;
        continue;
      }

      if (inString) continue;

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
   * 验证JSON结构是否符合预期
   */
  static validateStructure<T>(
    data: any,
    requiredFields: (keyof T)[]
  ): { valid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (!(field in data)) {
        missingFields.push(String(field));
      }
    }

    return {
      valid: missingFields.length === 0,
      missingFields,
    };
  }

  /**
   * Schema-aware字段类型修复
   * 根据Schema定义自动转换字段类型
   *
   * @param data 原始数据对象
   * @param fieldTypes 字段类型映射
   * @returns 修复后的数据对象
   */
  static repairBySchema(
    data: Record<string, unknown>,
    fieldTypes: Record<string, 'array' | 'object' | 'string' | 'number' | 'boolean'>
  ): Record<string, unknown> {
    const repaired: Record<string, unknown> = { ...data };
    const conversions: string[] = [];

    for (const [field, expectedType] of Object.entries(fieldTypes)) {
      if (!(field in repaired)) continue;

      const value = repaired[field];
      const actualType = Array.isArray(value) ? 'array' : typeof value;

      if (actualType === expectedType) continue;

      // 执行类型转换
      switch (expectedType) {
        case 'array':
          if (typeof value === 'string') {
            repaired[field] = value
              .split(/[,，;；]/)
              .map(s => s.trim())
              .filter(Boolean);
            conversions.push(`${field}: string→array`);
          } else if (value === null || value === undefined) {
            repaired[field] = [];
            conversions.push(`${field}: null→array`);
          }
          break;

        case 'object':
          if (typeof value === 'string') {
            // 尝试解析为JSON，失败则包装为description对象
            try {
              const parsed = JSON.parse(value);
              repaired[field] = parsed;
              conversions.push(`${field}: string→object(JSON)`);
            } catch {
              repaired[field] = { description: value, content: value };
              conversions.push(`${field}: string→object(wrapped)`);
            }
          } else if (value === null || value === undefined) {
            repaired[field] = {};
            conversions.push(`${field}: null→object`);
          }
          break;

        case 'string':
          if (value !== null && value !== undefined) {
            repaired[field] = String(value);
            conversions.push(`${field}: ${actualType}→string`);
          }
          break;

        case 'number':
          if (typeof value === 'string') {
            const num = parseFloat(value);
            if (!isNaN(num)) {
              repaired[field] = num;
              conversions.push(`${field}: string→number`);
            }
          }
          break;

        case 'boolean':
          if (typeof value === 'string') {
            const lower = value.toLowerCase();
            if (lower === 'true' || lower === 'yes' || lower === '1') {
              repaired[field] = true;
              conversions.push(`${field}: string→boolean(true)`);
            } else if (lower === 'false' || lower === 'no' || lower === '0') {
              repaired[field] = false;
              conversions.push(`${field}: string→boolean(false)`);
            }
          }
          break;
      }
    }

    if (conversions.length > 0) {
      console.log('[JSONRepair] Schema-aware conversions:', conversions.join(', '));
    }

    return repaired;
  }

  /**
   * 预定义的ScriptMetadata字段类型映射
   * 用于修复常见的LLM输出格式问题
   */
  static readonly SCRIPT_METADATA_FIELD_TYPES: Record<
    string,
    'array' | 'object' | 'string' | 'number' | 'boolean'
  > = {
    // 基础字段
    title: 'string',
    wordCount: 'number',
    estimatedDuration: 'string',
    characterCount: 'number',
    characterNames: 'array',
    sceneCount: 'number',
    sceneNames: 'array',
    chapterCount: 'number',
    genre: 'string',
    tone: 'string',

    // 扩展字段（这些是常见的格式问题字段）
    theme: 'array',
    storyStructure: 'object',
    visualStyle: 'object',
    eraContext: 'object',
    emotionalArc: 'array',
    consistencyRules: 'object',
    references: 'object',
  };

  /**
   * 规范化JSON结构
   * 处理各种模型返回的格式变体，统一转换为标准对象格式
   *
   * 支持的转换：
   * 1. Array → Object: 如果是数组，取第一个元素
   * 2. Wrapper unwrap: 解包 {data: {...}}, {result: {...}} 等包装器格式
   * 3. Nested array flatten: 处理嵌套数组 [[{...}]] → {...}
   *
   * @param data 原始解析后的数据
   * @returns 规范化后的数据对象
   */
  static normalizeStructure(data: unknown): unknown {
    // 如果为null或undefined，返回空对象
    if (data === null || data === undefined) {
      console.warn('[JSONRepair] Input is null/undefined, returning empty object');
      return {};
    }

    let normalized = data;
    const transformations: string[] = [];

    // 转换1: 处理嵌套数组（如 [[{...}]] → {...}）
    while (Array.isArray(normalized) && normalized.length === 1 && Array.isArray(normalized[0])) {
      normalized = normalized[0];
      transformations.push('flatten_nested_array');
    }

    // 转换2: 数组 → 对象（取第一个元素）
    if (Array.isArray(normalized)) {
      if (normalized.length === 0) {
        console.warn('[JSONRepair] Empty array, returning empty object');
        return {};
      }
      if (normalized.length === 1) {
        normalized = normalized[0];
        transformations.push('array_to_object(1 element)');
      } else {
        // 多个元素的情况：尝试合并为一个对象
        const merged: Record<string, unknown> = {};
        let hasValidObject = false;
        for (const item of normalized) {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            Object.assign(merged, item);
            hasValidObject = true;
          }
        }
        if (hasValidObject) {
          normalized = merged;
          const mergedKeysCount = Object.keys(merged).length;
          transformations.push(`array_to_object(merged ${mergedKeysCount} fields)`);
        } else {
          // 无法合并，取第一个元素
          normalized = normalized[0];
          transformations.push('array_to_object(first element)');
        }
      }
    }

    // 转换3: 解包包装器格式
    if (normalized && typeof normalized === 'object') {
      const obj = normalized as Record<string, unknown>;
      const wrapperKeys = ['data', 'result', 'response', 'output', 'content', 'metadata'];

      for (const key of wrapperKeys) {
        if (key in obj && Object.keys(obj).length === 1) {
          const wrappedValue = obj[key];
          // 确保包装的内容是对象
          if (wrappedValue && typeof wrappedValue === 'object') {
            normalized = wrappedValue;
            transformations.push(`unwrap_${key}`);
            break;
          }
        }
      }
    }

    // 转换4: 处理字符串类型的JSON（双重编码）
    if (typeof normalized === 'string') {
      try {
        const parsed = JSON.parse(normalized);
        if (parsed && typeof parsed === 'object') {
          normalized = parsed;
          transformations.push('parse_json_string');
        }
      } catch {
        // 不是JSON字符串，保持原样
      }
    }

    if (transformations.length > 0) {
      console.log('[JSONRepair] Structure normalizations:', transformations.join(' → '));
    }

    return normalized;
  }

  /**
   * 完整的JSON修复流程
   * 结合语法修复、结构规范化和字段级修复
   *
   * @param response 原始响应字符串
   * @param fieldTypes 字段类型映射（可选）
   * @returns 修复结果
   */
  static async comprehensiveRepair<T>(
    response: string,
    fieldTypes?: Record<string, 'array' | 'object' | 'string' | 'number' | 'boolean'>
  ): Promise<JSONRepairResult<T>> {
    const repairAttempts: string[] = [];

    // 步骤1: 语法级修复
    const syntaxResult = this.repairAndParse<T>(response);
    if (!syntaxResult.success || !syntaxResult.data) {
      return {
        success: false,
        error: `Syntax repair failed: ${syntaxResult.error}`,
        repairAttempts: syntaxResult.repairAttempts,
      };
    }
    repairAttempts.push(...syntaxResult.repairAttempts);

    // 步骤2: 结构规范化
    let data = syntaxResult.data as unknown;
    data = this.normalizeStructure(data);
    repairAttempts.push('normalize_structure');

    // 步骤3: 字段级修复（如果提供了fieldTypes）
    if (fieldTypes && data && typeof data === 'object' && !Array.isArray(data)) {
      data = this.repairBySchema(data as Record<string, unknown>, fieldTypes);
      repairAttempts.push('repair_by_schema');
    }

    return {
      success: true,
      data: data as T,
      repairAttempts,
    };
  }
}
