/**
 * Emotional Arc Chart Component
 *
 * 情绪曲线图表组件
 * 展示剧本的情绪起伏曲线和关键情节点
 *
 * @module components/ScriptAnalysis/EmotionalArcChart
 * @version 2.0.0
 */

import React from 'react';
import { Card, CardBody, CardHeader, Chip } from '@heroui/react';
import { Activity, Heart } from 'lucide-react';
import type { EmotionalPoint } from '../../types';

interface EmotionalArcChartProps {
  emotionalArc?: EmotionalPoint[];
  overallMood?: string;
  t: any;
}

/**
 * 获取情绪颜色 - 使用高饱和度颜色，对比度更强
 */
const getEmotionColor = (emotion: string): string => {
  const lowerEmotion = emotion.toLowerCase();

  if (
    lowerEmotion.includes('喜悦') ||
    lowerEmotion.includes('快乐') ||
    lowerEmotion.includes('兴奋') ||
    lowerEmotion.includes('甜蜜')
  ) {
    return '#22c55e'; // 绿色-高饱和
  }
  if (
    lowerEmotion.includes('悲伤') ||
    lowerEmotion.includes('痛苦') ||
    lowerEmotion.includes('绝望') ||
    lowerEmotion.includes('失落')
  ) {
    return '#3b82f6'; // 蓝色-高饱和
  }
  if (
    lowerEmotion.includes('紧张') ||
    lowerEmotion.includes('愤怒') ||
    lowerEmotion.includes('冲突') ||
    lowerEmotion.includes('焦虑')
  ) {
    return '#ef4444'; // 红色-高饱和
  }
  if (
    lowerEmotion.includes('平静') ||
    lowerEmotion.includes('安宁') ||
    lowerEmotion.includes('温馨')
  ) {
    return '#06b6d4'; // 青色-高饱和
  }
  if (lowerEmotion.includes('浪漫') || lowerEmotion.includes('温暖')) {
    return '#f97316'; // 橙色-高饱和
  }

  return '#8b5cf6'; // 紫色
};

/**
 * 情绪曲线图表组件
 */
export const EmotionalArcChart: React.FC<EmotionalArcChartProps> = ({
  emotionalArc,
  overallMood,
  t,
}) => {
  if (!emotionalArc || emotionalArc.length === 0) {
    return (
      <Card className="w-full">
        <CardBody>
          <div className="text-center text-default-500 py-8">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无情绪曲线数据</p>
            <p className="text-sm mt-1">请先解析剧本以获取情绪分析</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  // 计算SVG路径
  const width = 600;
  const height = 180;
  const padding = { top: 25, right: 30, bottom: 45, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 生成路径点
  const points = emotionalArc.map(point => ({
    x: padding.left + (point.percentage / 100) * chartWidth,
    y: padding.top + chartHeight - (point.intensity / 10) * chartHeight,
    ...point,
  }));

  // 生成平滑曲线路径
  const generatePath = () => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const midX = (current.x + next.x) / 2;

      path += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
    }

    return path;
  };

  // 生成渐变填充区域
  const generateGradientArea = () => {
    if (points.length === 0) return '';

    const linePath = generatePath();
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];

    return `${linePath} L ${lastPoint.x} ${padding.top + chartHeight} L ${firstPoint.x} ${padding.top + chartHeight} Z`;
  };

  return (
    <Card className="w-full bg-gradient-to-br from-content1 to-content2">
      <CardHeader className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/15 rounded-xl">
            <Heart className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold">情绪曲线</h3>
            <p className="text-xs text-default-500">故事情绪起伏与情节点</p>
          </div>
        </div>
        {overallMood && (
          <Chip size="sm" variant="flat" className="bg-primary/10 text-primary border-none">
            {overallMood}
          </Chip>
        )}
      </CardHeader>

      <CardBody className="pt-2 pb-4">
        {/* 情绪曲线图表 */}
        <div className="relative w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full min-w-[450px]"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* 渐变填充 - 更清晰 */}
              <linearGradient id="emotionFillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.15" />
              </linearGradient>
            </defs>

            {/* 背景网格 */}
            <g opacity="0.15">
              {[0, 0.25, 0.5, 0.75, 1].map((y, i) => (
                <line
                  key={`grid-h-${i}`}
                  x1={padding.left}
                  y1={padding.top + chartHeight * y}
                  x2={width - padding.right}
                  y2={padding.top + chartHeight * y}
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              ))}
              {[0, 0.25, 0.5, 0.75, 1].map((x, i) => (
                <line
                  key={`grid-v-${i}`}
                  x1={padding.left + chartWidth * x}
                  y1={padding.top}
                  x2={padding.left + chartWidth * x}
                  y2={padding.top + chartHeight}
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              ))}
            </g>

            {/* Y轴标签 */}
            <text
              x={padding.left - 8}
              y={padding.top + 4}
              className="text-[10px] fill-default-400"
              textAnchor="end"
            >
              10
            </text>
            <text
              x={padding.left - 8}
              y={padding.top + chartHeight / 2 + 4}
              className="text-[10px] fill-default-400"
              textAnchor="end"
            >
              5
            </text>
            <text
              x={padding.left - 8}
              y={padding.top + chartHeight + 4}
              className="text-[10px] fill-default-400"
              textAnchor="end"
            >
              0
            </text>

            {/* X轴标签 */}
            <text
              x={padding.left}
              y={height - 8}
              className="text-[10px] fill-default-400"
              textAnchor="middle"
            >
              开场
            </text>
            <text
              x={width / 2}
              y={height - 8}
              className="text-[10px] fill-default-400"
              textAnchor="middle"
            >
              中点
            </text>
            <text
              x={width - padding.right}
              y={height - 8}
              className="text-[10px] fill-default-400"
              textAnchor="middle"
            >
              结局
            </text>

            {/* 填充区域 */}
            <path d={generateGradientArea()} fill="url(#emotionFillGradient)" />

            {/* 曲线 */}
            <path
              d={generatePath()}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 数据点 */}
            {points.map((point, idx) => {
              const pointColor = getEmotionColor(point.emotion);
              return (
                <g key={idx}>
                  {/* 外圈 */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="7"
                    fill={pointColor}
                    stroke="#fff"
                    strokeWidth="2"
                  />
                  {/* 情节标签 */}
                  <text
                    x={point.x}
                    y={point.y - 12}
                    textAnchor="middle"
                    className="text-[9px] fill-default-500 font-medium"
                  >
                    {point.plotPoint}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 情绪点列表 - 横向滚动 */}
        <div className="mt-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {emotionalArc.map((point, idx) => {
              const pointColor = getEmotionColor(point.emotion);
              return (
                <div
                  key={idx}
                  className="flex-shrink-0 bg-content2/60 backdrop-blur-sm rounded-lg p-2.5 border border-divider hover:border-primary/30 transition-all cursor-pointer min-w-[140px]"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium truncate" style={{ color: pointColor }}>
                      {point.plotPoint}
                    </span>
                    <span className="text-[10px] text-default-400">{point.percentage}%</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="h-1 flex-1 rounded-full bg-default-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${point.intensity * 10}%`,
                          backgroundColor: pointColor,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-medium" style={{ color: pointColor }}>
                      {point.intensity}
                    </span>
                  </div>
                  <div className="text-[10px] text-default-500 truncate">{point.emotion}</div>
                </div>
              );
            })}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default EmotionalArcChart;
