/**
 * VectorMemoryConfig - 向量记忆配置管理
 * 管理ChromaDB的启用状态和用户提示
 * 
 * @version 1.0.0
 * @description 
 * 开发阶段：本地免费使用，可开关控制
 * 生产阶段：可升级为高级付费功能
 */

export interface VectorMemoryConfig {
  // 功能开关
  enabled: boolean;
  
  // 自动检测阈值（字数）
  autoEnableThreshold: number;
  
  // 是否自动检测并提示
  autoDetect: boolean;
  
  // ChromaDB连接配置
  chromaDbUrl: string;
  
  // 集合名称
  collectionName: string;
  
  // 是否显示详细日志
  verbose: boolean;
}

// 默认配置
export const DEFAULT_VECTOR_MEMORY_CONFIG: VectorMemoryConfig = {
  enabled: false,  // 默认关闭，用户手动开启
  autoEnableThreshold: 50000,  // 5万字自动提示
  autoDetect: true,  // 自动检测小说长度
  chromaDbUrl: 'http://localhost:8000',
  collectionName: 'script_memory',
  verbose: false
};

// 用户提示信息
export const VECTOR_MEMORY_MESSAGES = {
  // 功能介绍
  featureDescription: `智能记忆功能使用本地AI模型分析小说，帮助保持长篇小说中角色和场景的一致性。`,
  
  // 自动检测提示
  autoDetectPrompt: (wordCount: number) => 
    `检测到长篇小说（约${Math.round(wordCount / 10000)}万字），建议启用智能记忆功能以提升角色一致性。`,
  
  // 开启提示
  enabledNotice: '✅ 智能记忆已启用，正在建立小说知识图谱...',
  
  // 关闭提示
  disabledNotice: 'ℹ️ 智能记忆未启用，使用标准解析模式',
  
  // 首次使用提示
  firstTimeNotice: `💡 首次使用需要下载AI模型（约80MB），请耐心等待...`,
  
  // 服务器未启动提示
  serverNotRunning: `⚠️ 智能记忆服务未启动

请执行以下命令启动：
npx chroma run --path ./data/chroma_db

或选择"普通解析模式"继续`,
  
  // 生产环境付费提示（预留）
  productionUpgrade: `🚀 智能记忆是高级功能

免费版限制：
- 每月100次解析
- 最大支持10万字

升级专业版解锁：
- 无限次解析
- 支持200万字长篇小说
- 优先服务器资源

[了解更多]`,
};

export class VectorMemoryConfigManager {
  private config: VectorMemoryConfig;
  private storageKey = 'vectorMemoryConfig';
  
  constructor() {
    this.config = this.loadConfig();
  }
  
  /**
   * 加载配置（从localStorage或默认值）
   */
  private loadConfig(): VectorMemoryConfig {
    if (typeof window === 'undefined') {
      return { ...DEFAULT_VECTOR_MEMORY_CONFIG };
    }
    
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        return { ...DEFAULT_VECTOR_MEMORY_CONFIG, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('[VectorMemoryConfig] Failed to load config:', error);
    }
    
    return { ...DEFAULT_VECTOR_MEMORY_CONFIG };
  }
  
  /**
   * 保存配置
   */
  saveConfig(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.config));
    } catch (error) {
      console.warn('[VectorMemoryConfig] Failed to save config:', error);
    }
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): VectorMemoryConfig {
    return { ...this.config };
  }
  
  /**
   * 更新配置
   */
  updateConfig(updates: Partial<VectorMemoryConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }
  
  /**
   * 设置启用状态
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.saveConfig();
  }
  
  /**
   * 检查是否应该启用（自动检测）
   */
  shouldEnable(wordCount: number): boolean {
    if (!this.config.autoDetect) return this.config.enabled;
    
    // 如果用户手动开启，总是启用
    if (this.config.enabled) return true;
    
    // 自动检测：超过阈值建议启用
    return wordCount >= this.config.autoEnableThreshold;
  }
  
  /**
   * 获取用户提示
   */
  getUserPrompt(wordCount: number, isFirstTime: boolean = false): {
    show: boolean;
    title: string;
    message: string;
    actions: Array<{
      label: string;
      action: 'enable' | 'disable' | 'cancel';
      primary?: boolean;
    }>;
  } | null {
    // 短文本，不需要提示
    if (wordCount < this.config.autoEnableThreshold) {
      return null;
    }
    
    // 已经启用，不需要提示
    if (this.config.enabled) {
      return {
        show: true,
        title: '智能记忆',
        message: VECTOR_MEMORY_MESSAGES.enabledNotice,
        actions: [
          { label: '知道了', action: 'cancel', primary: true }
        ]
      };
    }
    
    // 首次使用提示
    const firstTimeMsg = isFirstTime ? '\n\n' + VECTOR_MEMORY_MESSAGES.firstTimeNotice : '';
    
    return {
      show: true,
      title: '检测到长篇小说',
      message: VECTOR_MEMORY_MESSAGES.autoDetectPrompt(wordCount) + 
               '\n\n' + VECTOR_MEMORY_MESSAGES.featureDescription + 
               firstTimeMsg,
      actions: [
        { label: '启用智能记忆', action: 'enable', primary: true },
        { label: '普通解析', action: 'disable' },
        { label: '取消', action: 'cancel' }
      ]
    };
  }
  
  /**
   * 检查ChromaDB服务器是否运行
   */
  async checkServerStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.chromaDbUrl}/api/v1/heartbeat`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  /**
   * 获取服务器未启动提示
   */
  getServerNotRunningPrompt(): {
    show: boolean;
    title: string;
    message: string;
    actions: Array<{
      label: string;
      action: 'retry' | 'normal' | 'cancel';
      primary?: boolean;
    }>;
  } {
    return {
      show: true,
      title: '智能记忆服务未启动',
      message: VECTOR_MEMORY_MESSAGES.serverNotRunning,
      actions: [
        { label: '重试', action: 'retry' },
        { label: '普通解析', action: 'normal', primary: true },
        { label: '取消', action: 'cancel' }
      ]
    };
  }
  
  /**
   * 重置配置
   */
  resetConfig(): void {
    this.config = { ...DEFAULT_VECTOR_MEMORY_CONFIG };
    this.saveConfig();
  }
}

// 单例实例
export const vectorMemoryConfig = new VectorMemoryConfigManager();
