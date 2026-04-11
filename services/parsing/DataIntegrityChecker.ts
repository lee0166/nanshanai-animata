/**
 * DataIntegrityChecker - 数据完整性校验工具
 *
 * 提供数据校验和计算与验证功能，确保存储数据的完整性
 *
 * @module services/parsing/DataIntegrityChecker
 * @version 1.0.0
 */

/**
 * 校验和结果
 */
export interface ChecksumResult {
  /** 校验和值 */
  checksum: string;
  /** 算法类型 */
  algorithm: 'crc32' | 'simple-hash';
  /** 数据大小（字节） */
  dataSize: number;
  /** 计算时间戳 */
  timestamp: number;
}

/**
 * 数据完整性校验器
 *
 * 使用场景：
 * 1. 保存解析状态时计算校验和
 * 2. 加载解析状态时验证完整性
 * 3. 检测数据是否损坏或被篡改
 *
 * @example
 * ```typescript
 * const checker = new DataIntegrityChecker();
 *
 * // 保存时计算校验和
 * const checksum = checker.calculateChecksum(state);
 * state.checksum = checksum;
 * await storage.save('parse-state:123', state);
 *
 * // 加载时验证
 * const state = await storage.load('parse-state:123');
 * const valid = checker.verifyDataIntegrity(state);
 * if (!valid) {
 *   throw new Error('数据损坏，请重新解析');
 * }
 * ```
 */
export class DataIntegrityChecker {
  /**
   * 计算数据的校验和
   *
   * @param data - 任意类型的数据
   * @returns 校验和结果
   */
  calculateChecksum(data: any): ChecksumResult {
    const json = JSON.stringify(data);
    const checksum = this.crc32(json);

    return {
      checksum,
      algorithm: 'crc32',
      dataSize: new Blob([json]).size,
      timestamp: Date.now(),
    };
  }

  /**
   * 验证数据完整性
   *
   * @param data - 包含 checksum 字段的数据对象
   * @returns 是否通过验证
   */
  verifyDataIntegrity(data: any & { checksum?: string }): boolean {
    if (!data || !data.checksum) {
      console.warn('[DataIntegrityChecker] 数据缺少 checksum 字段');
      return false;
    }

    // 保存原始 checksum
    const originalChecksum = data.checksum;

    // 临时移除 checksum 字段，避免影响计算
    const { checksum, ...dataWithoutChecksum } = data;

    // 重新计算 checksum
    const calculatedResult = this.calculateChecksum(dataWithoutChecksum);

    // 比较 checksum
    return calculatedResult.checksum === originalChecksum;
  }

  /**
   * 快速校验和数据（不包含元数据）
   *
   * @param data - 任意类型的数据
   * @returns 校验和字符串
   */
  quickChecksum(data: any): string {
    const json = JSON.stringify(data);
    return this.crc32(json);
  }

  /**
   * CRC32 算法实现
   *
   * 基于标准 CRC32 多项式：0xEDB88320
   * 参考：ISO 3309, ITU-T V.42, Gzip, PNG
   *
   * @param str - 输入字符串
   * @returns CRC32 校验和（16 进制字符串）
   */
  private crc32(str: string): string {
    const table = this.getCRC32Table();
    let hash = 0xffffffff;

    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      hash = (hash >>> 8) ^ table[(hash ^ charCode) & 0xff];
    }

    hash = (hash ^ 0xffffffff) >>> 0;
    return hash.toString(16).padStart(8, '0');
  }

  /**
   * 获取 CRC32 查找表
   *
   * 使用缓存避免重复计算
   *
   * @returns CRC32 查找表（256 个元素）
   */
  private getCRC32Table(): Uint32Array {
    // 使用静态缓存
    if (!(this as any).crc32Table) {
      const table = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
          c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c;
      }
      (this as any).crc32Table = table;
    }
    return (this as any).crc32Table;
  }

  /**
   * 简单的哈希算法（备选方案）
   *
   * 当 CRC32 性能不足时可使用此简化版本
   *
   * @param str - 输入字符串
   * @returns 哈希值（10 进制字符串）
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

/**
 * 全局单例
 */
export const dataIntegrityChecker = new DataIntegrityChecker();
