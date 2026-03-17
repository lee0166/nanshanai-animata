import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { DimensionScore, QualityDimension } from '../../services/parsing/QualityAnalyzer';

interface ScoreBreakdownProps {
  dimensionScores: DimensionScore[];
  totalScore: number;
  weightVersion: string;
}

/**
 * 获取维度显示名称
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
 * 获取评分颜色
 */
const getScoreColor = (score: number): string => {
  if (score >= 90) return 'text-success';
  if (score >= 75) return 'text-primary';
  if (score >= 60) return 'text-warning';
  return 'text-danger';
};

/**
 * 评分详情组件
 * 展示评分计算过程和权重分配
 */
export const ScoreBreakdown: React.FC<ScoreBreakdownProps> = ({
  dimensionScores,
  totalScore,
  weightVersion,
}) => {
  // 按权重排序（高到低）
  const sortedScores = [...dimensionScores].sort((a, b) => b.weight - a.weight);

  // 计算加权总分（用于验证）
  const calculatedTotal = sortedScores.reduce((sum, dim) => sum + dim.score * dim.weight, 0);

  // 判断是否为v2.0版本（权重调整后的版本）
  const isV2 = weightVersion === 'v2.0';

  return (
    <div className="bg-content2/50 rounded-lg p-4 space-y-3">
      {/* 评分体系升级说明 */}
      {isV2 && (
        <div className="bg-warning-50 border border-warning-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-warning-700">评分体系已升级至 v2.0</p>
              <p className="text-warning-600 mt-1">
                新体系更关注叙事质量和戏剧性。您的剧本数据完整性良好，
                但叙事结构需要优化。这是正常的评估调整，不代表剧本变差。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 标题和版本 */}
      <div className="flex items-center justify-between border-b border-content3 pb-2">
        <span className="text-sm font-medium">评分计算详情</span>
        <span className="text-xs text-default-400">权重版本: {weightVersion}</span>
      </div>

      {/* 维度明细 */}
      <div className="space-y-2">
        {sortedScores.map(dim => {
          const weightedScore = dim.score * dim.weight;
          return (
            <div key={dim.dimension} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-default-600 min-w-[80px]">
                  {getDimensionName(dim.dimension)}
                </span>
                <span className={`font-medium ${getScoreColor(dim.score)}`}>{dim.score}分</span>
              </div>
              <div className="flex items-center gap-2 text-default-500">
                <span>× {(dim.weight * 100).toFixed(0)}%</span>
                <span>=</span>
                <span className="font-medium text-foreground min-w-[50px] text-right">
                  {weightedScore.toFixed(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 总分 */}
      <div className="border-t border-content3 pt-2 flex items-center justify-between">
        <span className="text-sm font-medium">加权总分</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-default-400">
            ({calculatedTotal.toFixed(1)} → {totalScore})
          </span>
          <span className={`text-lg font-bold ${getScoreColor(totalScore)}`}>{totalScore}分</span>
        </div>
      </div>

      {/* 说明 */}
      <div className="text-xs text-default-400 bg-content1/50 rounded p-2">
        <p>计算公式：各维度分数 × 权重 = 加权分数，总和四舍五入取整</p>
        <p className="mt-1">权重越高，该维度对总分影响越大</p>
      </div>
    </div>
  );
};

export default ScoreBreakdown;
