/**
 * Type Safe Utilities
 *
 * 类型安全的工具函数，用于处理 LLM 返回的不确定类型数据
 *
 * @module utils/typeSafe
 * @version 1.0.0
 */

/**
 * 安全地获取字符串值
 * @param value - 任意值
 * @param defaultValue - 默认值
 * @returns 字符串值
 */
export function safeString(value: unknown, defaultValue: string = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return defaultValue;
  }
  // 处理数组（取第一个元素）
  if (Array.isArray(value) && value.length > 0) {
    return safeString(value[0], defaultValue);
  }
  // 处理对象（尝试获取 name 或 value 属性）
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj.value === 'string') return obj.value;
    if (typeof obj.style === 'string') return obj.style;
  }
  // 其他类型转为字符串
  const str = String(value);
  return str === '[object Object]' ? defaultValue : str;
}

/**
 * 安全地将值转为小写
 * @param value - 任意值
 * @param defaultValue - 默认值
 * @returns 小写字符串
 */
export function safeLowerCase(value: unknown, defaultValue: string = ''): string {
  const str = safeString(value, defaultValue);
  return str.toLowerCase();
}

/**
 * 安全地获取数组
 * @param value - 任意值
 * @param defaultValue - 默认值
 * @returns 数组
 */
export function safeArray<T>(value: unknown, defaultValue: T[] = []): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value === null || value === undefined) {
    return defaultValue;
  }
  // 如果是单个值，包装成数组
  return [value as T];
}

/**
 * 安全地获取数字
 * @param value - 任意值
 * @param defaultValue - 默认值
 * @param min - 最小值限制
 * @param max - 最大值限制
 * @returns 数字
 */
export function safeNumber(
  value: unknown,
  defaultValue: number = 0,
  min?: number,
  max?: number
): number {
  let num: number;

  if (typeof value === 'number' && !isNaN(value)) {
    num = value;
  } else if (typeof value === 'string') {
    const parsed = parseFloat(value);
    num = isNaN(parsed) ? defaultValue : parsed;
  } else {
    num = defaultValue;
  }

  // 应用范围限制
  if (min !== undefined) {
    num = Math.max(min, num);
  }
  if (max !== undefined) {
    num = Math.min(max, num);
  }

  return num;
}

/**
 * 安全地获取布尔值
 * @param value - 任意值
 * @param defaultValue - 默认值
 * @returns 布尔值
 */
export function safeBoolean(value: unknown, defaultValue: boolean = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return defaultValue;
}

/**
 * 安全地访问对象属性
 * @param obj - 对象
 * @param key - 属性名
 * @param defaultValue - 默认值
 * @returns 属性值
 */
export function safeGet<T>(
  obj: Record<string, unknown> | null | undefined,
  key: string,
  defaultValue: T
): T {
  if (obj === null || obj === undefined) {
    return defaultValue;
  }
  const value = obj[key];
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return value as T;
}

/**
 * 验证值是否为有效的非空字符串
 * @param value - 任意值
 * @returns 是否为有效字符串
 */
export function isValidString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 验证值是否为有效的正数
 * @param value - 任意值
 * @returns 是否为有效正数
 */
export function isValidPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && value > 0;
}

/**
 * 验证值是否为有效的非空数组
 * @param value - 任意值
 * @returns 是否为有效数组
 */
export function isValidArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}
