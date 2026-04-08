/**
 * 标注样本质量评估界面组件
 *
 * 基于标注标准v1.0的质量评估界面
 * 展示质量报告、维度评分、问题详情等
 *
 * @module components/AnnotationQualityReport
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Button,
  Accordion,
  AccordionItem,
  Select,
  SelectItem,
  Divider,
  Spinner,
} from '@heroui/react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  BarChart3,
  Target,
  BookOpen,
  Clock,
  MessageSquare,
  ChevronDown,
  RefreshCw,
  Award,
  TrendingUp,
  Film,
} from 'lucide-react';
import {
  AnnotationQualityService,
  type AnnotationQualityReport as AnnotationQualityReportType,
  type AnnotationQualityIssue,
  type AnnotationDimensionScore,
} from '../services/dataset';
import { annotationSampleService, type Story } from '../services/dataset';

const qualityService = new AnnotationQualityService();

/**
 * 获取评分颜色
 */
const getScoreColor = (score: number): 'success' | 'primary' | 'warning' | 'danger' => {
  if (score >= 85) return 'success';
  if (score >= 70) return 'primary';
  if (score >= 55) return 'warning';
  return 'danger';
};

/**
 * 获取等级颜色
 */
const getGradeColor = (grade: string): 'success' | 'primary' | 'warning' | 'danger' => {
  switch (grade) {
    case 'S':
    case 'A':
      return 'success';
    case 'B':
      return 'primary';
    case 'C':
    case 'D':
      return 'warning';
    default:
      return 'danger';
  }
};

/**
 * 获取严重程度颜色
 */
const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'error':
      return 'text-danger';
    case 'warning':
      return 'text-warning';
    default:
      return 'text-primary';
  }
};

/**
 * 获取严重程度背景色
 */
const getSeverityBgColor = (severity: string): string => {
  switch (severity) {
    case 'error':
      return 'bg-danger/10 border-danger/30';
    case 'warning':
      return 'bg-warning/10 border-warning/30';
    default:
      return 'bg-primary/10 border-primary/30';
  }
};

/**
 * 获取严重程度图标
 */
const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'error':
      return <AlertCircle className="w-4 h-4 flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 flex-shrink-0" />;
    default:
      return <Info className="w-4 h-4 flex-shrink-0" />;
  }
};

/**
 * 圆形进度条组件
 */
const CircularProgress: React.FC<{ score: number; grade: string }> = ({ score, grade }) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg className="w-32 h-32 transform -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          className="text-default-300"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${
            score >= 85
              ? 'text-success'
              : score >= 70
                ? 'text-primary'
                : score >= 55
                  ? 'text-warning'
                  : 'text-danger'
          } transition-all duration-500`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-foreground">{score}</span>
        <span className="text-sm text-default-500">分</span>
        <Chip color={getGradeColor(grade)} variant="flat" className="mt-1">
          {grade}级
        </Chip>
      </div>
    </div>
  );
};

/**
 * 统计卡片组件
 */
const StatsCard: React.FC<{
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color?: string;
  subtitle?: string;
}> = ({ title, value, icon, color, subtitle }) => (
  <div className="bg-content2/50 rounded-xl p-4 border border-content3">
    <div className="flex items-center gap-3 mb-2">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center ${color || 'bg-primary/10'}`}
      >
        {icon}
      </div>
      <div>
        <div className="text-xs text-default-500">{title}</div>
        <div className="text-xl font-bold text-foreground">{value}</div>
        {subtitle && <div className="text-xs text-default-400">{subtitle}</div>}
      </div>
    </div>
  </div>
);

/**
 * 维度评分卡片
 */
const DimensionScoreCard: React.FC<{ dimension: AnnotationDimensionScore }> = ({ dimension }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-content2/30 rounded-xl p-4 border border-content3">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => dimension.issues.length > 0 && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{dimension.name}</span>
            {dimension.issues.length > 0 && (
              <span className="text-xs text-default-500">{dimension.issues.length}个问题</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Chip color={getScoreColor(dimension.score)} variant="flat">
            {dimension.score}分
          </Chip>
          {dimension.issues.length > 0 && (
            <ChevronDown
              className={`w-4 h-4 text-default-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          )}
        </div>
      </div>

      {/* 进度条 */}
      <div className="mt-3">
        <div className="h-2 bg-default-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              dimension.score >= 85
                ? 'bg-success'
                : dimension.score >= 70
                  ? 'bg-primary'
                  : dimension.score >= 55
                    ? 'bg-warning'
                    : 'bg-danger'
            }`}
            style={{ width: `${dimension.score}%` }}
          />
        </div>
      </div>

      {/* 问题列表 */}
      {expanded && dimension.issues.length > 0 && (
        <div className="mt-4 space-y-2">
          {dimension.issues.map((issue, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border ${getSeverityBgColor(issue.severity)}`}
            >
              <div className="flex items-start gap-2">
                <span className={getSeverityColor(issue.severity)}>
                  {getSeverityIcon(issue.severity)}
                </span>
                <div className="flex-1">
                  {issue.shotId && (
                    <div className="text-xs font-medium text-default-500 mb-1">
                      分镜: {issue.shotId}
                    </div>
                  )}
                  <div className="text-sm text-foreground">{issue.message}</div>
                  {issue.context && (
                    <div className="text-xs text-default-500 mt-1">{issue.context}</div>
                  )}
                  <div className="text-xs text-default-400 mt-1">💡 {issue.suggestion}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface AnnotationQualityReportProps {
  t: any;
}

export const AnnotationQualityReport: React.FC<AnnotationQualityReportProps> = ({ t }) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState<string>('');
  const [report, setReport] = useState<AnnotationQualityReportType | null>(null);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  // 加载故事列表
  const loadStories = useCallback(() => {
    setLoading(true);
    try {
      const allStories = annotationSampleService.getAllStories();
      setStories(allStories);
      if (allStories.length > 0 && !selectedStoryId) {
        setSelectedStoryId(allStories[0].id);
      }
    } catch (error) {
      console.error('Failed to load stories:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedStoryId]);

  // 评估选中的故事
  const evaluateStory = useCallback(() => {
    if (!selectedStoryId) return;

    setEvaluating(true);
    try {
      const story = annotationSampleService.getStoryById(selectedStoryId);
      if (story) {
        const result = qualityService.evaluate(
          story.shots || [],
          story.characters || [],
          story.scenes || [],
          []
        );
        setReport(result);
      }
    } catch (error) {
      console.error('Failed to evaluate story:', error);
    } finally {
      setEvaluating(false);
    }
  }, [selectedStoryId]);

  // 初始化和选择变化时评估
  useEffect(() => {
    loadStories();
  }, [loadStories]);

  useEffect(() => {
    if (selectedStoryId) {
      evaluateStory();
    }
  }, [selectedStoryId, evaluateStory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部选择区 */}
      <Card className="shadow-lg">
        <CardHeader className="pb-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">标注质量评估</h2>
                <p className="text-xs text-default-500">基于标注标准v1.0</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select
                placeholder="选择标注样本"
                selectedKeys={selectedStoryId ? new Set([selectedStoryId]) : new Set()}
                onSelectionChange={keys => {
                  const id = Array.from(keys)[0] as string;
                  if (id) setSelectedStoryId(id);
                }}
                className="w-64"
                size="sm"
              >
                {stories.map(story => (
                  <SelectItem key={story.id} value={story.id}>
                    {story.metadata?.title || story.id}
                  </SelectItem>
                ))}
              </Select>
              <Button
                size="sm"
                variant="flat"
                startContent={<RefreshCw className="w-4 h-4" />}
                onPress={evaluateStory}
                isLoading={evaluating}
              >
                重新评估
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody className="pt-4">
          {!report ? (
            <div className="flex flex-col items-center justify-center py-12 text-default-400">
              <Target className="w-16 h-16 mb-4 opacity-50" />
              <div className="text-center">
                <div className="font-medium">请选择一个标注样本开始评估</div>
                <div className="text-sm mt-1">基于标注标准v1.0进行全面质量检查</div>
              </div>
            </div>
          ) : (
            <>
              {/* 核心评分区 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="col-span-1 flex items-center justify-center p-4 bg-content2/30 rounded-xl border border-content3">
                  <CircularProgress score={report.overallScore} grade={report.grade} />
                </div>
                <StatsCard
                  title="总分镜数"
                  value={report.statistics.totalShots}
                  icon={<Film className="w-5 h-5 text-primary" />}
                  color="bg-primary/10"
                />
                <StatsCard
                  title="问题总数"
                  value={report.totalIssues}
                  icon={<AlertTriangle className="w-5 h-5 text-warning" />}
                  color="bg-warning/10"
                  subtitle={`严重: ${report.criticalIssues} · 警告: ${report.warningIssues}`}
                />
                <StatsCard
                  title="平均描述"
                  value={`${report.statistics.avgDescriptionLength}字`}
                  icon={<BookOpen className="w-5 h-5 text-success" />}
                  color="bg-success/10"
                  subtitle={`平均时长: ${report.statistics.avgDuration}秒`}
                />
              </div>

              <Divider className="my-4" />

              {/* 维度评分区 */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  维度评分详情
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.dimensions.map((dimension, idx) => (
                    <DimensionScoreCard key={idx} dimension={dimension} />
                  ))}
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default AnnotationQualityReport;
