import React, { useState, useMemo } from 'react';
import { Card, CardBody, Chip, Accordion, AccordionItem, Button, Tabs, Tab } from '@heroui/react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Target,
  Film,
  Eye,
  Palette,
  TrendingUp,
  BarChart3,
  Clock,
  Users,
  Map,
  Box,
  Lightbulb,
  ChevronDown,
  Zap,
} from 'lucide-react';
import { CoherenceReport, QualityScore, QualityStatistics, FixSuggestion } from '../../types';

interface CoherenceReportViewerProps {
  report: CoherenceReport;
  t: any;
}

/**
 * 获取评分颜色
 * 标准：≥90 优秀(绿)，≥75 良好(蓝)，≥60 及格(黄)，<60 不及格(红)
 */
const getScoreColor = (score: number): string => {
  if (score >= 90) return 'text-success';
  if (score >= 75) return 'text-primary';
  if (score >= 60) return 'text-warning';
  return 'text-danger';
};

/**
 * 获取等级 (A-F)
 */
const getGrade = (score: number): string => {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
};

/**
 * 获取等级颜色
 */
const getGradeColor = (grade: string): string => {
  const colors: Record<string, string> = {
    A: 'bg-success text-success-foreground',
    B: 'bg-primary text-primary-foreground',
    C: 'bg-warning text-warning-foreground',
    D: 'bg-warning-500 text-warning-foreground',
    F: 'bg-danger text-danger-foreground',
  };
  return colors[grade] || 'bg-default text-default-foreground';
};

/**
 * 获取维度中文名称
 */
const getDimensionName = (key: keyof Omit<QualityScore, 'overall'>): string => {
  const names: Record<string, string> = {
    plotCoherence: '剧情连贯',
    shotCoherence: '镜头连贯',
    visualQuality: '视觉质量',
    narrativePacing: '叙事节奏',
  };
  return names[key] || key;
};

/**
 * 获取维度图标
 */
const getDimensionIcon = (key: keyof Omit<QualityScore, 'overall'>) => {
  const icons: Record<string, any> = {
    plotCoherence: <Target className="w-4 h-4" />,
    shotCoherence: <Film className="w-4 h-4" />,
    visualQuality: <Palette className="w-4 h-4" />,
    narrativePacing: <TrendingUp className="w-4 h-4" />,
  };
  return icons[key] || <Info className="w-4 h-4" />;
};

/**
 * 格式化时长显示
 */
const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}分${secs}秒`;
};

/**
 * 圆形进度条组件
 */
const CircularProgress: React.FC<{
  score: number;
  size?: number;
  strokeWidth?: number;
}> = ({ score, size = 120, strokeWidth = 12 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
          stroke="currentColor"
          className="text-content3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
          stroke="currentColor"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={getScoreColor(score)}
          style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <div className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</div>
        <div className="text-xs text-default-400">分</div>
      </div>
    </div>
  );
};

/**
 * 雷达图组件 - 5个维度
 */
const RadarChart: React.FC<{
  qualityScore: QualityScore;
}> = ({ qualityScore }) => {
  const dimensionKeys = [
    'plotCoherence',
    'shotCoherence',
    'visualQuality',
    'narrativePacing',
  ] as const;
  const dimensions = dimensionKeys.map(key => ({
    key,
    name: getDimensionName(key),
    score: qualityScore[key],
  }));

  const numSides = 4;
  const center = 100;
  const radius = 80;

  const getPolygonPoints = (scale: number) => {
    return dimensions
      .map((_, i) => {
        const angle = (i * 2 * Math.PI) / numSides - Math.PI / 2;
        const x = center + radius * scale * Math.cos(angle);
        const y = center + radius * scale * Math.sin(angle);
        return `${x},${y}`;
      })
      .join(' ');
  };

  const getDataPoints = () => {
    return dimensions
      .map((dim, i) => {
        const angle = (i * 2 * Math.PI) / numSides - Math.PI / 2;
        const x = center + radius * (dim.score / 100) * Math.cos(angle);
        const y = center + radius * (dim.score / 100) * Math.sin(angle);
        return `${x},${y}`;
      })
      .join(' ');
  };

  const getLabels = () => {
    return dimensions.map((dim, i) => {
      const angle = (i * 2 * Math.PI) / numSides - Math.PI / 2;
      const labelRadius = radius + 20;
      const x = center + labelRadius * Math.cos(angle);
      const y = center + labelRadius * Math.sin(angle);
      const textAnchor =
        Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
      const dominantBaseline =
        Math.abs(Math.sin(angle)) < 0.1 ? 'middle' : Math.sin(angle) > 0 ? 'hanging' : 'auto';
      return (
        <text
          key={i}
          x={x}
          y={y}
          textAnchor={textAnchor}
          dominantBaseline={dominantBaseline}
          className="text-xs fill-default-400"
        >
          {dim.name}
        </text>
      );
    });
  };

  return (
    <div className="flex items-center justify-center">
      <svg width={240} height={240} className="overflow-visible">
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((scale, i) => (
          <polygon
            key={i}
            points={getPolygonPoints(scale)}
            fill="none"
            stroke="currentColor"
            className="text-content3/30"
            strokeWidth="1"
          />
        ))}
        {dimensions.map((_, i) => {
          const angle = (i * 2 * Math.PI) / numSides - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="currentColor"
              className="text-content3/30"
              strokeWidth="1"
            />
          );
        })}
        <polygon
          points={getDataPoints()}
          fill="rgba(59, 130, 246, 0.2)"
          stroke="rgba(59, 130, 246, 0.8)"
          strokeWidth="2"
        />
        {dimensions.map((dim, i) => {
          const angle = (i * 2 * Math.PI) / numSides - Math.PI / 2;
          const x = center + radius * (dim.score / 100) * Math.cos(angle);
          const y = center + radius * (dim.score / 100) * Math.sin(angle);
          return <circle key={i} cx={x} cy={y} r="4" fill="rgba(59, 130, 246, 1)" />;
        })}
        {getLabels()}
      </svg>
    </div>
  );
};

/**
 * 核心指标卡片组件 - 左侧圆形进度，右侧雷达图
 */
const CoreMetricsCards: React.FC<{
  qualityScore: QualityScore;
}> = ({ qualityScore }) => {
  const overallGrade = getGrade(qualityScore.overall);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      {/* 左侧：总体评分 + 等级 */}
      <div className="bg-content2/80 hover:bg-content2 rounded-xl p-4 transition-all duration-200 border border-content3">
        <div className="text-xs text-default-500 font-medium mb-3 text-center">总体评分</div>
        <div className="flex flex-col items-center">
          <CircularProgress score={qualityScore.overall} />
          <div
            className={`text-sm font-bold rounded px-3 py-1 mt-3 ${getGradeColor(overallGrade)}`}
          >
            {overallGrade}级
          </div>
        </div>
      </div>

      {/* 右侧：雷达图 */}
      <div className="bg-content2/80 hover:bg-content2 rounded-xl p-4 transition-all duration-200 border border-content3">
        <div className="text-xs text-default-500 font-medium mb-2 text-center">维度评分</div>
        <RadarChart qualityScore={qualityScore} />
      </div>
    </div>
  );
};

/**
 * 问题统计卡片
 */
const IssueStatsCard: React.FC<{
  statistics: QualityStatistics;
}> = ({ statistics }) => {
  return (
    <div className="bg-content2/80 hover:bg-content2 rounded-xl p-4 transition-all border border-content3">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-4 h-4 text-default-400" />
        <span className="text-xs font-medium text-default-500">问题统计</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-danger" />
            <span className="text-xs text-default-400">错误</span>
          </div>
          <span className="text-sm font-bold text-danger">{statistics.issueCount.error}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-warning" />
            <span className="text-xs text-default-400">警告</span>
          </div>
          <span className="text-sm font-bold text-warning">{statistics.issueCount.warning}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs text-default-400">提示</span>
          </div>
          <span className="text-sm font-bold text-primary">{statistics.issueCount.info}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * 详细统计卡片
 */
const DetailedStatsCard: React.FC<{
  statistics: QualityStatistics;
}> = ({ statistics }) => {
  return (
    <div className="bg-content2/80 hover:bg-content2 rounded-xl p-4 transition-all border border-content3">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-default-400" />
        <span className="text-xs font-medium text-default-500">详细统计</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="text-center">
          <div className="text-xs text-default-400">分镜</div>
          <div className="text-sm font-bold text-foreground">{statistics.totalShots}个</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-default-400">场景</div>
          <div className="text-sm font-bold text-foreground">{statistics.totalScenes}个</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-default-400">集数</div>
          <div className="text-sm font-bold text-foreground">{statistics.totalEpisodes}集</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-default-400">总时长</div>
          <div className="text-sm font-bold text-foreground">
            {formatDuration(statistics.totalDuration)}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 可展开的修复建议项组件
 */
const FixSuggestionItem: React.FC<{
  suggestion: FixSuggestion;
}> = ({ suggestion }) => {
  const [expanded, setExpanded] = useState(false);

  const getSeverityIcon = () => {
    switch (suggestion.severity) {
      case 'error':
        return <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />;
      default:
        return <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />;
    }
  };

  const getSeverityColor = () => {
    switch (suggestion.severity) {
      case 'error':
        return 'bg-danger-50 text-danger';
      case 'warning':
        return 'bg-warning-50 text-warning';
      default:
        return 'bg-primary-50 text-primary';
    }
  };

  return (
    <div
      className={`p-3 rounded text-xs transition-all ${getSeverityColor()} cursor-pointer hover:opacity-80`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        {getSeverityIcon()}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Chip variant="flat" className="text-[10px]">
              优先级 {suggestion.priority}
            </Chip>
            <span className="font-medium">{suggestion.issueType}</span>
          </div>
          <div className="text-sm">{suggestion.issueDescription}</div>
        </div>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </div>

      {expanded && (
        <div className="mt-3 pl-4 space-y-2">
          <div>
            <span className="font-medium">💡 修复建议：</span>
            <div className="mt-1">{suggestion.fixDescription}</div>
          </div>
          {suggestion.steps.length > 0 && (
            <div>
              <span className="font-medium">📝 操作步骤：</span>
              <ol className="mt-1 list-decimal list-inside space-y-1">
                {suggestion.steps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            </div>
          )}
          {suggestion.affectedItems.length > 0 && (
            <div>
              <span className="font-medium">📍 受影响：</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {suggestion.affectedItems.map((item, idx) => (
                  <Chip key={idx} variant="flat">
                    {item.episodeNumber && `第${item.episodeNumber}集`}
                    {item.sceneName && ` ${item.sceneName}`}
                    {item.shotIndex !== undefined && ` 第${item.shotIndex + 1}分镜`}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 问题列表组件
 */
const IssuesList: React.FC<{
  report: CoherenceReport;
}> = ({ report }) => {
  const allIssues = useMemo(() => {
    const issues: Array<{
      type: 'plot' | 'shot';
      severity: 'error' | 'warning' | 'info';
      message: string;
      context?: string;
    }> = [];

    report.plotCoherence.issues.forEach(issue => {
      issues.push({
        type: 'plot',
        severity: issue.severity as any,
        message: issue.message,
        context: issue.context,
      });
    });

    report.shotCoherence.issues.forEach(issue => {
      issues.push({
        type: 'shot',
        severity: issue.severity as any,
        message: issue.message,
        context: issue.context,
      });
    });

    return issues.sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [report]);

  if (allIssues.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-default-400">
        <CheckCircle2 className="w-12 h-12 mb-2 text-success" />
        <div className="text-center">
          <div className="font-medium">连贯性检查通过</div>
          <div className="text-sm">未发现明显问题</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {allIssues.map((issue, idx) => {
        const getSeverityIcon = () => {
          switch (issue.severity) {
            case 'error':
              return <AlertCircle className="w-4 h-4 flex-shrink-0" />;
            case 'warning':
              return <AlertTriangle className="w-4 h-4 flex-shrink-0" />;
            default:
              return <Info className="w-4 h-4 flex-shrink-0" />;
          }
        };

        const getSeverityColor = () => {
          switch (issue.severity) {
            case 'error':
              return 'bg-danger-50 text-danger';
            case 'warning':
              return 'bg-warning-50 text-warning';
            default:
              return 'bg-primary-50 text-primary';
          }
        };

        const getTypeLabel = () => {
          return issue.type === 'plot' ? '剧情' : '镜头';
        };

        return (
          <div key={idx} className={`p-3 rounded text-sm transition-all ${getSeverityColor()}`}>
            <div className="flex items-start gap-2">
              {getSeverityIcon()}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Chip variant="flat" className="text-[10px]">
                    {getTypeLabel()}
                  </Chip>
                </div>
                <div>{issue.message}</div>
                {issue.context && (
                  <div className="mt-1 text-xs opacity-80">上下文：{issue.context}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * 连贯性报告查看器主组件
 */
export const CoherenceReportViewer: React.FC<CoherenceReportViewerProps> = ({ report, t }) => {
  const [activeTab, setActiveTab] = useState<'issues' | 'suggestions'>('issues');

  return (
    <Card className="w-full shadow-lg">
      <CardBody className="p-4">
        {/* Row 1: 5 个核心指标卡片并排 */}
        <CoreMetricsCards qualityScore={report.qualityScore} />

        {/* Row 2: 问题统计 + 详细统计 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <IssueStatsCard statistics={report.statistics} />
          <DetailedStatsCard statistics={report.statistics} />
        </div>

        {/* Row 3: 问题/建议 Tabs */}
        <div className="border-t border-content3 pt-4">
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={key => setActiveTab(key as any)}
            classNames={{ tabList: 'gap-2' }}
          >
            <Tab
              key="issues"
              title={
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>问题列表</span>
                </div>
              }
            />
            <Tab
              key="suggestions"
              title={
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  <span>修复建议</span>
                  {report.fixSuggestions.length > 0 && (
                    <Chip variant="flat" className="ml-1">
                      {report.fixSuggestions.length}
                    </Chip>
                  )}
                </div>
              }
            />
          </Tabs>

          <div className="mt-4">
            {activeTab === 'issues' ? (
              <IssuesList report={report} />
            ) : (
              <div className="space-y-2">
                {report.fixSuggestions.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-default-400">
                    <CheckCircle2 className="w-12 h-12 mb-2 text-success" />
                    <div className="text-center">
                      <div className="font-medium">暂无修复建议</div>
                      <div className="text-sm">继续保持！</div>
                    </div>
                  </div>
                ) : (
                  report.fixSuggestions
                    .sort((a, b) => a.priority - b.priority)
                    .map(suggestion => (
                      <FixSuggestionItem key={suggestion.id} suggestion={suggestion} />
                    ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Row 4: 通用建议 */}
        {report.suggestions.length > 0 && (
          <div className="mt-4 border-t border-content3 pt-4">
            <h5 className="font-medium text-sm flex items-center gap-2 mb-3 px-1">
              <Zap className="w-4 h-4 text-warning" />
              通用建议
            </h5>
            <div className="space-y-2">
              {report.suggestions.map((suggestion, idx) => (
                <div key={idx} className="bg-warning-50 text-warning p-3 rounded text-sm">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{suggestion}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default CoherenceReportViewer;
