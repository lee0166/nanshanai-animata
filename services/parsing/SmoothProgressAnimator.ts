/**
 * SmoothProgressAnimator - 平滑进度动画器
 *
 * 在API等待期间提供平滑的进度增长动画，消除进度停滞感
 *
 * @module services/parsing/SmoothProgressAnimator
 * @version 1.0.0
 */

export interface SmoothProgressAnimatorConfig {
  /** 更新间隔 (毫秒) */
  updateInterval: number;
  /** 缓动函数类型 */
  easingType: 'linear' | 'easeOut' | 'easeInOut' | 'easeOutCubic';
  /** 最小进度增量 */
  minDelta: number;
  /** 最大进度增量 */
  maxDelta: number;
}

export const DEFAULT_ANIMATOR_CONFIG: SmoothProgressAnimatorConfig = {
  updateInterval: 100, // 100ms = 10fps（平衡流畅度和性能）
  easingType: 'easeOutCubic',
  minDelta: 0.2,
  maxDelta: 5,
};

/**
 * 平滑进度动画器类
 */
export class SmoothProgressAnimator {
  private config: SmoothProgressAnimatorConfig;
  private currentProgress: number = 0;
  private targetProgress: number = 0;
  private startProgress: number = 0;
  private startTime: number = 0;
  private expectedDuration: number = 0;
  private animationId: number | null = null;
  private lastUpdateTime: number = 0;
  private onProgressCallback: ((progress: number) => void) | null = null;
  private isRunning: boolean = false;

  constructor(config: Partial<SmoothProgressAnimatorConfig> = {}) {
    this.config = { ...DEFAULT_ANIMATOR_CONFIG, ...config };
  }

  /**
   * 开始一个平滑进度动画
   * @param startProgress 起始进度 (0-100)
   * @param targetProgress 目标进度 (0-100)
   * @param expectedDuration 预期持续时间 (毫秒)
   * @param onProgress 进度回调
   */
  start(
    startProgress: number,
    targetProgress: number,
    expectedDuration: number,
    onProgress: (progress: number) => void
  ): void {
    // 停止之前的动画
    this.stop();

    this.startProgress = Math.max(0, Math.min(100, startProgress));
    this.targetProgress = Math.max(0, Math.min(100, targetProgress));
    this.expectedDuration = Math.max(100, expectedDuration); // 最少100ms
    this.onProgressCallback = onProgress;
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
    this.currentProgress = this.startProgress;
    this.isRunning = true;

    // 立即触发一次回调
    this.notifyProgress();

    // 开始动画循环
    this.animate();
  }

  /**
   * 更新目标进度（用于动态调整）
   * @param newTargetProgress 新的目标进度
   * @param newExpectedDuration 新的预期持续时间（可选）
   */
  updateTarget(newTargetProgress: number, newExpectedDuration?: number): void {
    if (!this.isRunning) return;

    this.targetProgress = Math.max(0, Math.min(100, newTargetProgress));

    if (newExpectedDuration !== undefined) {
      // 重新计算起始点和时间
      this.startProgress = this.currentProgress;
      this.startTime = Date.now();
      this.expectedDuration = Math.max(100, newExpectedDuration);
    }
  }

  /**
   * 完成动画并跳转到目标进度
   */
  complete(): void {
    if (!this.isRunning) return;

    this.stop();
    this.currentProgress = this.targetProgress;
    this.notifyProgress();
  }

  /**
   * 停止动画
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * 获取当前进度
   */
  getCurrentProgress(): number {
    return this.currentProgress;
  }

  /**
   * 检查是否正在运行
   */
  isAnimating(): boolean {
    return this.isRunning;
  }

  /**
   * 动画循环
   */
  private animate = (): void => {
    if (!this.isRunning) return;

    const now = Date.now();
    const elapsed = now - this.startTime;

    // 检查是否达到预期时间
    if (elapsed >= this.expectedDuration) {
      this.complete();
      return;
    }

    // 计算进度比例
    const ratio = elapsed / this.expectedDuration;

    // 应用缓动函数
    const easedRatio = this.applyEasing(ratio);

    // 计算当前进度
    const newProgress =
      this.startProgress + (this.targetProgress - this.startProgress) * easedRatio;

    // 检查最小变化阈值
    if (Math.abs(newProgress - this.currentProgress) >= this.config.minDelta) {
      this.currentProgress = newProgress;
      this.notifyProgress();
    }

    // 继续动画
    this.animationId = requestAnimationFrame(this.animate);
  };

  /**
   * 应用缓动函数
   */
  private applyEasing(t: number): number {
    switch (this.config.easingType) {
      case 'linear':
        return t;
      case 'easeOut':
        return 1 - Math.pow(1 - t, 2);
      case 'easeInOut':
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      case 'easeOutCubic':
        return 1 - Math.pow(1 - t, 3);
      default:
        return t;
    }
  }

  /**
   * 通知进度更新
   */
  private notifyProgress(): void {
    if (this.onProgressCallback) {
      this.onProgressCallback(this.currentProgress);
    }
  }
}

/**
 * 创建默认动画器实例的工厂函数
 */
export function createSmoothProgressAnimator(
  config?: Partial<SmoothProgressAnimatorConfig>
): SmoothProgressAnimator {
  return new SmoothProgressAnimator(config);
}
