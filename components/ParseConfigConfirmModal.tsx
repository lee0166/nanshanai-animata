/**
 * ParseConfigConfirmModal - 解析配置确认弹窗
 * 
 * 在解析前显示配置信息，让用户确认后再执行解析
 * 避免无意识的高成本操作
 * 
 * @module components/ParseConfigConfirmModal
 * @version 1.0.0
 */

import React from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Switch,
  Badge,
  Tooltip
} from '@heroui/react';
import { Brain, FileText, Coins, AlertTriangle, Info } from 'lucide-react';

interface ParseConfigConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  scriptTitle: string;
  wordCount: number;
  useVectorMemory: boolean;
  onVectorMemoryToggle: (enabled: boolean) => void;
  modelName: string;
  parseMode: string;
}

export const ParseConfigConfirmModal: React.FC<ParseConfigConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  scriptTitle,
  wordCount,
  useVectorMemory,
  onVectorMemoryToggle,
  modelName,
  parseMode
}) => {
  // 预估 Token 数量
  const estimateTokenCount = (wordCount: number, useVectorMemory: boolean) => {
    // 中文字符约 0.5-1 Token/字
    const baseTokens = Math.ceil(wordCount * 0.8);
    // 智能记忆会增加约 20% Token 消耗
    const multiplier = useVectorMemory ? 1.2 : 1.0;
    return Math.ceil(baseTokens * multiplier);
  };

  const estimatedTokens = estimateTokenCount(wordCount, useVectorMemory);
  const isLongText = wordCount > 50000;

  // 获取提示信息
  const getWarnings = () => {
    const warnings = [];

    if (isLongText) {
      warnings.push({
        type: 'warning' as const,
        icon: AlertTriangle,
        message: `检测到长篇小说（${Math.round(wordCount / 10000)}万字），解析将消耗较多 Token`
      });
    }

    if (isLongText && !useVectorMemory) {
      warnings.push({
        type: 'info' as const,
        icon: Info,
        message: '建议开启智能记忆，可提升长文本角色一致性'
      });
    }

    if (useVectorMemory) {
      warnings.push({
        type: 'info' as const,
        icon: Brain,
        message: '智能记忆需要下载 AI 模型（约 80MB），首次使用请耐心等待'
      });
    }

    return warnings;
  };

  const warnings = getWarnings();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            确认解析配置
          </div>
        </ModalHeader>

        <ModalBody className="space-y-4">
          {/* 小说信息 */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400">
              📄 小说信息
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">标题：</span>
                <span className="font-medium truncate max-w-[200px]">{scriptTitle || '未命名'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">字数：</span>
                <span className="font-medium">{wordCount.toLocaleString()} 字（约 {(wordCount / 10000).toFixed(1)} 万字）</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">预估 Token：</span>
                <Tooltip content="基于字数和智能记忆状态估算">
                  <span className="font-medium text-primary">~{estimatedTokens.toLocaleString()}</span>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* 解析配置 */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400">
              ⚙️ 解析配置
            </h4>

            {/* 智能记忆开关 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-blue-500" />
                <span className="text-sm">智能记忆</span>
              </div>
              <Switch
                isSelected={useVectorMemory}
                onValueChange={onVectorMemoryToggle}
                size="sm"
              />
            </div>

            {/* AI 模型 */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">AI 模型</span>
              <Badge variant="flat" size="sm">{modelName}</Badge>
            </div>

            {/* 解析模式 */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">解析模式</span>
              <Badge variant="flat" size="sm">{parseMode}</Badge>
            </div>
          </div>

          {/* 提示信息 */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((warning, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                    warning.type === 'warning'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                      : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  }`}
                >
                  <warning.icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{warning.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* 当前模式说明 */}
          <div className="text-xs text-gray-500 text-center">
            {useVectorMemory ? (
              <span>智能记忆已启用，将使用向量数据库存储语义信息，提升角色一致性</span>
            ) : (
              <span>使用标准解析模式</span>
            )}
          </div>
        </ModalBody>

        <ModalFooter className="flex justify-end gap-3">
          <Button variant="flat" onPress={onClose}>
            取消
          </Button>
          <Button color="primary" onPress={onConfirm}>
            开始解析
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ParseConfigConfirmModal;
