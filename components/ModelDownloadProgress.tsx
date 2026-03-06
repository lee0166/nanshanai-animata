/**
 * ModelDownloadProgress - 模型下载进度组件
 *
 * 显示模型下载进度、失败提示和手动下载指引
 *
 * @module components/ModelDownloadProgress
 * @version 2.0.0
 */

import React from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Progress,
  Code
} from '@heroui/react';
import { Brain, AlertCircle, CheckCircle, Terminal, Info } from 'lucide-react';
import { ModelDownloadState } from '../services/parsing/EmbeddingService';

interface ModelDownloadProgressProps {
  isOpen: boolean;
  downloadState: ModelDownloadState;
  onRetry: () => void;
  onCancel: () => void;
  onUseStandardMode: () => void;
  manualGuide: {
    modelName: string;
    downloadCommand: string;
    targetPath: string;
    instructions: string[];
    requirements: string[];
  };
}

export const ModelDownloadProgress: React.FC<ModelDownloadProgressProps> = ({
  isOpen,
  downloadState,
  onRetry,
  onCancel,
  onUseStandardMode,
  manualGuide
}) => {
  const renderContent = () => {
    switch (downloadState.status) {
      case 'checking':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <Brain className="w-16 h-16 text-primary animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">正在检查本地模型...</p>
              <p className="text-sm text-gray-500">
                检查本地缓存中是否存在模型文件
              </p>
            </div>
            <Progress
              isIndeterminate
              className="w-full"
              color="primary"
              size="md"
            />
          </div>
        );

      case 'downloading':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <Brain className="w-16 h-16 text-primary animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">正在加载 AI 模型...</p>
              <p className="text-sm text-gray-500">
                从本地缓存加载模型文件
              </p>
            </div>
            <Progress
              value={downloadState.progress}
              className="w-full"
              color="primary"
              size="md"
            />
            <div className="flex justify-between text-sm text-gray-500">
              <span>{downloadState.progress}%</span>
              <span>加载中...</span>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <CheckCircle className="w-16 h-16 text-success" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-medium text-success">模型加载完成</p>
              <p className="text-sm text-gray-500">
                AI 模型已准备就绪，可以开始使用智能记忆功能
              </p>
            </div>
            <div className="bg-success-50 dark:bg-success-900/20 rounded-lg p-4">
              <p className="text-sm text-success-700 dark:text-success-400">
                正在初始化，请稍候...
              </p>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <AlertCircle className="w-16 h-16 text-danger" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-medium text-danger">模型加载失败</p>
              <p className="text-sm text-gray-500">
                本地模型文件不存在，需要预先下载
              </p>
            </div>

            {/* 错误详情 */}
            {downloadState.error && (
              <div className="bg-danger-50 dark:bg-danger-900/20 rounded-lg p-3">
                <p className="text-sm text-danger-700 dark:text-danger-400">
                  {downloadState.error}
                </p>
              </div>
            )}

            {/* 解决步骤 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                <p className="font-medium text-sm">解决步骤</p>
              </div>

              {/* 命令示例 */}
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">在终端运行：</span>
                  <Button
                    size="sm"
                    variant="flat"
                    className="h-6 text-xs"
                    onPress={() => navigator.clipboard.writeText(manualGuide.downloadCommand)}
                  >
                    复制
                  </Button>
                </div>
                <Code className="text-sm text-green-400 bg-transparent">
                  {manualGuide.downloadCommand}
                </Code>
              </div>

              {/* 详细步骤 */}
              <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 list-decimal list-inside">
                {manualGuide.instructions.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>

              {/* 环境要求 */}
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-blue-500" />
                  <p className="font-medium text-sm">环境要求</p>
                </div>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                  {manualGuide.requirements.map((req, index) => (
                    <li key={index}>{req}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="flat" onPress={onUseStandardMode} className="flex-1">
                使用标准模式
              </Button>
              <Button
                color="primary"
                onPress={onCancel}
                className="flex-1"
              >
                我知道了
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      hideCloseButton={downloadState.status === 'checking' || downloadState.status === 'downloading'}
      size="md"
      backdrop="blur"
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          智能记忆模型
        </ModalHeader>
        <ModalBody className="pb-6">
          {renderContent()}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default ModelDownloadProgress;
