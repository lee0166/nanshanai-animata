/**
 * Refinement Report Card Component
 *
 * 迭代优化报告展示组件
 * 展示迭代优化的执行结果、质量改进和详细报告
 *
 * @module components/ScriptParser/RefinementReportCard
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
  Badge,
  Divider,
  Tabs,
  Tab,
} from '@heroui/react';
import {
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  RotateCcw,
  FileText,
  BarChart3,
  Clock,
  Target,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { IterativeRefinementResult, IterationResult } from '../../services/parsing/refinement/IterativeRefinementEngine';

interface RefinementReportCardProps {
  result: IterativeRefinementResult;
  t: any;
}

/**
 * 获取状态颜色
 */
const getStatusColor = (success: boolean): "success" | "warning" | "danger" => {
  if (success) return "success";
  return "warning";
};

/**
 * 获取质量等级颜色
 */
const getScoreColor = (score: number): "success" | "warning" | "danger" => {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
};

/**
 * 格式化时间
 */
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

export const RefinementReportCard: React.FC<RefinementReportCardProps> = ({ result, t }) => {
  const [expandedIterations, setExpandedIterations] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState('overview');

  const toggleIteration = (iteration: number) => {
    setExpandedIterations(prev =>
      prev.includes(iteration)
        ? prev.filter(i => i !== iteration)
        : [...prev, iteration]
    );
  };

  const isIterationExpanded = (iteration: number) => expandedIterations.includes(iteration);

  return (
    <Card className="w-full">
      <CardHeader className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">{t.scriptParser?.refinementReport || '迭代优化报告'}</h3>
        </div>
        <Chip
          color={getStatusColor(result.success)}
          variant="flat"
          size="sm"
        >
          {result.success ? '优化成功' : '优化完成'}
        </Chip>
      </CardHeader>

      <CardBody>
        <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as string)}>
          <Tab key="overview" title={
            <div className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              <span>概览</span>
            </div>
          }>
            <OverviewTab result={result} t={t} />
          </Tab>

          <Tab key="iterations" title={
            <div className="flex items-center gap-1">
              <RotateCcw className="w-4 h-4" />
              <span>迭代详情</span>
            </div>
          }>
            <IterationsTab
              result={result}
              t={t}
              expandedIterations={expandedIterations}
              toggleIteration={toggleIteration}
              isIterationExpanded={isIterationExpanded}
            />
          </Tab>

          <Tab key="report" title={
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              <span>完整报告</span>
            </div>
          }>
            <ReportTab result={result} t={t} />
          </Tab>
        </Tabs>
      </CardBody>
    </Card>
  );
};

/**
 * 概览标签页
 */
const OverviewTab: React.FC<{ result: IterativeRefinementResult; t: any }> = ({ result, t }) => {
  return (
    <div className="space-y-4 mt-4">
      {/* 执行摘要 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<RotateCcw className="w-5 h-5" />}
          label="迭代次数"
          value={result.totalIterations}
          color="primary"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="执行时间"
          value={formatDuration(result.iterationResults.reduce((sum, r) => sum + r.executionTime, 0))}
          color="secondary"
        />
        <StatCard
          icon={<Target className="w-5 h-5" />}
          label="初始分数"
          value={result.initialQualityScore.toFixed(1)}
          color="default"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="最终分数"
          value={result.finalQualityScore.toFixed(1)}
          color={getScoreColor(result.finalQualityScore)}
        />
      </div>

      {/* 质量改进 */}
      <Card className="bg-content2">
        <CardBody>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">质量改进</span>
            <Chip
              color={result.totalQualityImprovement > 0 ? "success" : "default"}
              size="sm"
              variant="flat"
            >
              {result.totalQualityImprovement > 0 ? '+' : ''}{result.totalQualityImprovement.toFixed(2)}
            </Chip>
          </div>
          <Progress
            value={result.finalQualityScore}
            maxValue={100}
            color={getScoreColor(result.finalQualityScore)}
            showValueLabel
            size="md"
          />
          <div className="flex justify-between mt-1 text-xs text-default-500">
            <span>初始: {result.initialQualityScore.toFixed(1)}</span>
            <span>目标: 85+</span>
          </div>
        </CardBody>
      </Card>

      {/* 统计信息 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatBadge
          label="发现违规"
          value={result.stats.totalViolationsFound}
          color="warning"
        />
        <StatBadge
          label="生成动作"
          value={result.stats.totalActionsGenerated}
          color="primary"
        />
        <StatBadge
          label="应用修正"
          value={result.stats.totalActionsApplied}
          color="success"
        />
        <StatBadge
          label="跳过动作"
          value={result.stats.totalActionsSkipped}
          color="default"
        />
        <StatBadge
          label="失败动作"
          value={result.stats.totalActionsFailed}
          color={result.stats.totalActionsFailed > 0 ? "danger" : "default"}
        />
        <StatBadge
          label="检查次数"
          value={result.stats.totalChecks}
          color="secondary"
        />
      </div>
    </div>
  );
};

/**
 * 迭代详情标签页
 */
const IterationsTab: React.FC<{
  result: IterativeRefinementResult;
  t: any;
  expandedIterations: number[];
  toggleIteration: (iteration: number) => void;
  isIterationExpanded: (iteration: number) => boolean;
}> = ({ result, t, toggleIteration, isIterationExpanded }) => {
  return (
    <div className="space-y-3 mt-4">
      {result.iterationResults.map((iteration) => (
        <IterationCard
          key={iteration.iteration}
          iteration={iteration}
          t={t}
          isExpanded={isIterationExpanded(iteration.iteration)}
          onToggle={() => toggleIteration(iteration.iteration)}
        />
      ))}
    </div>
  );
};

/**
 * 完整报告标签页
 */
const ReportTab: React.FC<{ result: IterativeRefinementResult; t: any }> = ({ result }) => {
  return (
    <div className="mt-4">
      <Card className="bg-content2">
        <CardBody>
          <pre className="whitespace-pre-wrap text-sm font-mono text-default-700 overflow-auto max-h-96">
            {result.report}
          </pre>
        </CardBody>
      </Card>
    </div>
  );
};

/**
 * 统计卡片
 */
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: "primary" | "secondary" | "success" | "warning" | "danger" | "default";
}> = ({ icon, label, value, color }) => (
  <Card className="bg-content2">
    <CardBody className="flex flex-row items-center gap-3 p-3">
      <div className={`p-2 rounded-lg bg-${color}/10 text-${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-default-500">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </CardBody>
  </Card>
);

/**
 * 统计徽章
 */
const StatBadge: React.FC<{
  label: string;
  value: number;
  color: "primary" | "secondary" | "success" | "warning" | "danger" | "default";
}> = ({ label, value, color }) => (
  <div className="flex items-center justify-between p-2 bg-content2 rounded-lg">
    <span className="text-sm text-default-600">{label}</span>
    <Badge color={color} variant="flat">{value}</Badge>
  </div>
);

/**
 * 迭代卡片
 */
const IterationCard: React.FC<{
  iteration: IterationResult;
  t: any;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ iteration, t, isExpanded, onToggle }) => {
  return (
    <Card className="bg-content2">
      <CardBody className="p-0">
        {/* 头部 */}
        <div
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-content3 transition-colors"
          onClick={onToggle}
        >
          <div className="flex items-center gap-3">
            <Badge color="primary" variant="flat">迭代 {iteration.iteration}</Badge>
            <div className="flex items-center gap-2">
              <span className="text-sm text-default-500">质量分数:</span>
              <span className="font-medium">{iteration.qualityScoreBefore.toFixed(1)}</span>
              <span className="text-default-400">→</span>
              <span className={`font-medium text-${getScoreColor(iteration.qualityScoreAfter)}`}>
                {iteration.qualityScoreAfter.toFixed(1)}
              </span>
            </div>
            {iteration.improvement > 0 && (
              <Chip color="success" size="sm" variant="flat">
                +{iteration.improvement.toFixed(2)}
              </Chip>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-default-400">{formatDuration(iteration.executionTime)}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {/* 展开内容 */}
        {isExpanded && (
          <div className="px-3 pb-3">
            <Divider className="my-2" />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-default-500 mb-1">一致性检查</p>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-warning" />
                  <span>发现 {iteration.consistencyResult.violations.length} 个违规</span>
                </div>
              </div>
              <div>
                <p className="text-default-500 mb-1">修正动作</p>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>
                    {iteration.refinementResult.appliedActions.length} 应用 /
                    {iteration.refinementResult.skippedActions.length} 跳过 /
                    {iteration.refinementResult.failedActions.length} 失败
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default RefinementReportCard;
