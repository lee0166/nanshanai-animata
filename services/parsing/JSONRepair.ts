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
        repairAttempts
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
          repairAttempts
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
          repairAttempts
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
          repairAttempts
        };
      } catch (e) {
        // 失败
      }
    }

    // 所有策略都失败
    return {
      success: false,
      error: `Failed to parse JSON after ${repairAttempts.length} repair attempts. Last attempt: ${aggressivelyFixed.substring(0, 200)}...`,
      repairAttempts
    };
  }

  /**
   * 修复常见JSON错误
   */
  private static fixCommonErrors(str: string): string {
    return str
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
      .replace(/:\s*function\s*\([^)]*\)\s*\{[^}]*\}/g, ':null');
  }

  /**
   * 激进修复策略
   */
  private static fixAggressively(str: string): string {
    return str
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
      });
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
  private static findMatchingBrackets(
    str: string, 
    open: string, 
    close: string
  ): string | null {
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
      missingFields
    };
  }
}
