/**
 * Story Overview Card Component
 *
 * 故事概览卡片组件
 * 展示剧本的核心故事信息：梗概、核心冲突、主题思想
 *
 * @module components/ScriptAnalysis/StoryOverviewCard
 * @version 1.0.0
 */

import React from 'react';
import { Card, CardBody, CardHeader, Chip, Divider, Tooltip } from '@heroui/react';
import { BookOpen, Target, Lightbulb, Quote, Sparkles } from 'lucide-react';
import type { ScriptMetadata } from '../../types';

interface StoryOverviewCardProps {
  metadata: ScriptMetadata;
  t: any;
}

/**
 * 故事概览卡片组件
 */
export const StoryOverviewCard: React.FC<StoryOverviewCardProps> = ({ metadata, t }) => {
  const { synopsis, logline, coreConflict, theme, title, genre, tone } = metadata;

  return (
    <Card className="w-full">
      <CardHeader className="flex items-center gap-3 pb-2">
        <div className="p-2 bg-primary/10 rounded-lg">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-bold">故事概览</h3>
          <p className="text-sm text-default-500">核心故事信息与主题</p>
        </div>
      </CardHeader>

      <CardBody className="pt-0 space-y-4">
        {/* 一句话简介 */}
        {logline && (
          <div className="bg-content2 rounded-lg p-4">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Quote className="w-4 h-4" />
              <span className="text-sm font-medium">一句话简介</span>
            </div>
            <p className="text-sm text-foreground italic">"{logline}"</p>
          </div>
        )}

        {/* 故事梗概 */}
        {synopsis && (
          <div>
            <div className="flex items-center gap-2 text-default-500 mb-2">
              <BookOpen className="w-4 h-4" />
              <span className="text-sm font-medium">故事梗概</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{synopsis}</p>
          </div>
        )}

        <Divider />

        {/* 核心冲突 */}
        {coreConflict && (
          <div>
            <div className="flex items-center gap-2 text-danger mb-2">
              <Target className="w-4 h-4" />
              <span className="text-sm font-medium">核心冲突</span>
            </div>
            <p className="text-sm text-foreground">{coreConflict}</p>
          </div>
        )}

        {/* 主题思想 */}
        {theme && theme.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-warning mb-2">
              <Lightbulb className="w-4 h-4" />
              <span className="text-sm font-medium">主题思想</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {theme.map((t, idx) => (
                <Chip
                  key={idx}
                  size="sm"
                  variant="flat"
                  color="warning"
                  startContent={<Sparkles className="w-3 h-3" />}
                >
                  {t}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* 类型与基调 */}
        <Divider />
        <div className="flex flex-wrap gap-2">
          {genre && (
            <Tooltip content="剧本类型/题材">
              <Chip size="sm" variant="flat" className="bg-primary/20 text-primary">
                {genre}
              </Chip>
            </Tooltip>
          )}
          {tone && (
            <Tooltip content="整体基调">
              <Chip size="sm" variant="flat" color="secondary">
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
