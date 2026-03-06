/**
 * VectorMemoryToggle - 智能记忆功能开关组件
 * 
 * 使用方式：
 * <VectorMemoryToggle 
 *   wordCount={120000}
 *   onToggle={(enabled) => setVectorMemoryEnabled(enabled)}
 * />
 */

import React, { useState, useEffect } from 'react';
import { Switch, Tooltip, Chip } from '@heroui/react';
import { Brain, AlertCircle, CheckCircle } from 'lucide-react';
import { vectorMemoryConfig } from '../services/parsing/VectorMemoryConfig';

interface VectorMemoryToggleProps {
  wordCount: number;  // 小说字数
  onToggle?: (enabled: boolean) => void | Promise<void>;  // 开关回调（支持异步）
  showAutoDetect?: boolean;  // 是否显示自动检测提示
}

export const VectorMemoryToggle: React.FC<VectorMemoryToggleProps> = ({
  wordCount,
  onToggle,
  showAutoDetect = true
}) => {
  const [enabled, setEnabled] = useState(false);
  const [isLongNovel, setIsLongNovel] = useState(false);
  const [serverStatus, setServerStatus] = useState<'unknown' | 'running' | 'stopped'>('unknown');

  // 初始化
  useEffect(() => {
    const config = vectorMemoryConfig.getConfig();
    setEnabled(config.enabled);
    setIsLongNovel(wordCount >= config.autoEnableThreshold);
    
    // 检查服务器状态
    checkServerStatus();
  }, [wordCount]);

  // 检查ChromaDB服务器状态
  const checkServerStatus = async () => {
    const isRunning = await vectorMemoryConfig.checkServerStatus();
    setServerStatus(isRunning ? 'running' : 'stopped');
  };

  // 处理开关
  const handleToggle = async (newEnabled: boolean) => {
    // 先更新UI状态
    setEnabled(newEnabled);
    
    // 调用父组件的回调（可能包含异步操作，如模型下载）
    if (onToggle) {
      try {
        await onToggle(newEnabled);
      } catch (error) {
        // 如果回调失败（如下载失败），恢复开关状态
        console.error('[VectorMemoryToggle] Toggle failed:', error);
        setEnabled(!newEnabled);
      }
    }
  };

  // 空内容时的提示
  if (wordCount === 0) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg opacity-60">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-200 rounded-lg">
            <Brain className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <div className="font-medium text-gray-500">智能记忆</div>
            <div className="text-sm text-gray-400">
              上传或输入内容后可用
            </div>
          </div>
        </div>
        <Switch isSelected={false} isDisabled size="sm" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 主开关 */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Brain className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="font-medium flex items-center gap-2">
              智能记忆
              {isLongNovel && (
                <Chip size="sm" color="warning" variant="flat">
                  推荐
                </Chip>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {enabled 
                ? '已启用，将使用AI保持角色一致性'
                : isLongNovel 
                  ? '提升长篇小说角色和场景一致性'
                  : '当前文本适合标准解析（可选）'
              }
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* 服务器状态指示 */}
          {enabled && (
            <Tooltip content={serverStatus === 'running' ? '服务正常' : '服务未启动'}>
              <div className={`w-2 h-2 rounded-full ${
                serverStatus === 'running' ? 'bg-green-500' : 'bg-red-500'
              }`} />
            </Tooltip>
          )}
          
          <Switch
            isSelected={enabled}
            onValueChange={handleToggle}
            size="sm"
          />
        </div>
      </div>

      {/* 详细信息 */}
      {enabled && (
        <div className="text-sm text-gray-600 space-y-1 pl-12">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            <span>自动关联分散的角色信息</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            <span>保持跨章节场景一致性</span>
          </div>
          {serverStatus === 'stopped' && (
            <div className="flex items-center gap-2 text-orange-600">
              <AlertCircle size={14} />
              <span>ChromaDB服务未运行，请启动服务</span>
            </div>
          )}
        </div>
      )}

      {/* 字数提示 */}
      {showAutoDetect && wordCount > 0 && (
        <div className={`flex items-center gap-2 text-sm p-2 rounded ${
          isLongNovel && !enabled 
            ? 'text-amber-600 bg-amber-50' 
            : 'text-gray-500 bg-gray-50'
        }`}>
          <AlertCircle size={16} />
          <span>
            {isLongNovel && !enabled 
              ? `检测到长篇小说（${Math.round(wordCount / 10000)}万字），建议启用智能记忆`
              : `当前字数：${wordCount.toLocaleString()} 字`
            }
          </span>
        </div>
      )}
    </div>
  );
};

export default VectorMemoryToggle;
