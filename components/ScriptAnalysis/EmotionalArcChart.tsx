/**
 * Emotional Arc Chart Component
 *
 * 情绪曲线图表组件
 * 展示剧本的情绪起伏曲线和关键情节点
 *
 * @module components/ScriptAnalysis/EmotionalArcChart
 * @version 8.0.0
 */

import React, { useState, useRef } from 'react';
import { Card, CardBody, CardHeader, Chip } from '@heroui/react';
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

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  point: EmotionalPoint | null;
  color: string;
}

export const EmotionalArcChart: React.FC<EmotionalArcChartProps> = ({
  emotionalArc,
  overallMood,
  t,
}) => {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    point: null,
    color: '#000',
  });

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

  const handlePointMouseEnter = (
    e: React.MouseEvent,
    point: EmotionalPoint,
    color: string
  ) => {
    setTooltip({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      point,
      color,
    });
  };

  const handlePointMouseLeave = () => {
    setTooltip({
      visible: false,
      x: 0,
      y: 0,
      point: null,
      color: '#000',
    });
  };

  return (
    <Card className="w-full bg-gradient-to-br from-content1 to-content2 border-none relative">
      <CardHeader className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <motion.div
            className="p-2.5 bg-primary/15 rounded-xl"
            animate={{ 
              scale: [1, 1.05, 1],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Heart className="w-5 h-5 text-primary" />
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold">情绪曲线</h3>
            <p className="text-sm text-default-500">故事情绪起伏与情节点</p>
          </div>
        </div>
        {overallMood && (
          <Chip size="sm" variant="flat" className="bg-primary/10 text-primary border-none">
            {overallMood}
          </Chip>
        )}
      </CardHeader>

      <CardBody className="pt-2 pb-4">
        <div className="relative w-full">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto"
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
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#3f3f46" strokeWidth="0.5" opacity="0.3"/>
              </pattern>
            </defs>

            <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill="url(#grid)" />

            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => {
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

            {[0, 25, 50, 75, 100].map((percent) => {
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

            {points.map((point, idx) => {
              const isHovered = tooltip.visible && tooltip.point?.percentage === point.percentage;

              return (
                <g key={idx}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isHovered ? 14 : 8}
                    fill={point.color}
                    stroke="#84CC16"
                    strokeWidth="3"
                    style={{ 
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => handlePointMouseEnter(e, point, point.color)}
                    onMouseLeave={handlePointMouseLeave}
                  />
                  
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isHovered ? 18 : 12}
                    fill="none"
                    stroke="#84CC16"
                    strokeWidth="1"
                    opacity={isHovered ? 0.4 : 0.2}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </CardBody>

      {tooltip.visible && tooltip.point && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 20,
            top: tooltip.y - 100,
            zIndex: 999999,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              backgroundColor: '#0a0a0a',
              border: '2px solid #84CC16',
              borderRadius: '8px',
              padding: '12px 16px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.8)',
              minWidth: '200px',
              maxWidth: '280px',
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: '#84CC16',
                marginBottom: '6px',
                fontSize: '15px',
                lineHeight: '1.4',
              }}
            >
              {tooltip.point.plotPoint}
            </div>
            <div
              style={{
                color: '#d4d4d8',
                marginBottom: '8px',
                fontSize: '14px',
                lineHeight: '1.4',
              }}
            >
              {tooltip.point.emotion}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: '6px',
                  backgroundColor: '#27272a',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${tooltip.point.intensity * 10}%`,
                    height: '100%',
                    backgroundColor: tooltip.color,
                    borderRadius: '3px',
                  }}
                />
              </div>
              <span
                style={{
                  fontWeight: 700,
                  color: tooltip.color,
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                }}
              >
                {tooltip.point.intensity}/10
              </span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default EmotionalArcChart;
