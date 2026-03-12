import React from 'react';
import { PerformanceReport as PerformanceReportType } from '../../services/parsing/PerformanceMonitor';

interface PerformanceReportCardProps {
  report: PerformanceReportType;
}

const PerformanceReportCard: React.FC<PerformanceReportCardProps> = ({ report }) => {
  const {
    totalDuration,
    apiCallCount,
    throughput,
    totalTokensUsed,
    tokenEfficiency,
    percentiles,
    stageTimings,
    bottlenecks,
    recommendations,
  } = report;

  // 格式化函数
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {/* 总体统计 */}
      <section>
        <h3 className="text-lg font-semibold text-foreground mb-3">📈 总体统计</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-primary/10 p-4 rounded-lg">
            <div className="text-sm text-default-500 mb-1">总耗时</div>
            <div className="text-2xl font-bold text-primary">{formatDuration(totalDuration)}</div>
          </div>

          <div className="bg-success/10 p-4 rounded-lg">
            <div className="text-sm text-default-500 mb-1">API 调用</div>
            <div className="text-2xl font-bold text-success">{apiCallCount} 次</div>
          </div>

          <div className="bg-secondary/10 p-4 rounded-lg">
            <div className="text-sm text-default-500 mb-1">吞吐量</div>
            <div className="text-2xl font-bold text-secondary">{throughput.toFixed(1)} 词/s</div>
          </div>

          {totalTokensUsed && (
            <div className="bg-warning/10 p-4 rounded-lg">
              <div className="text-sm text-default-500 mb-1">Token 使用</div>
              <div className="text-2xl font-bold text-warning">{formatNumber(totalTokensUsed)}</div>
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
  );
};

export default PerformanceReportCard;
