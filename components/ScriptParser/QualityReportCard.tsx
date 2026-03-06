/**
 * Quality Report Card Component
 *
 * 增强版质量报告展示组件
 * 展示多维度质量评分、统计信息和优化建议
 *
 * @module components/ScriptParser/QualityReportCard
 * @version 2.0.0
 */

import React, { useState, useMemo } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Progress,
  Button,
  Accordion,
  AccordionItem,
  Tooltip,
  Badge,
  Divider,
  Tabs,
  Tab,
} from '@heroui/react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Users,
  Map,
  Box,
  Film,
  TrendingUp,
  Award,
  Target,
  FileText,
  Lightbulb,
} from 'lucide-react';
import { DetailedQualityReport, QualityDimension, DimensionScore, QualityIssue } from '../../services/parsing/QualityAnalyzer';

interface QualityReportCardProps {
  report: DetailedQualityReport;
  t: any;
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
  };
  return names[dimension] || dimension;
};

/**
 * 获取维度图标
 */
const getDimensionIcon = (dimension: QualityDimension) => {
  const icons: Record<QualityDimension, React.ReactNode> = {
    [QualityDimension.COMPLETENESS]: <CheckCircle2 className="w-4 h-4" />,
    [QualityDimension.ACCURACY]: <AlertCircle className="w-4 h-4" />,
    [QualityDimension.CONSISTENCY]: <TrendingUp className="w-4 h-4" />,
    [QualityDimension.USABILITY]: <Award className="w-4 h-4" />,
    [QualityDimension.DRAMATIC]: <Film className="w-4 h-4" />,
  };
  return icons[dimension];
};

/**
 * 获取分数颜色
 */
const getScoreColor = (score: number): string => {
  if (score >= 80) return 'success';
  if (score >= 60) return 'primary';
  if (score >= 40) return 'warning';
  return 'danger';
};

/**
 * 获取评级颜色
 */
const getGradeColor = (grade: string): string => {
  const colors: Record<string, string> = {
    'A': 'bg-success text-success-foreground',
    'B': 'bg-primary text-primary-foreground',
    'C': 'bg-warning text-warning-foreground',
    'D': 'bg-warning-500 text-warning-foreground',
    'F': 'bg-danger text-danger-foreground',
  };
  return colors[grade] || 'bg-default text-default-foreground';
};

/**
 * 问题类型图标
 */
const IssueIcon: React.FC<{ type: 'error' | 'warning' | 'info'; className?: string }> = ({ type, className = 'w-4 h-4' }) => {
  if (type === 'error') return <AlertCircle className={`${className} text-danger`} />;
  if (type === 'warning') return <AlertTriangle className={`${className} text-warning`} />;
  return <Info className={`${className} text-primary`} />;
};

/**
 * 问题卡片组件
 */
const IssueCard: React.FC<{
  issue: QualityIssue;
}> = ({ issue }) => {
  const bgColor = issue.type === 'error' ? 'bg-danger-50' : issue.type === 'warning' ? 'bg-warning-50' : 'bg-primary-50';
  const textColor = issue.type === 'error' ? 'text-danger' : issue.type === 'warning' ? 'text-warning' : 'text-primary';

  return (
    <div className={`p-3 rounded-lg ${bgColor} ${textColor}`}>
      <div className="flex items-start gap-2">
        <IssueIcon type={issue.type} className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{issue.message}</div>
          {issue.target && (
            <div className="text-xs mt-1 opacity-90 flex items-center gap-1">
              <Target className="w-3 h-3" />
              <span className="font-medium">{issue.target}</span>
            </div>
          )}
          {issue.context && (
            <div className="text-xs mt-1 opacity-80">
              {issue.context}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * 按维度分组的问题列表
 */
const IssuesByDimension: React.FC<{
  dimensionScores: DimensionScore[];
}> = ({ dimensionScores }) => {
  return (
    <div className="space-y-4">
      {dimensionScores.map((dimScore) => {
        if (dimScore.issues.length === 0) return null;

        return (
          <div key={dimScore.dimension} className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              {getDimensionIcon(dimScore.dimension)}
              <span>{getDimensionName(dimScore.dimension)}</span>
              <Chip size="sm" color={getScoreColor(dimScore.score) as any} variant="flat">
                {dimScore.issues.length} 个问题
              </Chip>
            </div>
            <div className="space-y-2 pl-6">
              {dimScore.issues.slice(0, 3).map((issue, idx) => (
                <IssueCard
                  key={idx}
                  issue={issue}
                />
              ))}
              {dimScore.issues.length > 3 && (
                <div className="text-xs text-default-400 pl-2">
                  还有 {dimScore.issues.length - 3} 个问题...
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * 维度评分条组件
 */
const DimensionScoreBar: React.FC<{ score: DimensionScore }> = ({ score }) => {
  const color = getScoreColor(score.score);
  const issueCount = score.issues.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-default-500">{getDimensionIcon(score.dimension)}</span>
          <span className="text-sm font-medium">{getDimensionName(score.dimension)}</span>
          <span className="text-xs text-default-400">({Math.round(score.weight * 100)}%)</span>
        </div>
        <div className="flex items-center gap-2">
          {issueCount > 0 && (
            <Chip size="sm" color={color as any} variant="flat">
              {issueCount} 个问题
            </Chip>
          )}
          <Chip size="sm" color={color as any} variant="flat">
            {score.score}分
          </Chip>
        </div>
      </div>
      <Progress value={score.score} color={color as any} size="sm" aria-label={`${getDimensionName(score.dimension)}评分`} />
      {score.details.length > 0 && (
        <div className="text-xs text-default-500 space-y-1 pl-6">
          {score.details.slice(0, 2).map((detail, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-success" />
              <span>{detail}</span>
            </div>
          ))}
          {score.details.length > 2 && (
            <div className="text-default-400">还有 {score.details.length - 2} 项...</div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 统计信息卡片
 */
const StatisticsCard: React.FC<{ statistics: DetailedQualityReport['statistics'] }> = ({ statistics }) => {
  const stats = [
    { icon: <Users className="w-4 h-4" />, label: '角色', value: statistics.totalCharacters, subValue: `${statistics.charactersWithDescription}个有描述` },
    { icon: <Map className="w-4 h-4" />, label: '场景', value: statistics.totalScenes, subValue: `${statistics.scenesWithShots}个有分镜` },
    { icon: <Box className="w-4 h-4" />, label: '物品', value: statistics.totalItems, subValue: '' },
    { icon: <Film className="w-4 h-4" />, label: '分镜', value: statistics.totalShots, subValue: `平均${statistics.avgShotsPerScene}个/场景` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat, idx) => (
        <div key={idx} className="bg-content2 rounded-lg p-3">
          <div className="flex items-center gap-2 text-default-500 mb-1">
            {stat.icon}
            <span className="text-xs">{stat.label}</span>
          </div>
          <div className="text-2xl font-bold">{stat.value}</div>
          {stat.subValue && (
            <div className="text-xs text-default-400">{stat.subValue}</div>
          )}
        </div>
      ))}
    </div>
  );
};

/**
 * 质量报告主组件
 */
export const QualityReportCard: React.FC<QualityReportCardProps> = ({ report, t }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const scoreColor = getScoreColor(report.score);

  // 统计各类型问题数量
  const { criticalCount, warningCount, infoCount, totalIssues } = useMemo(() => {
    let critical = 0;
    let warning = 0;
    let info = 0;

    report.dimensionScores.forEach(dim => {
      dim.issues.forEach(issue => {
        if (issue.type === 'error') critical++;
        else if (issue.type === 'warning') warning++;
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

  // 统计各维度问题数量
  const dimensionIssueCounts = useMemo(() => {
    return report.dimensionScores.map(dim => ({
      dimension: dim.dimension,
      name: getDimensionName(dim.dimension),
      count: dim.issues.length,
      score: dim.score,
    })).filter(d => d.count > 0);
  }, [report.dimensionScores]);

  return (
    <Card className="w-full">
      <CardHeader className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${getGradeColor(report.overallGrade)}`}>
            {report.overallGrade}
          </div>
          <div>
            <h4 className="font-bold text-lg">解析质量报告</h4>
            <div className="flex items-center gap-2 text-sm text-default-500">
              <span>综合评分</span>
              <Chip size="sm" color={scoreColor as any} variant="flat">
                {report.score}分
              </Chip>
              <span>·</span>
              <span>置信度 {Math.round(report.confidence * 100)}%</span>
            </div>
          </div>
        </div>
        <Button
          isIconOnly
          variant="light"
          size="sm"
          onPress={() => setExpanded(!expanded)}
          title={expanded ? "收起" : "展开"}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </CardHeader>

      <CardBody className="pt-0">
        {/* 问题概览 - 新的展示方式 */}
        {totalIssues > 0 ? (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2 mb-3">
              {criticalCount > 0 && (
                <Badge color="danger" variant="flat" className="px-3 py-1">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {criticalCount} 个严重
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge color="warning" variant="flat" className="px-3 py-1">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {warningCount} 个警告
                </Badge>
              )}
              {infoCount > 0 && (
                <Badge color="primary" variant="flat" className="px-3 py-1">
                  <Info className="w-3 h-3 mr-1" />
                  {infoCount} 个提示
                </Badge>
              )}
            </div>

            {/* 按维度展示问题分布 */}
            {dimensionIssueCounts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dimensionIssueCounts.map((dim) => (
                  <Chip
                    key={dim.dimension}
                    size="sm"
                    variant="flat"
                    color={dim.score < 60 ? 'danger' : dim.score < 80 ? 'warning' : 'primary'}
                  >
                    {dim.name}: {dim.count}个
                  </Chip>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-success mb-4">
            <CheckCircle2 className="w-5 h-5" />
            <span>质量检查通过，未发现明显问题</span>
          </div>
        )}

        {/* 维度评分 */}
        <div className="space-y-4 mb-4">
          <h5 className="font-medium text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            质量维度分析
          </h5>
          {report.dimensionScores.map((score) => (
            <DimensionScoreBar key={score.dimension} score={score} />
          ))}
        </div>

        <Divider className="my-4" />

        {/* 统计信息 */}
        <div className="mb-4">
          <h5 className="font-medium text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            数据统计
          </h5>
          <StatisticsCard statistics={report.statistics} />
        </div>

        {/* 展开更多详情 */}
        {expanded && (
          <>
            <Divider className="my-4" />

            <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as string)}>
              <Tab
                key="issues"
                title={
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>问题详情 ({totalIssues})</span>
                  </div>
                }
              >
                <div className="pt-4">
                  {totalIssues > 0 ? (
                    <IssuesByDimension
                      dimensionScores={report.dimensionScores}
                    />
                  ) : (
                    <div className="text-center text-default-400 py-8">
                      <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-success" />
                      <p>未发现质量问题</p>
                    </div>
                  )}
                </div>
              </Tab>

              <Tab
                key="recommendations"
                title={
                  <div className="flex items-center gap-1">
                    <Lightbulb className="w-4 h-4" />
                    <span>优化建议 ({report.recommendations.length})</span>
                  </div>
                }
              >
                <div className="pt-4">
                  {report.recommendations.length > 0 ? (
                    <div className="space-y-2">
                      {report.recommendations.map((recommendation, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-content2 text-sm"
                        >
                          <div className="flex items-start gap-2">
                            {recommendation.startsWith('🔴') ? (
                              <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                            ) : recommendation.startsWith('🟡') ? (
                              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                            ) : (
                              <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <div className="font-medium">
                                {recommendation.replace(/^(🔴|🟡|💡)\s*/, '')}
                              </div>
                              <div className="text-xs text-default-400 mt-1">
                                {recommendation.startsWith('🔴')
                                  ? '严重问题，请优先修复'
                                  : recommendation.startsWith('🟡')
                                  ? '优化建议，可提升生成效果'
                                  : '提示信息，供您参考'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-default-400 py-8">
                      <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-success" />
                      <p>暂无优化建议</p>
                    </div>
                  )}
                </div>
              </Tab>
            </Tabs>
          </>
        )}


      </CardBody>
    </Card>
  );
};

export default QualityReportCard;
