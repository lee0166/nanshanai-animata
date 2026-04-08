/**
 * Quality Report Card Component - Unified Visual Style
 *
 * 重构版质量报告展示组件 - 统一视觉风格
 * 左侧圆形进度条 + 右侧雷达图，与CoherenceReportViewer保持一致
 *
 * @module components/ScriptParser/QualityReportCard
 * @version 4.0.0
 */

import React, { useState, useMemo } from 'react';
import { Card, CardBody, Chip, Accordion, AccordionItem, Button } from '@heroui/react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Clock,
  Activity,
  Coins,
  Zap,
  Server,
  Target,
  Award,
  BarChart3,
  TrendingUp,
  Users,
  Map,
  Box,
  Film,
  Lightbulb,
  Globe,
  BookOpen,
  ChevronDown,
} from 'lucide-react';
import {
  DetailedQualityReport,
  QualityDimension,
  DimensionScore,
  QualityIssue,
} from '../../services/parsing/QualityAnalyzer';
import { PerformanceReport as PerformanceReportType } from '../../services/parsing/PerformanceMonitor';
import { ScoreBreakdown } from './ScoreBreakdown';
import { CircularProgress } from './Shared/CircularProgress';
import { RadarChart } from './Shared/RadarChart';
import {
  getScoreColor,
  getGrade,
  getGradeColor,
  formatDurationMs,
  getSeverityColor,
} from './Shared/qualityUtils';

/**
 * 获取严重程度图标
 */
const getSeverityIcon = (severity: 'error' | 'warning' | 'info') => {
  switch (severity) {
    case 'error':
      return <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />;
    case 'warning':
      return <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />;
    default:
      return <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />;
  }
};

interface QualityReportCardProps {
  report: DetailedQualityReport;
  t: any;
  performanceReport?: PerformanceReportType | null;
}

/**
 * 获取维度中文名称
 */
const getDimensionName = (dimension: QualityDimension): string => {
  const names: Record<QualityDimension, string> = {
    [QualityDimension.COMPLETENESS]: '完整性',
    [QualityDimension.ACCURACY]: '准确性',
    [QualityDimension.CONSISTENCY]: '一致性',
    [QualityDimension.USABILITY]: '可用性',
    [QualityDimension.DRAMATIC]: '戏剧性',
    [QualityDimension.SPATIAL_TEMPORAL]: '时空逻辑',
    [QualityDimension.NARRATIVE_LOGIC]: '叙事逻辑',
  };
  return names[dimension] || dimension;
};

/**
 * 获取维度图标
 */
const getDimensionIcon = (dimension: QualityDimension) => {
  const icons: Record<QualityDimension, any> = {
    [QualityDimension.COMPLETENESS]: <Target className="w-4 h-4" />,
    [QualityDimension.ACCURACY]: <CheckCircle2 className="w-4 h-4" />,
    [QualityDimension.CONSISTENCY]: <Activity className="w-4 h-4" />,
    [QualityDimension.USABILITY]: <Zap className="w-4 h-4" />,
    [QualityDimension.DRAMATIC]: <Award className="w-4 h-4" />,
    [QualityDimension.SPATIAL_TEMPORAL]: <Globe className="w-4 h-4" />,
    [QualityDimension.NARRATIVE_LOGIC]: <BookOpen className="w-4 h-4" />,
  };
  return icons[dimension] || <Info className="w-4 h-4" />;
};

/**
 * 核心指标展示 - 左侧圆形进度条 + 右侧雷达图
 */
const CoreMetrics: React.FC<{
  score: number;
  grade: string;
  dimensionScores: DimensionScore[];
}> = ({ score, grade, dimensionScores }) => {
  const radarDimensions = dimensionScores.map(dim => ({
    name: getDimensionName(dim.dimension),
    score: dim.score,
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
      <div className="flex flex-col items-center justify-center p-4 bg-content2/50 rounded-xl border border-content3">
        <CircularProgress score={score} showGrade={true} />
      </div>
      <div className="flex flex-col items-center justify-center p-4 bg-content2/50 rounded-xl border border-content3">
        <RadarChart dimensions={radarDimensions} />
      </div>
    </div>
  );
};

/**
 * 问题统计卡片
 */
const IssueStatsCard: React.FC<{
  critical: number;
  warning: number;
  info: number;
}> = ({ critical, warning, info }) => {
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
            <span className="text-xs text-default-400">严重</span>
          </div>
          <span className="text-sm font-bold text-danger">{critical}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-warning" />
            <span className="text-xs text-default-400">警告</span>
          </div>
          <span className="text-sm font-bold text-warning">{warning}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs text-default-400">提示</span>
          </div>
          <span className="text-sm font-bold text-primary">{info}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * 格式化Token数量
 */
const formatTokens = (tokens: number): string => {
  if (tokens < 1000) return `${tokens}`;
  return `${Math.round(tokens / 1000).toLocaleString('zh-CN')}k`;
};

/**
 * 性能统计卡片
 */
const PerformanceStatsCard: React.FC<{
  report: PerformanceReportType;
}> = ({ report }) => {
  return (
    <div className="bg-content2/80 hover:bg-content2 rounded-xl p-4 transition-all border border-content3">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-default-400" />
        <span className="text-xs font-medium text-default-500">性能统计</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-xs text-default-400">总耗时</div>
          <div className="text-sm font-bold text-foreground">
            {formatDurationMs(report.totalDuration)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-default-400">API 调用</div>
          <div className="text-sm font-bold text-foreground">
            {report.apiCallCount.toLocaleString('zh-CN')}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-default-400">Token</div>
          <div className="text-sm font-bold text-foreground">
            {formatTokens(report.totalTokensUsed)}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 可展开的问题项组件
 */
const IssueItem: React.FC<{
  issue: QualityIssue;
}> = ({ issue }) => {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = issue.context || issue.suggestion;
  const severity =
    issue.type === 'critical' || issue.type === 'error'
      ? 'error'
      : issue.type === 'warning'
        ? 'warning'
        : 'info';

  return (
    <div
      className={`p-2 rounded text-xs transition-all ${getSeverityColor(severity)} ${hasDetails ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={() => hasDetails && setExpanded(!expanded)}
    >
      <div className="flex items-start gap-1.5">
        {getSeverityIcon(severity)}
        <span className="flex-1">{issue.message}</span>
        {hasDetails && (
          <ChevronDown
            className={`w-3 h-3 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        )}
      </div>

      {expanded && hasDetails && (
        <div className="mt-2 pl-4 space-y-1 text-default-600">
          {issue.context && (
            <div>
              <span className="font-medium">上下文：</span>
              {issue.context}
            </div>
          )}
          {issue.suggestion && (
            <div>
              <span className="font-medium">建议：</span>
              {issue.suggestion}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 问题详情折叠面板
 */
const IssuesAccordion: React.FC<{
  dimensionScores: DimensionScore[];
}> = ({ dimensionScores }) => {
  const lowScoreDimensions = dimensionScores.filter(dim => dim.score < 80 && dim.issues.length > 0);
  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(new Set());

  const toggleDimension = (dimension: string) => {
    const newSet = new Set(expandedDimensions);
    if (newSet.has(dimension)) {
      newSet.delete(dimension);
    } else {
      newSet.add(dimension);
    }
    setExpandedDimensions(newSet);
  };

  if (lowScoreDimensions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-default-400">
        <CheckCircle2 className="w-12 h-12 mb-2 text-success" />
        <div className="text-center">
          <div className="font-medium">质量检查通过</div>
          <div className="text-sm">未发现明显问题</div>
        </div>
      </div>
    );
  }

  return (
    <Accordion variant="splitted" defaultExpandedKeys={['low-score']} motionProps={{}}>
      <AccordionItem
        key="low-score"
        textValue={`低分维度详情 (${lowScoreDimensions.length})`}
        title={
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-sm font-medium">低分维度详情 ({lowScoreDimensions.length})</span>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {lowScoreDimensions.map(dim => {
            const isExpanded = expandedDimensions.has(dim.dimension);
            const displayIssues = isExpanded ? dim.issues : dim.issues.slice(0, 3);
            const remainingCount = dim.issues.length - 3;

            return (
              <div key={dim.dimension} className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {getDimensionIcon(dim.dimension)}
                  <span className="font-medium">{getDimensionName(dim.dimension)}</span>
                  <Chip color={getScoreColor(dim.score) as any} variant="flat">
                    {dim.score}分
                  </Chip>
                  <Chip variant="flat">{dim.issues.length}个问题</Chip>
                </div>
                <div className="space-y-2 pl-6">
                  {displayIssues.map((issue, idx) => (
                    <IssueItem key={idx} issue={issue} />
                  ))}
                  {!isExpanded && remainingCount > 0 && (
                    <Button
                      size="sm"
                      variant="light"
                      className="text-xs"
                      onClick={() => toggleDimension(dim.dimension)}
                    >
                      还有 {remainingCount} 个问题，点击展开
                    </Button>
                  )}
                  {isExpanded && dim.issues.length > 3 && (
                    <Button
                      size="sm"
                      variant="light"
                      className="text-xs"
                      onClick={() => toggleDimension(dim.dimension)}
                    >
                      收起
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </AccordionItem>
    </Accordion>
  );
};

/**
 * 质量报告主组件 - 统一视觉风格
 */
export const QualityReportCard: React.FC<QualityReportCardProps> = ({
  report,
  t,
  performanceReport,
}) => {
  const { criticalCount, warningCount, infoCount, totalIssues } = useMemo(() => {
    let critical = 0;
    let warning = 0;
    let info = 0;

    report.dimensionScores.forEach(dim => {
      dim.issues.forEach(issue => {
        const severity =
          issue.type === 'critical' || issue.type === 'error'
            ? 'critical'
            : issue.type === 'warning'
              ? 'warning'
              : 'info';

        if (severity === 'critical') critical++;
        else if (severity === 'warning') warning++;
        else info++;
      });
    });

    return {
      criticalCount: critical,
      warningCount: warning,
      infoCount: info,
      totalIssues: critical + warning + info,
    };
  }, [report.dimensionScores]);

  return (
    <Card className="w-full shadow-lg">
      <CardBody className="p-4">
        <CoreMetrics
          score={report.score}
          grade={report.overallGrade}
          dimensionScores={report.dimensionScores}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <IssueStatsCard critical={criticalCount} warning={warningCount} info={infoCount} />
          {performanceReport && <PerformanceStatsCard report={performanceReport} />}
        </div>

        <div className="mb-4">
          <ScoreBreakdown
            dimensionScores={report.dimensionScores}
            totalScore={report.score}
            weightVersion={report.weightVersion || 'v1.0'}
          />
        </div>

        <div className="border-t border-content3 pt-4">
          <h5 className="font-medium text-sm flex items-center gap-2 mb-3 px-1">
            <BarChart3 className="w-4 h-4 text-primary" />
            质量维度详情
          </h5>
          <IssuesAccordion dimensionScores={report.dimensionScores} />
        </div>
      </CardBody>
    </Card>
  );
};

export default QualityReportCard;
