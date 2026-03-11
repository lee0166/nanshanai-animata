/**
 * DurationBudgetDependencyGraph - 时长预算依赖关系可视化
 *
 * 可视化展示功能开关之间的依赖关系
 *
 * @module components/DurationBudget/DurationBudgetDependencyGraph
 * @version 1.0.0
 */

import React from 'react';
import { ArrowRight, Clock, Sparkles } from 'lucide-react';

export interface DurationBudgetConfig {
  platform: string;
  pace: string;
  useDurationBudget: boolean;
  useProductionPrompt: boolean;
  useShotQC: boolean;
}

export interface DurationBudgetDependencyGraphProps {
  config: DurationBudgetConfig;
  t: any;
}

export const DurationBudgetDependencyGraph: React.FC<DurationBudgetDependencyGraphProps> = ({
  config,
  t,
}) => {
  const { useDurationBudget, useProductionPrompt } = config;

  // 计算依赖状态
  const getDependencyStatus = () => {
    if (useDurationBudget && useProductionPrompt) {
      return 'satisfied';
    } else if (useDurationBudget && !useProductionPrompt) {
      return 'missing';
    }
    return 'inactive';
  };

  const status = getDependencyStatus();

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-900 mb-4">
      <div className="flex items-center justify-center gap-4">
        {/* 时长预算节点 */}
        <div
          className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all duration-300 ${
            useDurationBudget
              ? 'bg-primary/10 border-primary'
              : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
          }`}
        >
          <div
            className={`p-2 rounded-full mb-2 ${
              useDurationBudget ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <Clock className="w-5 h-5 text-white" />
          </div>
          <span
            className={`text-xs font-bold uppercase tracking-wider ${
              useDurationBudget ? 'text-primary' : 'text-slate-400'
            }`}
          >
            {t.settings.durationBudget?.durationBudget || '时长预算'}
          </span>
          <span
            className={`text-[10px] mt-1 ${
              useDurationBudget ? 'text-primary/70' : 'text-slate-400'
            }`}
          >
            {useDurationBudget
              ? t.settings.durationBudget?.enabled || '已启用'
              : t.settings.durationBudget?.disabled || '未启用'}
          </span>
        </div>

        {/* 依赖箭头 */}
        <div className="flex flex-col items-center">
          <div
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
              status === 'satisfied'
                ? 'bg-success/20 text-success'
                : status === 'missing'
                  ? 'bg-warning/20 text-warning'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
            }`}
          >
            <span>{t.settings.durationBudget?.dependsOn || '依赖'}</span>
            <ArrowRight className="w-3 h-3" />
          </div>
          <div
            className={`h-0.5 w-16 mt-2 ${
              status === 'satisfied'
                ? 'bg-success'
                : status === 'missing'
                  ? 'bg-warning'
                  : 'bg-slate-300 dark:bg-slate-600'
            }`}
          />
        </div>

        {/* 生产级Prompt节点 */}
        <div
          className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all duration-300 ${
            useProductionPrompt
              ? 'bg-success/10 border-success'
              : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
          }`}
        >
          <div
            className={`p-2 rounded-full mb-2 ${
              useProductionPrompt ? 'bg-success' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span
            className={`text-xs font-bold uppercase tracking-wider ${
              useProductionPrompt ? 'text-success' : 'text-slate-400'
            }`}
          >
            {t.settings.durationBudget?.productionPrompt || '生产级Prompt'}
          </span>
          <span
            className={`text-[10px] mt-1 ${
              useProductionPrompt ? 'text-success/70' : 'text-slate-400'
            }`}
          >
            {useProductionPrompt
              ? t.settings.durationBudget?.enabled || '已启用'
              : t.settings.durationBudget?.disabled || '未启用'}
          </span>
        </div>
      </div>

      {/* 状态说明 */}
      <div className="mt-4 text-center">
        {status === 'satisfied' && (
          <p className="text-xs text-success font-medium">
            ✅ {t.settings.durationBudget?.dependencySatisfied || '依赖关系满足，功能已生效'}
          </p>
        )}
        {status === 'missing' && (
          <p className="text-xs text-warning font-medium">
            ⚠️{' '}
            {t.settings.durationBudget?.dependencyMissing || '依赖关系未满足，请启用生产级Prompt'}
          </p>
        )}
        {status === 'inactive' && (
          <p className="text-xs text-slate-400 font-medium">
            {t.settings.durationBudget?.dependencyInactive || '启用时长预算以查看依赖关系'}
          </p>
        )}
      </div>
    </div>
  );
};

export default DurationBudgetDependencyGraph;
