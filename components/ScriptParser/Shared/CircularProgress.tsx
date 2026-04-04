import React from 'react';
import { getScoreColor, getGrade, getGradeColor } from './qualityUtils';

interface CircularProgressProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showGrade?: boolean;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  score,
  size = 140,
  strokeWidth = 10,
  showGrade = true,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;
  const grade = getGrade(score);
  const colorClass = getScoreColor(score);

  const getStrokeColor = () => {
    if (score >= 90) return '#22c55e';
    if (score >= 75) return '#3b82f6';
    if (score >= 60) return '#eab308';
    return '#ef4444';
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#374151"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={getStrokeColor()}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${colorClass}`}>{score}</span>
          <span className="text-xs text-slate-400">总体评分</span>
        </div>
      </div>
      {showGrade && (
        <div className="mt-3">
          <span
            className={`px-4 py-1.5 rounded-full text-sm font-semibold ${getGradeColor(grade)}`}
          >
            等级 {grade}
          </span>
        </div>
      )}
    </div>
  );
};
