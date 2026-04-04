import React from 'react';
import { getScoreColor } from './qualityUtils';

interface RadarDimension {
  name: string;
  score: number;
}

interface RadarChartProps {
  dimensions: RadarDimension[];
  size?: number;
}

export const RadarChart: React.FC<RadarChartProps> = ({ dimensions, size = 240 }) => {
  const numSides = dimensions.length;
  const center = size / 2;
  const radius = size * 0.35;

  const getStrokeColor = () => {
    const avgScore = dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length;
    if (avgScore >= 90) return '#22c55e';
    if (avgScore >= 75) return '#3b82f6';
    if (avgScore >= 60) return '#eab308';
    return '#ef4444';
  };

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
      const labelRadius = radius + 25;
      const x = center + labelRadius * Math.cos(angle);
      const y = center + labelRadius * Math.sin(angle);
      const textAnchor =
        Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
      const dominantBaseline =
        Math.abs(Math.sin(angle)) < 0.1 ? 'middle' : Math.sin(angle) > 0 ? 'hanging' : 'auto';

      return (
        <g key={i}>
          <text
            x={x}
            y={y}
            textAnchor={textAnchor}
            dominantBaseline={dominantBaseline}
            className="text-xs fill-slate-400"
          >
            {dim.name}
          </text>
          <text
            x={x}
            y={y + 14}
            textAnchor={textAnchor}
            dominantBaseline={dominantBaseline}
            className={`text-xs font-mono font-semibold ${getScoreColor(dim.score)}`}
          >
            {dim.score}
          </text>
        </g>
      );
    });
  };

  return (
    <div className="flex items-center justify-center">
      <svg width={size} height={size} className="overflow-visible">
        {[0.25, 0.5, 0.75, 1].map((scale, i) => (
          <polygon
            key={i}
            points={getPolygonPoints(scale)}
            fill="none"
            stroke="#374151"
            strokeWidth="1"
            strokeDasharray={i === 3 ? '' : '2,2'}
          />
        ))}

        {dimensions.map((_, i) => {
          const angle = (i * 2 * Math.PI) / numSides - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="#374151" strokeWidth="1" />
          );
        })}

        <path
          d={`M ${getDataPoints()} Z`}
          fill={getStrokeColor()}
          fillOpacity="0.2"
          stroke={getStrokeColor()}
          strokeWidth="2"
          className="transition-all duration-1000"
        />

        {dimensions.map((dim, i) => {
          const angle = (i * 2 * Math.PI) / numSides - Math.PI / 2;
          const x = center + radius * (dim.score / 100) * Math.cos(angle);
          const y = center + radius * (dim.score / 100) * Math.sin(angle);
          return <circle key={i} cx={x} cy={y} r="4" fill={getStrokeColor()} />;
        })}

        {getLabels()}
      </svg>
    </div>
  );
};
