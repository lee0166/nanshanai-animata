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
  X,
  Minimize2,
} from 'lucide-react';
import type { ParseStage } from '../../types';

export interface ScriptParseProgressProps {
  isOpen: boolean;
  currentStage: ParseStage;
  progress: number;
  stageProgress: number;
  message?: string;
  elapsedTime?: number;
  estimatedRemainingTime?: number;
  subTaskInfo?: {
    current: number;
    total: number;
    currentName?: string;
  };
  canCancel?: boolean;
  onCancel?: () => void;
  onMinimize?: () => void;
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
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center       
                  transition-colors duration-300
                  ${isCompleted ? 'bg-success' : ''}
                  ${isCurrent ? 'bg-primary' : ''}
                  ${isPending ? 'bg-content3' : ''}
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

              <span
                className={`
                  mt-2 text-xs font-medium
                  ${isCompleted || isCurrent ? 'text-foreground' : 'text-default-500'}
                `}
              >
                {stage.label}
              </span>

              {isCurrent && (
                <motion.div
                  className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full"
                  layoutId="currentStageIndicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </motion.div>

            {index < stages.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 bg-content3 relative overflow-hidden">
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

const SubTaskList: React.FC<{
  current: number;
  total: number;
  currentName?: string;
}> = ({ current, total, currentName }) => {
  if (total <= 0) return null;

  const progress = (current / total) * 100;

  return (
    <div className="mt-4 p-4 bg-content2/50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-default-500">子任务进度</span>
        <span className="text-sm font-medium text-foreground">
          {current} / {total}
        </span>
      </div>

      <div className="h-2 bg-content3 rounded-full overflow-hidden">
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
          <div className="w-px h-4 bg-content4" />
          <div className="flex items-center gap-1.5">
            <span>预计剩余: {formatDuration(estimatedRemainingTime * 1000)}</span>
          </div>
        </>
      )}
    </div>
  );
};

export const ScriptParseProgress: React.FC<ScriptParseProgressProps> = React.memo(
  ({
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
    if (import.meta.env.DEV) {
      console.log('[ScriptParseProgress] 渲染:', {
        isOpen,
        currentStage,
        progress,
        stageProgress,
        message,
      });
    }

    if (!isOpen) return null;

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
          <Card className="w-full max-w-2xl bg-white dark:bg-content1 border-content3">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">剧本解析</h3>
                  <p className="text-sm text-default-500 mt-0.5">{message || '正在处理...'}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-primary">{Math.round(progress)}%</span>

                  {onMinimize && (
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      onPress={onMinimize}
                      className="text-default-500 hover:text-foreground"
                      aria-label="最小化"
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
                      className="text-default-500 hover:text-danger"
                      aria-label="取消解析"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <StageIndicator
                stages={STAGES}
                currentStage={currentStage}
                completedStages={completedStages}
              />

              <div className="mb-4">
                <p className="text-sm font-medium mb-2">总进度: {Math.round(progress)}%</p>
                <Progress
                  value={progress}
                  color="success"
                  size="lg"
                  className="w-full"
                  aria-label={`总进度 ${Math.round(progress)}%`}
                />
              </div>

              {currentStage !== 'completed' && currentStage !== 'error' && (
                <div className="mb-4">
                  <p className="text-sm font-medium mb-2">
                    当前阶段 ({currentStage}): {Math.round(stageProgress)}%
                  </p>
                  <Progress
                    value={stageProgress}
                    color="warning"
                    size="md"
                    className="w-full"
                    aria-label={`当前阶段进度 ${Math.round(stageProgress)}%`}
                  />
                </div>
              )}

              {subTaskInfo && subTaskInfo.total > 0 && (
                <SubTaskList
                  current={subTaskInfo.current}
                  total={subTaskInfo.total}
                  currentName={subTaskInfo.currentName}
                />
              )}

              <TimeEstimate
                elapsedTime={elapsedTime}
                estimatedRemainingTime={estimatedRemainingTime}
              />

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-content3">
                <div className="text-xs text-default-500">
                  {currentStage === 'completed'
                    ? '解析完成！'
                    : currentStage === 'error'
                      ? '解析出错'
                      : '解析将在后台继续，请勿关闭浏览器'}
                </div>

                <div className="flex items-center gap-2">
                  {onBackground && currentStage !== 'completed' && currentStage !== 'error' && (
                    <Button variant="flat" size="sm" onPress={onBackground}>
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
  },
  (prevProps, nextProps) => {
    return (
      prevProps.isOpen === nextProps.isOpen &&
      prevProps.currentStage === nextProps.currentStage &&
      prevProps.progress === nextProps.progress &&
      prevProps.stageProgress === nextProps.stageProgress &&
      prevProps.message === nextProps.message &&
      prevProps.elapsedTime === nextProps.elapsedTime &&
      prevProps.estimatedRemainingTime === nextProps.estimatedRemainingTime &&
      JSON.stringify(prevProps.subTaskInfo) === JSON.stringify(nextProps.subTaskInfo)
    );
  }
);

export default ScriptParseProgress;
