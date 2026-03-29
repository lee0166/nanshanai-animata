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
    <Card className="w-full bg-gradient-to-br from-content1 to-content2 border-none flex flex-col">
      <CardHeader className="flex items-center gap-2 pb-2 pt-3">
        <div className="p-1.5 bg-primary/15 rounded-lg">
          <BookOpen className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-bold">故事概览</h3>
          <p className="text-sm text-default-500">核心故事信息</p>
        </div>
      </CardHeader>

      <CardBody className="pt-1 space-y-3 flex-1 flex flex-col">
        {logline && (
          <div>
            <div className="flex items-center gap-1.5 text-default-500 mb-1.5">
              <Quote className="w-3.5 h-3.5" />
              <span className="text-sm font-bold">一句话简介</span>
            </div>
            <p className="text-sm text-foreground italic leading-relaxed">"{logline}"</p>
          </div>
        )}

        {synopsis && (
          <div>
            <div className="flex items-center gap-1.5 text-default-500 mb-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span className="text-sm font-bold">故事梗概</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed line-clamp-4">{synopsis}</p>
          </div>
        )}

        {(logline || synopsis) && (coreConflict || theme || genre || tone) && (
          <Divider className="my-2" />
        )}

        {coreConflict && (
          <div>
            <div className="flex items-center gap-1.5 text-default-500 mb-1.5">
              <Target className="w-3.5 h-3.5" />
              <span className="text-sm font-bold">核心冲突</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed line-clamp-2">{coreConflict}</p>
          </div>
        )}

        {theme && theme.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-default-500 mb-1.5">
              <Lightbulb className="w-3.5 h-3.5" />
              <span className="text-sm font-bold">主题思想</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
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

        {(coreConflict || theme) && (genre || tone) && (
          <Divider className="my-2" />
        )}
        
        {(genre || tone) && (
          <div>
            <div className="flex flex-wrap gap-1.5">
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
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default StoryOverviewCard;
