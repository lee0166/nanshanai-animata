/**
 * Story Overview Card Component
 *
 * 故事概览卡片组件
 * 展示剧本的核心故事信息：梗概、核心冲突、主题思想
 *
 * @module components/ScriptAnalysis/StoryOverview
 * @version 4.0.0
 */

import React from 'react';
import { Card, CardBody, CardHeader, Chip, Divider, Tooltip } from '@heroui/react';
import { BookOpen, Target, Lightbulb, Quote, Sparkles } from 'lucide-react';
import type { ScriptMetadata } from '../../types';

interface StoryOverviewCardProps {
  metadata: ScriptMetadata;
  t: any;
}

export const StoryOverviewCard: React.FC<StoryOverviewCardProps> = ({ metadata, t }) => {
  const { synopsis, logline, coreConflict, theme, title, genre, tone } = metadata;

  return (
    <Card className="w-full h-full bg-gradient-to-br from-content1 to-content2 border-none">
      <CardHeader className="flex items-center gap-2 pb-1 pt-3">
        <div className="p-1.5 bg-primary/15 rounded-lg">
          <BookOpen className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-bold">故事概览</h3>
          <p className="text-sm text-default-500">核心故事信息</p>
        </div>
      </CardHeader>

      <CardBody className="pt-1 space-y-2">
        {logline && (
          <div className="bg-content2 rounded-lg p-2.5 border border-content3">
            <div className="flex items-center gap-1.5 text-primary mb-1">
              <Quote className="w-3 h-3" />
              <span className="text-base font-medium">一句话简介</span>
            </div>
            <p className="text-base text-foreground italic">"{logline}"</p>
          </div>
        )}

        {synopsis && (
          <div>
            <div className="flex items-center gap-1.5 text-default-500 mb-1">
              <BookOpen className="w-3 h-3" />
              <span className="text-base font-medium">故事梗概</span>
            </div>
            <p className="text-base text-foreground leading-relaxed line-clamp-4">{synopsis}</p>
          </div>
        )}

        <Divider className="my-1.5" />

        {coreConflict && (
          <div>
            <div className="flex items-center gap-1.5 text-default-500 mb-1">
              <Target className="w-3 h-3" />
              <span className="text-base font-medium">核心冲突</span>
            </div>
            <p className="text-base text-foreground line-clamp-2">{coreConflict}</p>
          </div>
        )}

        {theme && theme.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-default-500 mb-1">
              <Lightbulb className="w-3 h-3" />
              <span className="text-base font-medium">主题思想</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {theme.map((t, idx) => (
                <Chip
                  key={idx}
                  size="sm"
                  variant="flat"
                  classNames={{ base: 'bg-content2 text-foreground border-content3', content: 'text-sm' }}
                  startContent={<Sparkles className="w-2.5 h-2.5 text-primary" />}
                >
                  {t}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <Divider className="my-1.5" />
        
        <div className="flex flex-wrap gap-1">
          {genre && (
            <Tooltip content="剧本类型/题材">
              <Chip size="sm" variant="flat" classNames={{ base: 'bg-content2 text-foreground border-content3', content: 'text-sm' }}>
                {genre}
              </Chip>
            </Tooltip>
          )}
          {tone && (
            <Tooltip content="整体基调">
              <Chip size="sm" variant="flat" classNames={{ base: 'bg-content2 text-foreground border-content3', content: 'text-sm' }}>
                {tone}
              </Chip>
            </Tooltip>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

export default StoryOverviewCard;
