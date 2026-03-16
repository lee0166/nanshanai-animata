/**
 * ScriptParseProgress - 剧本解析进度展示组件
 *
 * 提供多阶段步骤条、子任务详情、时间预估等功能
 *
 * @module components/ScriptParser/ScriptParseProgress
 * @version 1.0.0
 */

import React from 'react';
import { Card, CardBody, Progress, Button } from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Users,
  Map,
  Box,
  Film,
  Sparkles,
  Clock,
  CheckCircle,
  Loader2,
  Circle,
  X,
  Minimize2,
} from 'lucide-react';
import type { ParseStage } from '../../types';

export interface ScriptParseProgressProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 当前阶段 */
  currentStage: ParseStage;
  /** 总进度 (0-100) */
  progress: number;
  /** 阶段进度 (0-100) */
  stageProgress: number;
  /** 状态消息 */
  message?: string;
  /** 已耗时 (毫秒) */
  elapsedTime?: number;
  /** 预估剩余时间 (秒) */
  estimatedRemainingTime?: number;
  /** 子任务信息 */
  subTaskInfo?: {
    current: number;
    total: number;
    currentName?: string;
  };
  /** 是否可取消 */
  canCancel?: boolean;
  /** 取消回调 */
  onCancel?: () => void;
  /** 最小化回调 */
  onMinimize?: () => void;
  /** 后台运行回调 */
  onBackground?: () => void;
}

interface StageConfig {
  key: ParseStage;
  label: string;
  icon: React.ElementType;
  description: string;
}

const STAGES: StageConfig[] = [
  { key: 'metadata', label: '元数据', icon: FileText, description: '提取剧本基本信息' },
  { key: 'characters', label: '角色', icon: Users, description: '分析角色特征' },
  { key: 'scenes', label: '场景', icon: Map, description: '规划场景布局' },
  { key: 'items', label: '物品', icon: Box, description: '提取重要道具' },
  { key: 'shots', label: '分镜', icon: Film, description: '生成分镜列表' },
  { key: 'refinement', label: '优化', icon: Sparkles, description: '优化解析结果' },
];

/**
 * 格式化时间显示
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return '< 1秒';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}分${minutes % 60}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

/**
 * 阶段指示器组件
 */
const StageIndicator: React.FC<{
  stages: StageConfig[];
  currentStage: ParseStage;
  completedStages: ParseStage[];
}> = ({ stages, currentStage, completedStages }) => {
  return (
    <div className="flex items-center justify-between w-full mb-6">
      {stages.map((stage, index) => {
        const isCompleted = completedStages.includes(stage.key);
        const isCurrent = stage.key === currentStage;
        const isPending = !isCompleted && !isCurrent;

        return (
          <React.Fragment key={stage.key}>
            <motion.div
              className="flex flex-col items-center relative"
              initial={false}
              animate={{ scale: isCurrent ? 1.05 : 1 }}
              transition={{ duration: 0.2 }}
            >
              {/* 阶段圆圈 */}
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  transition-colors duration-300
                  ${isCompleted ? 'bg-success' : ''}
                  ${isCurrent ? 'bg-primary' : ''}
                  ${isPending ? 'bg-slate-700' : ''}
                `}
              >
                {isCompleted ? (
                  <CheckCircle className="w-5 h-5 text-white" />
                ) : isCurrent ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <stage.icon className="w-5 h-5 text-slate-400" />
                )}
              </div>

              {/* 阶段标签 */}
              <span
                className={`
                  mt-2 text-xs font-medium
                  ${isCompleted || isCurrent ? 'text-foreground' : 'text-slate-500'}
                `}
              >
                {stage.label}
              </span>

              {/* 当前阶段指示器 */}
              {isCurrent && (
                <motion.div
                  className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full"
                  layoutId="currentStageIndicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </motion.div>

            {/* 连接线 */}
            {index < stages.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 bg-slate-700 relative overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-success"
                  initial={{ width: '0%' }}
                  animate={{
                    width: isCompleted ? '100%' : isCurrent ? '50%' : '0%',
                  }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/**
 * 子任务列表组件
 */
const SubTaskList: React.FC<{
  current: number;
  total: number;
  currentName?: string;
}> = ({ current, total, currentName }) => {
  if (total <= 0) return null;

  const progress = (current / total) * 100;

  return (
    <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-300">子任务进度</span>
        <span className="text-sm font-medium text-foreground">
          {current} / {total}
        </span>
      </div>

      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {currentName && (
        <motion.p
          key={currentName}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-sm text-slate-400 truncate"
        >
          当前: {currentName}
        </motion.p>
      )}
    </div>
  );
};

/**
 * 时间预估组件
 */
const TimeEstimate: React.FC<{
  elapsedTime?: number;
  estimatedRemainingTime?: number;
}> = ({ elapsedTime, estimatedRemainingTime }) => {
  if (!elapsedTime) return null;

  return (
    <div className="flex items-center gap-4 mt-4 text-sm text-slate-400">
      <div className="flex items-center gap-1.5">
        <Clock className="w-4 h-4" />
        <span>已耗时: {formatDuration(elapsedTime)}</span>
      </div>

      {estimatedRemainingTime && estimatedRemainingTime > 0 && (
        <>
          <div className="w-px h-4 bg-slate-600" />
          <div className="flex items-center gap-1.5">
            <span>预计剩余: {formatDuration(estimatedRemainingTime * 1000)}</span>
          </div>
        </>
      )}
    </div>
  );
};

/**
 * 主组件
 */
export const ScriptParseProgress: React.FC<ScriptParseProgressProps> = ({
  isOpen,
  currentStage,
  progress,
  stageProgress,
  message,
  elapsedTime,
  estimatedRemainingTime,
  subTaskInfo,
  canCancel = true,
  onCancel,
  onMinimize,
  onBackground,
}) => {
  if (!isOpen) return null;

  // 计算已完成阶段
  const completedStages = STAGES.filter((s, index) => {
    const currentIndex = STAGES.findIndex(st => st.key === currentStage);
    return index < currentIndex;
  }).map(s => s.key);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      >
        <Card className="w-full max-w-2xl bg-slate-900 border-slate-800">
          <CardBody className="p-6">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground">剧本解析</h3>
                <p className="text-sm text-slate-400 mt-0.5">{message || '正在处理...'}</p>
              </div>

              <div className="flex items-center gap-2">
                {/* 进度百分比 */}
                <span className="text-2xl font-bold text-primary">{Math.round(progress)}%</span>

                {/* 操作按钮 */}
                {onMinimize && (
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={onMinimize}
                    className="text-slate-400 hover:text-foreground"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </Button>
                )}

                {canCancel && onCancel && (
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={onCancel}
                    className="text-slate-400 hover:text-danger"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* 阶段指示器 */}
            <StageIndicator
              stages={STAGES}
              currentStage={currentStage}
              completedStages={completedStages}
            />

            {/* 主进度条 */}
            <div className="mb-4">
              <Progress
                value={progress}
                className="w-full"
                color="primary"
                size="md"
                aria-label="总进度"
                classNames={{
                  track: 'bg-slate-700',
                  indicator: 'bg-primary',
                }}
              />
            </div>

            {/* 当前阶段进度 */}
            {currentStage !== 'completed' && currentStage !== 'error' && (
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm text-slate-400">当前阶段:</span>
                <div className="flex-1">
                  <Progress
                    value={stageProgress}
                    className="w-full"
                    color="secondary"
                    size="sm"
                    aria-label="当前阶段进度"
                    classNames={{
                      track: 'bg-slate-800',
                      indicator: 'bg-secondary',
                    }}
                  />
                </div>
                <span className="text-sm text-slate-400 w-12 text-right">
                  {Math.round(stageProgress)}%
                </span>
              </div>
            )}

            {/* 子任务列表 */}
            {subTaskInfo && subTaskInfo.total > 0 && (
              <SubTaskList
                current={subTaskInfo.current}
                total={subTaskInfo.total}
                currentName={subTaskInfo.currentName}
              />
            )}

            {/* 时间预估 */}
            <TimeEstimate
              elapsedTime={elapsedTime}
              estimatedRemainingTime={estimatedRemainingTime}
            />

            {/* 底部操作 */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
              <div className="text-xs text-slate-500">
                {currentStage === 'completed'
                  ? '解析完成！'
                  : currentStage === 'error'
                    ? '解析出错'
                    : '解析将在后台继续，请勿关闭浏览器'}
              </div>

              <div className="flex items-center gap-2">
                {onBackground && currentStage !== 'completed' && currentStage !== 'error' && (
                  <Button
                    variant="flat"
                    size="sm"
                    onPress={onBackground}
                    title="隐藏弹窗，解析在后台继续运行"
                  >
                    隐藏窗口
                  </Button>
                )}

                {canCancel &&
                  onCancel &&
                  currentStage !== 'completed' &&
                  currentStage !== 'error' && (
                    <Button color="danger" variant="flat" size="sm" onPress={onCancel}>
                      取消
                    </Button>
                  )}

                {currentStage === 'completed' && (
                  <Button color="primary" size="sm" onPress={onCancel}>
                    完成
                  </Button>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};

export default ScriptParseProgress;
