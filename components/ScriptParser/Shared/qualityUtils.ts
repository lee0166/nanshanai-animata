/**
 * 获取评分颜色
 * 标准：≥90 优秀(绿)，≥75 良好(蓝)，≥60 及格(黄)，<60 不及格(红)
 */
export const getScoreColor = (score: number): string => {
  if (score >= 90) return 'text-success';
  if (score >= 75) return 'text-primary';
  if (score >= 60) return 'text-warning';
  return 'text-danger';
};

/**
 * 获取等级 (A-F)
 */
export const getGrade = (score: number): string => {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
};

/**
 * 获取等级颜色
 */
export const getGradeColor = (grade: string): string => {
  const colors: Record<string, string> = {
    A: 'bg-success text-success-foreground',
    B: 'bg-primary text-primary-foreground',
    C: 'bg-warning text-warning-foreground',
    D: 'bg-warning-500 text-warning-foreground',
    F: 'bg-danger text-danger-foreground',
  };
  return colors[grade] || 'bg-default text-default-foreground';
};

/**
 * 格式化时长显示（秒）
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}分${secs}秒`;
};

/**
 * 格式化时长显示（毫秒）
 */
export const formatDurationMs = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}秒`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}分${secs}秒`;
};

/**
 * 获取严重程度颜色
 */
export const getSeverityColor = (severity: 'error' | 'warning' | 'info'): string => {
  switch (severity) {
    case 'error':
      return 'bg-danger-50 text-danger';
    case 'warning':
      return 'bg-warning-50 text-warning';
    default:
      return 'bg-primary-50 text-primary';
  }
};
