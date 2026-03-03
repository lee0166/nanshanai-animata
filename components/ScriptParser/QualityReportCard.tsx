/**
 * Quality Report Card Component
 *
 * 增强版质量报告展示组件
 * 展示多维度质量评分、统计信息和优化建议
 *
 * @module components/ScriptParser/QualityReportCard
 * @version 1.0.0
 */

import React, { useState } from 'react';
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
} from 'lucide-react';
import { DetailedQualityReport, QualityDimension, DimensionScore } from '../../services/parsing/QualityAnalyzer';

interface QualityReportCardProps {
  report: DetailedQualityReport;
  onFixIssue?: (issue: string) => void;
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
 * 维度评分条组件
 */
const DimensionScoreBar: React.FC<{ score: DimensionScore }> = ({ score }) => {
  const color = getScoreColor(score.score);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-default-500">{getDimensionIcon(score.dimension)}</span>
          <span className="text-sm font-medium">{getDimensionName(score.dimension)}</span>
          <span className="text-xs text-default-400">({Math.round(score.weight * 100)}%)</span>
        </div>
        <Chip size="sm" color={color as any} variant="flat">
          {score.score}分
        </Chip>
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
      {score.issues.length > 0 && (
        <div className="space-y-1 pl-6">
          {score.issues.slice(0, 2).map((issue, idx) => (
            <div key={idx} className="flex items-start gap-1 text-xs">
              {issue.type === 'error' ? (
                <AlertCircle className="w-3 h-3 text-danger flex-shrink-0 mt-0.5" />
              ) : issue.type === 'warning' ? (
                <AlertTriangle className="w-3 h-3 text-warning flex-shrink-0 mt-0.5" />
              ) : (
                <Info className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
              )}
              <span className={issue.type === 'error' ? 'text-danger' : issue.type === 'warning' ? 'text-warning' : 'text-primary'}>
                {issue.message}
              </span>
            </div>
          ))}
          {score.issues.length > 2 && (
            <div className="text-xs text-default-400 pl-4">
              还有 {score.issues.length - 2} 个问题...
            </div>
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
export const QualityReportCard: React.FC<QualityReportCardProps> = ({ report, onFixIssue, t }) => {
  const [expanded, setExpanded] = useState(false);
  const [showAllIssues, setShowAllIssues] = useState(false);

  const scoreColor = getScoreColor(report.score);
  const criticalCount = report.violations.filter(v => v.severity === 'error').length;
  const warningCount = report.violations.filter(v => v.severity === 'warning').length;
  const infoCount = report.violations.filter(v => v.severity === 'info').length;

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
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </CardHeader>

      <CardBody className="pt-0">
        {/* 问题概览 */}
        {(criticalCount > 0 || warningCount > 0 || infoCount > 0) ? (
          <div className="flex flex-wrap gap-2 mb-4">
            {criticalCount > 0 && (
              <Badge color="danger" variant="flat">
                <AlertCircle className="w-3 h-3 mr-1" />
                {criticalCount} 个严重问题
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge color="warning" variant="flat">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {warningCount} 个警告
              </Badge>
            )}
            {infoCount > 0 && (
              <Badge color="primary" variant="flat">
                <Info className="w-3 h-3 mr-1" />
                {infoCount} 个提示
              </Badge>
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

            {/* 所有问题列表 */}
            {report.violations.length > 0 && (
              <div className="mb-4">
                <h5 className="font-medium text-sm mb-3">问题详情</h5>
                <div className="space-y-2">
                  {(showAllIssues ? report.violations : report.violations.slice(0, 5)).map((violation, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg text-sm ${
                        violation.severity === 'error'
                          ? 'bg-danger-50 text-danger'
                          : violation.severity === 'warning'
                          ? 'bg-warning-50 text-warning'
                          : 'bg-primary-50 text-primary'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {violation.severity === 'error' ? (
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        ) : violation.severity === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium">{violation.message}</div>
                          {violation.suggestion && (
                            <div className="text-xs mt-1 opacity-80">
                              建议: {violation.suggestion}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {report.violations.length > 5 && (
                  <Button
                    size="sm"
                    variant="light"
                    className="w-full mt-2"
                    onPress={() => setShowAllIssues(!showAllIssues)}
                  >
                    {showAllIssues ? '收起' : `查看全部 ${report.violations.length} 个问题`}
                  </Button>
                )}
              </div>
            )}

            {/* 优化建议 */}
            {report.recommendations.length > 0 && (
              <div>
                <h5 className="font-medium text-sm mb-3">优化建议</h5>
                <Accordion>
                  {report.recommendations.map((recommendation, idx) => (
                    <AccordionItem
                      key={idx}
                      title={
                        <div className="flex items-center gap-2">
                          {recommendation.startsWith('[重要]') ? (
                            <AlertCircle className="w-4 h-4 text-danger" />
                          ) : (
                            <Info className="w-4 h-4 text-primary" />
                          )}
                          <span className="text-sm">
                            {recommendation.replace(/^\[(重要|建议)\]\s*/, '')}
                          </span>
                        </div>
                      }
                      aria-label={`建议 ${idx + 1}`}
                    >
                      <div className="text-sm text-default-500 pl-6">
                        {recommendation.startsWith('[重要]')
                          ? '这是一个重要问题，建议优先处理。'
                          : '这是一个优化建议，可以提升解析质量。'}
                        {onFixIssue && (
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            className="mt-2"
                            onPress={() => onFixIssue(recommendation)}
                          >
                            尝试修复
                          </Button>
                        )}
                      </div>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
          </>
        )}

        {/* 展开/收起按钮 */}
        {!expanded && (report.violations.length > 0 || report.recommendations.length > 0) && (
          <Button
            size="sm"
            variant="light"
            className="w-full mt-2"
            onPress={() => setExpanded(true)}
          >
            查看详细报告
          </Button>
        )}
      </CardBody>
    </Card>
  );
};

export default QualityReportCard;
