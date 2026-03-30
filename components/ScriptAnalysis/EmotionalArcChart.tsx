/**
 * Emotional Arc Chart Component
 *
 * 情绪曲线图表组件
 * 展示剧本的情绪起伏曲线和关键情节点
 *
 * @module components/ScriptAnalysis/EmotionalArcChart
 * @version 8.0.0
 */

import React from 'react';
import { Card, CardBody, CardHeader, Chip, Tooltip } from '@heroui/react';
import { Activity, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import type { EmotionalPoint } from '../../types';

interface EmotionalArcChartProps {
  emotionalArc?: EmotionalPoint[];
  overallMood?: string;
  t: any;
}

const emotionColors = [
  '#f59e0b',
  '#6b7280',
  '#374151',
  '#1f2937',
  '#4f46e5',
  '#6366f1',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#ef4444',
  '#65a30d',
];

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
            <p className="text-base">暂无情绪曲线数据</p>
            <p className="text-base mt-1">请先解析剧本以获取情绪分析</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  const width = 800;
  const height = 320;
  const padding = { top: 40, right: 40, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = emotionalArc.map((point, idx) => ({
    x: padding.left + (point.percentage / 100) * chartWidth,
    y: padding.top + chartHeight - (point.intensity / 10) * chartHeight,
    ...point,
    color: emotionColors[idx % emotionColors.length],
  }));

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

  return (
    <Card className="w-full bg-gradient-to-br from-content1 to-content2 border-none relative flex flex-col">
      <CardHeader className="flex items-center justify-between pb-1 pt-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/15 rounded-lg">
            <Heart className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold">情绪曲线</h3>
            <p className="text-sm text-default-500">故事情绪起伏与情节点</p>
          </div>
        </div>
        {overallMood && (
          <Chip size="sm" variant="flat" className="bg-primary/10 text-primary border-none">
            {overallMood}
          </Chip>
        )}
      </CardHeader>

      <CardBody className="pt-2 pb-4 space-y-3 flex-1 flex flex-col">
        <div className="flex-1 min-h-0">
          <div className="relative w-full h-full">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-full"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="emotionLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  {points.map((point, idx) => (
                    <stop
                      key={idx}
                      offset={`${(idx / Math.max(points.length - 1, 1)) * 100}%`}
                      stopColor={point.color}
                      stopOpacity="1"
                    />
                  ))}
                </linearGradient>

                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="#3f3f46"
                    strokeWidth="0.5"
                    opacity="0.3"
                  />
                </pattern>
              </defs>

              <rect
                x={padding.left}
                y={padding.top}
                width={chartWidth}
                height={chartHeight}
                fill="url(#grid)"
              />

              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => {
                const y = padding.top + chartHeight - (level / 10) * chartHeight;
                return (
                  <g key={level}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={padding.left + chartWidth}
                      y2={y}
                      stroke="#52525b"
                      strokeWidth="0.5"
                      opacity="0.4"
                    />
                  </g>
                );
              })}

              {[0, 25, 50, 75, 100].map(percent => {
                const x = padding.left + (percent / 100) * chartWidth;
                return (
                  <g key={percent}>
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={padding.top + chartHeight}
                      stroke="#52525b"
                      strokeWidth="0.5"
                      opacity="0.4"
                    />
                  </g>
                );
              })}

              <text
                x={padding.left - 12}
                y={padding.top + 4}
                className="text-[14px] fill-default-400"
                textAnchor="end"
              >
                10
              </text>
              <text
                x={padding.left - 12}
                y={padding.top + chartHeight / 2 + 4}
                className="text-[14px] fill-default-400"
                textAnchor="end"
              >
                5
              </text>
              <text
                x={padding.left - 12}
                y={padding.top + chartHeight + 4}
                className="text-[14px] fill-default-400"
                textAnchor="end"
              >
                0
              </text>

              <text
                x={padding.left}
                y={height - 12}
                className="text-[14px] fill-default-400"
                textAnchor="middle"
              >
                开场
              </text>
              <text
                x={width / 2}
                y={height - 12}
                className="text-[14px] fill-default-400"
                textAnchor="middle"
              >
                中点
              </text>
              <text
                x={width - padding.right}
                y={height - 12}
                className="text-[14px] fill-default-400"
                textAnchor="middle"
              >
                结局
              </text>

              <path
                d={generatePath()}
                fill="none"
                stroke="url(#emotionLineGradient)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {points.map((point, idx) => (
                <Tooltip
                  key={idx}
                  content={
                    <div className="max-w-xs">
                      <div className="font-bold text-[#84CC16] text-base mb-1">
                        {point.plotPoint}
                      </div>
                      <div className="text-sm text-[#d4d4d8] mb-2">{point.emotion}</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#27272a] rounded-sm overflow-hidden">
                          <div
                            className="h-full rounded-sm"
                            style={{
                              width: `${point.intensity * 10}%`,
                              backgroundColor: point.color,
                            }}
                          />
                        </div>
                        <span
                          className="font-bold text-sm whitespace-nowrap"
                          style={{ color: point.color }}
                        >
                          {point.intensity}/10
                        </span>
                      </div>
                    </div>
                  }
                  delay={0}
                  closeDelay={0}
                  placement="top"
                  classNames={{
                    content: 'bg-[#0a0a0a] border-2 border-[#84CC16] rounded-lg p-3 shadow-xl',
                  }}
                >
                  <g style={{ cursor: 'pointer' }}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={8}
                      fill={point.color}
                      stroke="#84CC16"
                      strokeWidth="3"
                      className="transition-all duration-200 hover:r-14"
                    />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={12}
                      fill="none"
                      stroke="#84CC16"
                      strokeWidth="1"
                      opacity="0.2"
                      className="transition-all duration-200 hover:opacity-40 hover:r-18"
                    />
                  </g>
                </Tooltip>
              ))}
            </svg>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default EmotionalArcChart;
