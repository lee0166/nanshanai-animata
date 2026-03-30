/**
 * Story Structure Diagram Component
 *
 * 故事结构图表组件
 * 展示剧本的三幕式结构或英雄之旅结构可视化
 *
 * @module components/ScriptAnalysis/StoryStructureDiagram
 * @version 6.0.0
 */

import React from 'react';
import { Card, CardBody, CardHeader, Chip, Tooltip, Divider } from '@heroui/react';
import {
  Layout,
  Play,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  Flag,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { StoryStructure } from '../../types';

interface StoryStructureDiagramProps {
  storyStructure?: StoryStructure;
  t: any;
}

const getStructureTypeName = (type: string): string => {
  const names: Record<string, string> = {
    three_act: '三幕式结构',
    hero_journey: '英雄之旅',
    five_act: '五幕式结构',
    other: '其他结构',
  };
  return names[type] || type;
};

const getStructureTypeDescription = (type: string): string => {
  const descriptions: Record<string, string> = {
    three_act: '经典叙事结构，将故事分为设定、对抗、结局三部分',
    hero_journey: '英雄冒险模式，包含召唤、启程、试炼、归来等阶段',
    five_act: '更细腻的五幕划分，适用于复杂叙事',
    other: '自定义结构形式',
  };
  return descriptions[type] || '自定义故事结构';
};

const getStructureTypeIcon = (type: string) => {
  switch (type) {
    case 'three_act':
      return <Layout className="w-4 h-4 text-primary" />;
    case 'hero_journey':
      return <TrendingUp className="w-4 h-4 text-primary" />;
    case 'five_act':
      return <Flag className="w-4 h-4 text-primary" />;
    default:
      return <HelpCircle className="w-4 h-4 text-primary" />;
  }
};

const ACT_CONFIG = [
  {
    key: 'act1',
    title: '第一幕',
    subtitle: '设定',
    icon: <Play className="w-3.5 h-3.5 text-primary" />,
    description: '介绍角色、设定背景、建立常态',
  },
  {
    key: 'act2a',
    title: '第二幕上',
    subtitle: '对抗',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-primary" />,
    description: '催化剂事件、主角踏上旅程、遇到盟友',
  },
  {
    key: 'act2b',
    title: '第二幕下',
    subtitle: '低谷',
    icon: <TrendingDown className="w-3.5 h-3.5 text-primary" />,
    description: '中点转折、主角遭遇挫折、面临最大危机',
  },
  {
    key: 'act3',
    title: '第三幕',
    subtitle: '结局',
    icon: <Target className="w-3.5 h-3.5 text-primary" />,
    description: '高潮对决、问题解决、新的常态建立',
  },
];

export const StoryStructureDiagram: React.FC<StoryStructureDiagramProps> = ({
  storyStructure,
  t,
}) => {
  if (!storyStructure) {
    return (
      <Card className="w-full bg-gradient-to-br from-content1 to-content2 border-none">
        <CardBody>
          <div className="text-center text-default-500 py-8">
            <Layout className="w-12 h-12 mx-auto mb-3 opacity-50 text-primary" />
            <p className="text-base">暂无故事结构数据</p>
            <p className="text-base mt-1">请先解析剧本</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  const { structureType, act1, act2a, act2b, act3, midpoint, climax } = storyStructure;

  const hasAnyContent = act1 || act2a || act2b || act3 || midpoint || climax;

  if (!hasAnyContent) {
    return (
      <Card className="w-full bg-gradient-to-br from-content1 to-content2 border-none">
        <CardBody>
          <div className="text-center text-default-500 py-8">
            <Layout className="w-12 h-12 mx-auto mb-3 opacity-50 text-primary" />
            <p className="text-base">故事结构信息不完整</p>
            <p className="text-base mt-1">结构类型: {getStructureTypeName(structureType)}</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-gradient-to-br from-content1 to-content2 border-none relative flex flex-col">
      <CardHeader className="flex items-center justify-between pb-1 pt-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/15 rounded-lg">
            {getStructureTypeIcon(structureType)}
          </div>
          <div>
            <h3 className="text-lg font-bold">故事结构</h3>
            <p className="text-sm text-default-500">{getStructureTypeDescription(structureType)}</p>
          </div>
        </div>
        <Chip size="sm" variant="flat" className="bg-primary/10 text-primary border-none">
          {getStructureTypeName(structureType)}
        </Chip>
      </CardHeader>

      <CardBody className="pt-2 pb-4 space-y-3 flex-1 flex flex-col">
        <div>
          <div className="relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-content3 rounded-full -translate-y-1/2" />

            <div className="relative flex justify-between items-center py-4">
              {ACT_CONFIG.map((act, idx) => {
                const content = storyStructure[act.key as keyof StoryStructure] as string;
                const hasContent = !!content;

                return (
                  <Tooltip
                    key={act.key}
                    content={
                      <div className="max-w-xs">
                        <div className="font-medium text-base mb-0.5">{act.title}</div>
                        <div className="text-sm text-default-400 mb-1">{act.description}</div>
                        {content && <div className="text-sm">{content}</div>}
                      </div>
                    }
                  >
                    <div
                      className={`relative flex flex-col items-center cursor-pointer transition-all duration-300 ${
                        hasContent ? 'opacity-100' : 'opacity-40'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 transition-transform hover:scale-110 ${
                          hasContent
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'bg-content2 border-content3 text-default-500'
                        }`}
                        style={{
                          backgroundColor: hasContent
                            ? 'var(--heroui-colors-primary)'
                            : 'var(--heroui-colors-content2)',
                          borderColor: hasContent
                            ? 'var(--heroui-colors-primary)'
                            : 'var(--heroui-colors-content3)',
                          color: hasContent ? 'var(--heroui-colors-primary-foreground)' : undefined,
                        }}
                      >
                        {act.icon}
                      </div>

                      <div className="mt-2 text-center">
                        <div className="text-sm font-medium">{act.title}</div>
                        <div className="text-xs text-default-400">{act.subtitle}</div>
                      </div>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>

        {(midpoint || climax) && (
          <>
            <Divider className="my-2" />
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {midpoint && (
                  <div>
                    <div className="flex items-center gap-2 text-default-500 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-sm font-bold">中点转折</span>
                    </div>
                    <p className="text-sm text-foreground">{midpoint}</p>
                  </div>
                )}
                {climax && (
                  <div>
                    <div className="flex items-center gap-2 text-default-500 mb-1">
                      <Target className="w-4 h-4" />
                      <span className="text-sm font-bold">高潮</span>
                    </div>
                    <p className="text-sm text-foreground">{climax}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {(midpoint || climax) && <Divider className="my-2" />}

        <div className="flex-1">
          <div className="flex items-center gap-2 text-default-500 mb-1.5">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm font-bold">结构说明</span>
          </div>
          <p className="text-sm text-default-400 leading-relaxed">
            {structureType === 'three_act'
              ? '三幕式结构是最经典的叙事模式：第一幕建立世界，第二幕展开冲突，第三幕解决问题并收尾。'
              : structureType === 'hero_journey'
                ? '英雄之旅模式描述了主角从平凡到非凡的冒险过程，包含召唤、启程、试炼、归来等关键阶段。'
                : structureType === 'five_act'
                  ? '五幕式结构将故事更细分为五个部分，提供更丰富的叙事节奏和冲突层次。'
                  : '自定义结构形式，根据故事特点灵活组织叙事节奏。'}
          </p>
        </div>
      </CardBody>
    </Card>
  );
};

export default StoryStructureDiagram;
