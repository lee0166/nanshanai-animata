import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RefinementReportCard } from './RefinementReportCard';
import { IterativeRefinementResult } from '../../services/parsing/refinement/IterativeRefinementEngine';

describe('RefinementReportCard', () => {
  const mockResult: IterativeRefinementResult = {
    success: true,
    totalIterations: 2,
    initialQualityScore: 65,
    finalQualityScore: 82,
    totalQualityImprovement: 17,
    iterationResults: [
      {
        iteration: 1,
        qualityScoreBefore: 65,
        qualityScoreAfter: 75,
        consistencyResult: {
          passed: false,
          violations: [
            {
              id: 'vio-1',
              type: 'character_inconsistency',
              severity: 'warning',
              message: '角色描述不一致',
              autoFixable: true,
              confidence: 0.8,
            },
          ],
        },
        qualityResult: {
          overallScore: 75,
          scores: [],
          grade: 'B',
          passed: true,
          criticalIssues: [],
          improvementSuggestions: [],
          timestamp: new Date().toISOString(),
          duration: 100,
        },
        refinementResult: {
          success: true,
          appliedActions: [
            {
              id: 'action-1',
              type: 'add_description',
              targetType: 'character',
              targetId: 'char-1',
              description: '添加角色描述',
              proposedValue: '详细描述',
              confidence: 0.9,
              autoSafe: true,
              requiresConfirmation: false,
            },
          ],
          skippedActions: [],
          failedActions: [],
          changes: [],
          qualityImprovement: 10,
        },
        improvement: 10,
        executionTime: 1500,
      },
      {
        iteration: 2,
        qualityScoreBefore: 75,
        qualityScoreAfter: 82,
        consistencyResult: {
          passed: true,
          violations: [],
        },
        qualityResult: {
          overallScore: 82,
          scores: [],
          grade: 'A',
          passed: true,
          criticalIssues: [],
          improvementSuggestions: [],
          timestamp: new Date().toISOString(),
          duration: 80,
        },
        refinementResult: {
          success: true,
          appliedActions: [
            {
              id: 'action-2',
              type: 'update_description',
              targetType: 'scene',
              targetId: 'scene-1',
              description: '更新场景描述',
              proposedValue: '新描述',
              confidence: 0.85,
              autoSafe: true,
              requiresConfirmation: false,
            },
          ],
          skippedActions: [],
          failedActions: [],
          changes: [],
          qualityImprovement: 7,
        },
        improvement: 7,
        executionTime: 1200,
      },
    ],
    finalMetadata: {
      title: '测试剧本',
      format: 'movie',
    },
    stats: {
      totalChecks: 2,
      totalViolationsFound: 1,
      autoFixedViolations: 1,
      totalActionsGenerated: 2,
      totalActionsApplied: 2,
      totalActionsSkipped: 0,
      totalActionsFailed: 0,
    },
    report: '# 迭代优化报告\n\n## 执行摘要\n- **总迭代次数**: 2',
  };

  const mockT = {
    scriptParser: {
      refinementReport: '迭代优化报告',
    },
  };

  it('should render component without crashing', () => {
    render(<RefinementReportCard result={mockResult} t={mockT} />);
    expect(screen.getByText('迭代优化报告')).toBeInTheDocument();
  });

  it('should display success status', () => {
    render(<RefinementReportCard result={mockResult} t={mockT} />);
    expect(screen.getByText('优化成功')).toBeInTheDocument();
  });

  it('should display overview tab by default', () => {
    render(<RefinementReportCard result={mockResult} t={mockT} />);
    expect(screen.getByText('概览')).toBeInTheDocument();
    expect(screen.getByText('迭代详情')).toBeInTheDocument();
    expect(screen.getByText('完整报告')).toBeInTheDocument();
  });

  it('should display iteration count', () => {
    render(<RefinementReportCard result={mockResult} t={mockT} />);
    expect(screen.getByText('迭代次数')).toBeInTheDocument();
  });

  it('should display quality scores', () => {
    render(<RefinementReportCard result={mockResult} t={mockT} />);
    expect(screen.getByText('初始分数')).toBeInTheDocument();
    expect(screen.getByText('最终分数')).toBeInTheDocument();
  });

  it('should display stats', () => {
    render(<RefinementReportCard result={mockResult} t={mockT} />);
    expect(screen.getByText('发现违规')).toBeInTheDocument();
    expect(screen.getByText('应用修正')).toBeInTheDocument();
  });

  it('should handle unsuccessful refinement', () => {
    const unsuccessfulResult = {
      ...mockResult,
      success: false,
      totalQualityImprovement: 0,
    };
    render(<RefinementReportCard result={unsuccessfulResult} t={mockT} />);
    expect(screen.getByText('优化完成')).toBeInTheDocument();
  });

  it('should handle empty iteration results', () => {
    const emptyResult = {
      ...mockResult,
      iterationResults: [],
      totalIterations: 0,
    };
    render(<RefinementReportCard result={emptyResult} t={mockT} />);
    expect(screen.getByText('迭代优化报告')).toBeInTheDocument();
  });
});
