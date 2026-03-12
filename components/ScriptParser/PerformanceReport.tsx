/**
 * PerformanceReport - 性能报告组件
 *
 * 显示剧本解析的完整性能报告，包括：
 * - 总耗时和各阶段耗时
 * - Token 使用效率
 * - API 调用统计
 * - 响应时间百分位
 * - 性能瓶颈分析
 * - 优化建议
 */

import React from 'react';

interface StageTiming {
  stage: string;
  duration: number;
  apiCalls: number;
  tokensUsed?: number;
}

interface Percentiles {
  p50: number;
  p95: number;
  p99: number;
}

interface TokenEfficiency {
  totalTokens: number;
  estimatedSavedTokens: number;
  savedPercentage: number;
}

interface PerformanceReportData {
  totalDuration: number;
  stageTimings: StageTiming[];
  apiCallCount: number;
  totalTokensUsed?: number;
  averageTokenPerCall?: number;
  throughput: number;
  bottlenecks: string[];
  recommendations: string[];
  percentiles?: Percentiles;
  tokenEfficiency?: TokenEfficiency;
}

interface PerformanceReportProps {
  report: PerformanceReportData;
  onClose?: () => void;
}

/**
 * 格式化时间为可读字符串
 */
const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(1);
  return `${minutes}分${remainingSeconds}秒`;
};

/**
 * 格式化数字带千分位
 */
const formatNumber = (num: number): string => {
  return num.toLocaleString('zh-CN');
};

/**
 * 性能报告组件
 */
export const PerformanceReport: React.FC<PerformanceReportProps> = ({ report, onClose }) => {
  const {
    totalDuration,
    stageTimings,
    apiCallCount,
    totalTokensUsed,
    averageTokenPerCall,
    throughput,
    bottlenecks,
    recommendations,
    percentiles,
    tokenEfficiency,
  } = report;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-content1 dark:bg-content2 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="sticky top-0 bg-content1 dark:bg-content2 border-b border-content3 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-foreground">📊 性能分析报告</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-default-400 hover:text-default-600 transition-colors"
              aria-label="关闭"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-6">
          {/* 总体统计 */}
          <section>
            <h3 className="text-lg font-semibold text-foreground mb-3">📈 总体统计</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-primary/10 p-4 rounded-lg">
                <div className="text-sm text-default-500 mb-1">总耗时</div>
                <div className="text-2xl font-bold text-primary">
                  {formatDuration(totalDuration)}
                </div>
              </div>

              <div className="bg-success/10 p-4 rounded-lg">
                <div className="text-sm text-default-500 mb-1">API 调用</div>
                <div className="text-2xl font-bold text-success">{apiCallCount} 次</div>
              </div>

              <div className="bg-secondary/10 p-4 rounded-lg">
                <div className="text-sm text-default-500 mb-1">吞吐量</div>
                <div className="text-2xl font-bold text-secondary">
                  {throughput.toFixed(1)} 词/s
                </div>
              </div>

              {totalTokensUsed && (
                <div className="bg-warning/10 p-4 rounded-lg">
                  <div className="text-sm text-default-500 mb-1">Token 使用</div>
                  <div className="text-2xl font-bold text-warning">
                    {formatNumber(totalTokensUsed)}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Token 效率 */}
          {tokenEfficiency && (
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-3">💰 Token 使用效率</h3>
              <div className="bg-gradient-to-r from-success/10 to-emerald-500/10 p-6 rounded-lg">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-default-500 mb-1">实际使用</div>
                    <div className="text-xl font-bold text-foreground">
                      {formatNumber(tokenEfficiency.totalTokens)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-default-500 mb-1">预估节省</div>
                    <div className="text-xl font-bold text-success">
                      {formatNumber(tokenEfficiency.estimatedSavedTokens)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-default-500 mb-1">节省比例</div>
                    <div className="text-xl font-bold text-success">
                      {tokenEfficiency.savedPercentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 响应时间百分位 */}
          {percentiles && (
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-3">⏱️ 响应时间分布</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-primary/10 p-4 rounded-lg text-center">
                  <div className="text-sm text-default-500 mb-2">P50 (中位数)</div>
                  <div className="text-2xl font-bold text-primary">
                    {formatDuration(percentiles.p50)}
                  </div>
                  <div className="text-xs text-default-400 mt-1">50% 请求快于此时间</div>
                </div>
                <div className="bg-warning/10 p-4 rounded-lg text-center">
                  <div className="text-sm text-default-500 mb-2">P95</div>
                  <div className="text-2xl font-bold text-warning">
                    {formatDuration(percentiles.p95)}
                  </div>
                  <div className="text-xs text-default-400 mt-1">95% 请求快于此时间</div>
                </div>
                <div className="bg-danger/10 p-4 rounded-lg text-center">
                  <div className="text-sm text-default-500 mb-2">P99</div>
                  <div className="text-2xl font-bold text-danger">
                    {formatDuration(percentiles.p99)}
                  </div>
                  <div className="text-xs text-default-400 mt-1">99% 请求快于此时间</div>
                </div>
              </div>
            </section>
          )}

          {/* 阶段耗时分解 */}
          <section>
            <h3 className="text-lg font-semibold text-foreground mb-3">📋 阶段耗时分解</h3>
            <div className="space-y-3">
              {stageTimings.map((stage, index) => {
                const percentage = ((stage.duration / totalDuration) * 100).toFixed(1);
                return (
                  <div key={index} className="bg-content2 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-medium text-foreground">{stage.stage}</div>
                      <div className="text-sm text-default-500">{percentage}%</div>
                    </div>
                    <div className="w-full bg-content3 rounded-full h-3 mb-2">
                      <div
                        className="bg-primary h-3 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm text-default-500">
                      <div>{formatDuration(stage.duration)}</div>
                      <div>{stage.apiCalls} 次 API 调用</div>
                      {stage.tokensUsed && <div>{formatNumber(stage.tokensUsed)} tokens</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 性能瓶颈 */}
          {bottlenecks.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-3">⚠️ 性能瓶颈</h3>
              <div className="bg-warning/10 border-l-4 border-warning p-4 rounded">
                <ul className="space-y-2">
                  {bottlenecks.map((bottleneck, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-warning mr-2">⚠️</span>
                      <span className="text-default-700">{bottleneck}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* 优化建议 */}
          {recommendations.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-3">💡 优化建议</h3>
              <div className="bg-success/10 border-l-4 border-success p-4 rounded">
                <ul className="space-y-2">
                  {recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-success mr-2">💡</span>
                      <span className="text-default-700">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="sticky bottom-0 bg-content1 dark:bg-content2 border-t border-content3 px-6 py-4 flex justify-end">
          {onClose && (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 transition-colors"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceReport;
