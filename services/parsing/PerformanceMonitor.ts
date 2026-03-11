/**
 * Performance Monitor
 *
 * 剧本解析性能监控服务 - 记录和分析解析性能指标
 *
 * @module services/parsing/PerformanceMonitor
 * @version 1.0.0
 */

export interface StageTiming {
  stage: string;
  startTime: number;
  endTime: number;
  duration: number; // milliseconds
  apiCalls: number;
  tokensUsed?: number;
  responseTimes?: number[]; // Array of API response times for percentile calculation
}

export interface PerformanceReport {
  totalDuration: number;
  stageTimings: StageTiming[];
  apiCallCount: number;
  totalTokensUsed?: number;
  averageTokenPerCall?: number;
  throughput: number; // words per second
  bottlenecks: string[];
  recommendations: string[];
  // Phase 3.4: Advanced statistics
  percentiles?: {
    p50: number; // Median response time
    p95: number; // 95th percentile
    p99: number; // 99th percentile
  };
  tokenEfficiency?: {
    totalTokens: number;
    estimatedSavedTokens: number;
    savedPercentage: number;
  };
}

export interface PerformanceSnapshot {
  timestamp: number;
  currentStage: string;
  progress: number;
  elapsedTime: number;
  estimatedRemainingTime: number;
}

export class PerformanceMonitor {
  private stageTimings: Map<string, StageTiming> = new Map();
  private currentStage: string | null = null;
  private stageStartTime: number = 0;
  private totalApiCalls: number = 0;
  private totalTokensUsed: number = 0;
  private startTime: number = 0;
  private wordCount: number = 0;
  private snapshots: PerformanceSnapshot[] = [];
  private allResponseTimes: number[] = []; // Collect all response times for percentile calculation
  private estimatedBaseTokens: number = 0; // Estimated tokens without optimization

  /**
   * Start monitoring a new parsing session
   */
  startSession(wordCount: number): void {
    this.startTime = Date.now();
    this.wordCount = wordCount;
    this.stageTimings.clear();
    this.totalApiCalls = 0;
    this.totalTokensUsed = 0;
    this.snapshots = [];
    this.currentStage = null;
    console.log(`[PerformanceMonitor] Session started: ${wordCount} words`);
  }

  /**
   * Start timing a stage
   */
  startStage(stage: string): void {
    // End current stage if exists
    if (this.currentStage) {
      this.endStage();
    }

    this.currentStage = stage;
    this.stageStartTime = Date.now();
    console.log(`[PerformanceMonitor] Stage started: ${stage}`);
  }

  /**
   * End timing current stage
   */
  endStage(): void {
    if (!this.currentStage) return;

    const endTime = Date.now();
    const duration = endTime - this.stageStartTime;

    const timing: StageTiming = {
      stage: this.currentStage,
      startTime: this.stageStartTime,
      endTime,
      duration,
      apiCalls: 0, // Will be updated separately
    };

    this.stageTimings.set(this.currentStage, timing);
    console.log(`[PerformanceMonitor] Stage ended: ${this.currentStage} (${duration}ms)`);
    this.currentStage = null;
  }

  /**
   * Record API call
   */
  recordApiCall(tokensUsed?: number): void {
    this.totalApiCalls++;
    if (tokensUsed) {
      this.totalTokensUsed += tokensUsed;
    }

    // Update current stage API count
    if (this.currentStage) {
      const timing = this.stageTimings.get(this.currentStage);
      if (timing) {
        timing.apiCalls++;
        if (tokensUsed) {
          timing.tokensUsed = (timing.tokensUsed || 0) + tokensUsed;
        }
      }
    }
  }

  /**
   * Record API response time for percentile statistics
   * @param responseTimeMs - Response time in milliseconds
   */
  recordResponseTime(responseTimeMs: number): void {
    if (responseTimeMs <= 0) return;

    this.allResponseTimes.push(responseTimeMs);

    // Also update current stage
    if (this.currentStage) {
      const timing = this.stageTimings.get(this.currentStage);
      if (timing) {
        if (!timing.responseTimes) {
          timing.responseTimes = [];
        }
        timing.responseTimes.push(responseTimeMs);
      }
    }

    console.log(`[PerformanceMonitor] Response time recorded: ${responseTimeMs}ms`);
  }

  /**
   * Set estimated base tokens (without optimization) for token efficiency calculation
   * @param tokens - Estimated base tokens
   */
  setEstimatedBaseTokens(tokens: number): void {
    this.estimatedBaseTokens = tokens;
    console.log(`[PerformanceMonitor] Estimated base tokens set: ${tokens}`);
  }

  /**
   * Take a performance snapshot
   */
  takeSnapshot(currentStage: string, progress: number): PerformanceSnapshot {
    const elapsedTime = Date.now() - this.startTime;
    const estimatedTotalTime = progress > 0 ? (elapsedTime / progress) * 100 : 0;
    const estimatedRemainingTime = Math.max(0, estimatedTotalTime - elapsedTime);

    const snapshot: PerformanceSnapshot = {
      timestamp: Date.now(),
      currentStage,
      progress,
      elapsedTime,
      estimatedRemainingTime,
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;

    // End current stage if still running
    if (this.currentStage) {
      this.endStage();
    }

    const stageTimings = Array.from(this.stageTimings.values());

    // Calculate throughput
    const throughput = totalDuration > 0 ? this.wordCount / (totalDuration / 1000) : 0;

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(stageTimings, totalDuration);

    // Generate recommendations
    const recommendations = this.generateRecommendations(stageTimings, bottlenecks);

    // Phase 3.4: Calculate advanced statistics
    const percentiles = this.calculatePercentiles();
    const tokenEfficiency = this.calculateTokenEfficiency();

    const report: PerformanceReport = {
      totalDuration,
      stageTimings,
      apiCallCount: this.totalApiCalls,
      totalTokensUsed: this.totalTokensUsed > 0 ? this.totalTokensUsed : undefined,
      averageTokenPerCall:
        this.totalApiCalls > 0 ? Math.round(this.totalTokensUsed / this.totalApiCalls) : undefined,
      throughput: Math.round(throughput * 10) / 10,
      bottlenecks,
      recommendations,
      percentiles: percentiles.p50 > 0 ? percentiles : undefined,
      tokenEfficiency: tokenEfficiency.savedPercentage > 0 ? tokenEfficiency : undefined,
    };

    this.logReport(report);
    return report;
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(stageTimings: StageTiming[], totalDuration: number): string[] {
    const bottlenecks: string[] = [];

    if (totalDuration === 0) return bottlenecks;

    // Find stages that take >30% of total time
    for (const timing of stageTimings) {
      const percentage = (timing.duration / totalDuration) * 100;
      if (percentage > 30) {
        bottlenecks.push(`${timing.stage} (${percentage.toFixed(1)}% - ${timing.duration}ms)`);
      }
    }

    // Find stages with low API efficiency
    for (const timing of stageTimings) {
      if (timing.apiCalls > 0) {
        const timePerCall = timing.duration / timing.apiCalls;
        if (timePerCall > 30000) {
          // >30s per call
          bottlenecks.push(`${timing.stage} - slow API calls (${timePerCall.toFixed(0)}ms/call)`);
        }
      }
    }

    return bottlenecks;
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(stageTimings: StageTiming[], bottlenecks: string[]): string[] {
    const recommendations: string[] = [];

    // Check for parallelization opportunities
    const hasSequentialStages = stageTimings.some(
      t => t.stage === 'characters' || t.stage === 'scenes'
    );
    if (hasSequentialStages) {
      recommendations.push('角色和场景提取可以并行执行以减少总时间');
    }

    // Check for batch size optimization
    const shotsStage = stageTimings.find(t => t.stage === 'shots');
    if (shotsStage && shotsStage.apiCalls > 5) {
      recommendations.push('分镜生成API调用次数较多，建议增加批次大小');
    }

    // Check for token efficiency
    const totalTokens = stageTimings.reduce((sum, t) => sum + (t.tokensUsed || 0), 0);
    if (totalTokens > 10000) {
      recommendations.push('Token使用量较高，考虑优化Prompt长度');
    }

    // Add specific recommendations based on bottlenecks
    if (bottlenecks.some(b => b.includes('metadata'))) {
      recommendations.push('元数据提取较慢，考虑使用更快的模型或缓存');
    }

    if (bottlenecks.some(b => b.includes('shots'))) {
      recommendations.push('分镜生成是主要瓶颈，考虑使用批量生成或降低质量要求');
    }

    return recommendations;
  }

  /**
   * Log performance report
   */
  private logReport(report: PerformanceReport): void {
    console.log('[PerformanceMonitor] ========== Performance Report ==========');
    console.log(
      `[PerformanceMonitor] Total duration: ${report.totalDuration}ms (${(report.totalDuration / 1000).toFixed(1)}s)`
    );
    console.log(`[PerformanceMonitor] API calls: ${report.apiCallCount}`);
    console.log(`[PerformanceMonitor] Throughput: ${report.throughput} words/s`);

    if (report.totalTokensUsed) {
      console.log(`[PerformanceMonitor] Total tokens: ${report.totalTokensUsed}`);
      console.log(`[PerformanceMonitor] Avg tokens/call: ${report.averageTokenPerCall}`);
    }

    // Phase 3.4: Display advanced statistics
    if (report.percentiles) {
      console.log('[PerformanceMonitor] Response time percentiles:');
      console.log(
        `[PerformanceMonitor]   P50 (median): ${report.percentiles.p50}ms (${(report.percentiles.p50 / 1000).toFixed(1)}s)`
      );
      console.log(
        `[PerformanceMonitor]   P95: ${report.percentiles.p95}ms (${(report.percentiles.p95 / 1000).toFixed(1)}s)`
      );
      console.log(
        `[PerformanceMonitor]   P99: ${report.percentiles.p99}ms (${(report.percentiles.p99 / 1000).toFixed(1)}s)`
      );
    }

    if (report.tokenEfficiency) {
      console.log('[PerformanceMonitor] Token efficiency:');
      console.log(
        `[PerformanceMonitor]   Total tokens used: ${report.tokenEfficiency.totalTokens}`
      );
      console.log(
        `[PerformanceMonitor]   Estimated tokens saved: ${report.tokenEfficiency.estimatedSavedTokens}`
      );
      console.log(
        `[PerformanceMonitor]   Saved percentage: ${report.tokenEfficiency.savedPercentage}%`
      );
    }

    console.log('[PerformanceMonitor] Stage breakdown:');
    for (const timing of report.stageTimings) {
      const percentage = ((timing.duration / report.totalDuration) * 100).toFixed(1);
      console.log(
        `[PerformanceMonitor]   - ${timing.stage}: ${timing.duration}ms (${percentage}%) - ${timing.apiCalls} API calls`
      );
      if (timing.responseTimes && timing.responseTimes.length > 0) {
        const avgResponseTime = Math.round(
          timing.responseTimes.reduce((a, b) => a + b, 0) / timing.responseTimes.length
        );
        console.log(`[PerformanceMonitor]     Avg response time: ${avgResponseTime}ms`);
      }
    }

    if (report.bottlenecks.length > 0) {
      console.log('[PerformanceMonitor] Bottlenecks:');
      for (const bottleneck of report.bottlenecks) {
        console.log(`[PerformanceMonitor]   ⚠️ ${bottleneck}`);
      }
    }

    if (report.recommendations.length > 0) {
      console.log('[PerformanceMonitor] Recommendations:');
      for (const rec of report.recommendations) {
        console.log(`[PerformanceMonitor]   💡 ${rec}`);
      }
    }

    console.log('[PerformanceMonitor] ==========================================');
  }

  /**
   * Get current session statistics
   */
  getCurrentStats(): {
    elapsedTime: number;
    currentStage: string | null;
    apiCalls: number;
    progress: number;
  } {
    return {
      elapsedTime: this.startTime > 0 ? Date.now() - this.startTime : 0,
      currentStage: this.currentStage,
      apiCalls: this.totalApiCalls,
      progress: this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1].progress : 0,
    };
  }

  /**
   * Reset monitor
   */
  reset(): void {
    this.stageTimings.clear();
    this.currentStage = null;
    this.totalApiCalls = 0;
    this.totalTokensUsed = 0;
    this.startTime = 0;
    this.wordCount = 0;
    this.snapshots = [];
    this.allResponseTimes = [];
    this.estimatedBaseTokens = 0;
  }

  /**
   * Calculate percentile from sorted array
   * @param sortedArray - Sorted array of numbers
   * @param percentile - Percentile to calculate (0-100)
   * @returns Percentile value
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Calculate response time percentiles (P50, P95, P99)
   * @returns Percentile statistics
   */
  calculatePercentiles(): { p50: number; p95: number; p99: number } {
    if (this.allResponseTimes.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.allResponseTimes].sort((a, b) => a - b);

    return {
      p50: this.calculatePercentile(sorted, 50),
      p95: this.calculatePercentile(sorted, 95),
      p99: this.calculatePercentile(sorted, 99),
    };
  }

  /**
   * Calculate token efficiency
   * @returns Token efficiency statistics
   */
  calculateTokenEfficiency(): {
    totalTokens: number;
    estimatedSavedTokens: number;
    savedPercentage: number;
  } {
    const totalTokens = this.totalTokensUsed;
    const estimatedSaved = Math.max(0, this.estimatedBaseTokens - totalTokens);
    const savedPercentage =
      this.estimatedBaseTokens > 0 ? (estimatedSaved / this.estimatedBaseTokens) * 100 : 0;

    return {
      totalTokens,
      estimatedSavedTokens: estimatedSaved,
      savedPercentage: Math.round(savedPercentage * 10) / 10,
    };
  }
}

export default PerformanceMonitor;
