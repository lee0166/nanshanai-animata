/**
 * Story Structure Diagram Component
 *
 * 故事结构图表组件
 * 展示剧本的三幕式结构或英雄之旅结构可视化
 *
 * @module components/ScriptAnalysis/StoryStructureDiagram
 * @version 1.0.0
 */

import React from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Tooltip,
} from '@heroui/react';
import {
  Layout,
  Play,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  Flag,
  HelpCircle,
} from 'lucide-react';
import type { StoryStructure } from '../../types';

interface StoryStructureDiagramProps {
  storyStructure?: StoryStructure;
  t: any;
}

/**
 * 结构类型显示名称
 */
const getStructureTypeName = (type: string): string => {
  const names: Record<string, string> = {
    'three_act': '三幕式结构',
    'hero_journey': '英雄之旅',
    'five_act': '五幕式结构',
    'other': '其他结构',
  };
  return names[type] || type;
};

/**
 * 结构类型图标
 */
const getStructureTypeIcon = (type: string) => {
  switch (type) {
    case 'three_act':
      return <Layout className="w-5 h-5" />;
    case 'hero_journey':
      return <TrendingUp className="w-5 h-5" />;
    case 'five_act':
      return <Flag className="w-5 h-5" />;
    default:
      return <HelpCircle className="w-5 h-5" />;
  }
};

/**
 * 幕信息配置
 */
const ACT_CONFIG = [
  {
    key: 'act1',
    title: '第一幕',
    subtitle: '设定 (25%)',
    icon: <Play className="w-4 h-4" />,
    color: 'primary',
    description: '介绍角色、设定背景、建立常态',
  },
  {
    key: 'act2a',
    title: '第二幕上',
    subtitle: '对抗 (25%)',
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'warning',
    description: '催化剂事件、主角踏上旅程、遇到盟友',
  },
  {
    key: 'act2b',
    title: '第二幕下',
    subtitle: '低谷 (25%)',
    icon: <TrendingDown className="w-4 h-4" />,
    color: 'danger',
    description: '中点转折、主角遭遇挫折、面临最大危机',
  },
  {
    key: 'act3',
    title: '第三幕',
    subtitle: '结局 (25%)',
    icon: <Target className="w-4 h-4" />,
    color: 'success',
    description: '高潮对决、问题解决、新的常态建立',
  },
];

/**
 * 故事结构图表组件
 */
export const StoryStructureDiagram: React.FC<StoryStructureDiagramProps> = ({
  storyStructure,
  t,
}) => {
  if (!storyStructure) {
    return (
      <Card className="w-full">
        <CardBody>
          <div className="text-center text-default-500 py-8">
            <Layout className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无故事结构数据</p>
            <p className="text-sm mt-1">请先解析剧本以获取结构分析</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  const { structureType, act1, act2a, act2b, act3, midpoint, climax } = storyStructure;

  // 检查是否有任何幕的内容
  const hasAnyContent = act1 || act2a || act2b || act3 || midpoint || climax;

  if (!hasAnyContent) {
    return (
      <Card className="w-full">
        <CardBody>
          <div className="text-center text-default-500 py-8">
            <Layout className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>故事结构信息不完整</p>
            <p className="text-sm mt-1">结构类型: {getStructureTypeName(structureType)}</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-success/10 rounded-lg">
            {getStructureTypeIcon(structureType)}
          </div>
          <div>
            <h3 className="text-lg font-bold">故事结构</h3>
            <p className="text-sm text-default-500">
              {getStructureTypeName(structureType)}
            </p>
          </div>
        </div>
        <Chip size="sm" variant="flat" color="success">
          {getStructureTypeName(structureType)}
        </Chip>
      </CardHeader>

      <CardBody className="pt-0">
        {/* 可视化时间线 */}
        <div className="relative mb-6">
          {/* 时间线背景 */}
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-content3 rounded-full -translate-y-1/2" />
          
          {/* 进度点 */}
          <div className="relative flex justify-between items-center py-4">
            {ACT_CONFIG.map((act, idx) => {
              const content = storyStructure[act.key as keyof StoryStructure] as string;
              const hasContent = !!content;
              
              return (
                <Tooltip
                  key={act.key}
                  content={
                    <div className="max-w-xs">
                      <div className="font-medium mb-1">{act.title}</div>
                      <div className="text-xs text-default-400 mb-2">{act.description}</div>
                      {content && (
                        <div className="text-sm">{content}</div>
                      )}
                    </div>
                  }
                >
                  <div
                    className={`relative flex flex-col items-center cursor-pointer transition-all duration-300 ${
                      hasContent ? 'opacity-100' : 'opacity-40'
                    }`}
                  >
                    {/* 节点圆圈 */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 transition-transform hover:scale-110 ${
                        hasContent
                          ? `bg-${act.color} border-${act.color} text-${act.color}-foreground`
                          : 'bg-content2 border-content3 text-default-500'
                      }`}
                      style={{
                        backgroundColor: hasContent ? undefined : 'var(--heroui-colors-content2)',
                        borderColor: hasContent ? `var(--heroui-colors-${act.color})` : undefined,
                        color: hasContent ? `var(--heroui-colors-${act.color}-foreground)` : undefined,
                      }}
                    >
                      {act.icon}
                    </div>
                    
                    {/* 标签 */}
                    <div className="mt-2 text-center">
                      <div className="text-xs font-medium">{act.title}</div>
                      <div className="text-xs text-default-400">{act.subtitle}</div>
                    </div>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* 详细内容 */}
        <div className="space-y-3">
          {ACT_CONFIG.map((act) => {
            const content = storyStructure[act.key as keyof StoryStructure] as string;
            if (!content) return null;

            return (
              <div
                key={act.key}
                className="bg-content2 rounded-lg p-3 hover:bg-content3 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-1.5 rounded-md flex-shrink-0`}
                    style={{
                      backgroundColor: `var(--heroui-colors-${act.color}-100)`,
                      color: `var(--heroui-colors-${act.color})`,
                    }}
                  >
                    {act.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{act.title}</span>
                      <span className="text-xs text-default-400">{act.subtitle}</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{content}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 关键转折点 */}
        {(midpoint || climax) && (
          <div className="mt-4 pt-4 border-t border-content3">
            <h4 className="text-sm font-medium text-default-500 mb-3">关键转折点</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {midpoint && (
                <div className="bg-warning/10 rounded-lg p-3 border border-warning/20">
                  <div className="flex items-center gap-2 text-warning mb-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-medium">中点转折</span>
                  </div>
                  <p className="text-sm text-foreground">{midpoint}</p>
                </div>
              )}
              {climax && (
                <div className="bg-danger/10 rounded-lg p-3 border border-danger/20">
                  <div className="flex items-center gap-2 text-danger mb-2">
                    <Target className="w-4 h-4" />
                    <span className="text-sm font-medium">高潮</span>
                  </div>
                  <p className="text-sm text-foreground">{climax}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default StoryStructureDiagram;
