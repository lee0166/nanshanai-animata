/**
 * Visual Style Card Component
 *
 * 视觉风格卡片组件
 * 展示剧本的视觉风格定义：美术指导、色彩方案、参考影片
 *
 * @module components/ScriptAnalysis/VisualStyleCard
 * @version 5.0.0
 */

import React from 'react';
import { Card, CardBody, CardHeader, Chip, Divider, Tooltip } from '@heroui/react';
import { Palette, Film, Camera, Sun, Brush, Clapperboard, User } from 'lucide-react';
import type { ScriptMetadata, VisualStyle, EraContext } from '../../types';

interface VisualStyleCardProps {
  metadata: ScriptMetadata;
  t: any;
}

const ColorBlock: React.FC<{ color: string; index: number }> = ({ color, index }) => {
  const isHex = color.startsWith('#');
  const displayColor = isHex ? color : `#${color}`;

  return (
    <Tooltip content={color}>
      <div
        className="w-7 h-7 rounded-md border border-content3 shadow-sm cursor-pointer transition-transform hover:scale-110"
        style={{ backgroundColor: displayColor }}
        aria-label={`颜色 ${index + 1}: ${color}`}
      />
    </Tooltip>
  );
};

export const VisualStyleCard: React.FC<VisualStyleCardProps> = ({ metadata, t }) => {
  const { visualStyle, eraContext, references } = metadata;

  if (!visualStyle && !eraContext) {
    return (
      <Card className="w-full h-full bg-gradient-to-br from-content1 to-content2 border-none flex flex-col">
        <CardBody>
          <div className="text-center text-default-500 py-4">
            <Palette className="w-8 h-8 mx-auto mb-2 opacity-50 text-primary" />
            <p className="text-sm">暂无视觉风格信息</p>
            <p className="text-sm mt-0.5">请先解析剧本</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full bg-gradient-to-br from-content1 to-content2 border-none flex flex-col">
      <CardHeader className="flex items-center gap-2 pb-1 pt-3">
        <div className="p-1.5 bg-primary/15 rounded-lg">
          <Palette className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-bold">视觉风格</h3>
          <p className="text-sm text-default-500">美术指导与色彩</p>
        </div>
      </CardHeader>

      <CardBody className="pt-1 space-y-3 flex-1 flex flex-col">
        {visualStyle?.artStyle && (
          <div>
            <div className="flex items-center gap-1.5 text-default-500 mb-1.5">
              <Brush className="w-3.5 h-3.5" />
              <span className="text-sm font-bold">美术风格</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Chip size="sm" classNames={{ base: 'bg-content2 text-foreground border-content3', content: 'text-sm' }}>
                {visualStyle.artStyle}
              </Chip>
              {visualStyle.artDirection && (
                <span className="text-sm text-default-500 truncate">{visualStyle.artDirection}</span>
              )}
            </div>
          </div>
        )}

        {visualStyle?.colorPalette && visualStyle.colorPalette.length > 0 && (
          <>
            {visualStyle?.artStyle && <Divider className="my-2" />}
            <div>
              <div className="flex items-center gap-1.5 text-default-500 mb-1.5">
                <Palette className="w-3.5 h-3.5" />
                <span className="text-sm font-bold">主色调</span>
                {visualStyle.colorMood && (
                  <Chip size="sm" variant="flat" classNames={{ base: 'bg-content2 text-foreground border-content3', content: 'text-sm' }}>
                    {visualStyle.colorMood}
                  </Chip>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {visualStyle.colorPalette.slice(0, 6).map((color, idx) => (
                  <ColorBlock key={idx} color={color} index={idx} />
                ))}
              </div>
            </div>
          </>
        )}

        {(visualStyle?.cinematography || visualStyle?.lightingStyle) && (
          <>
            {(visualStyle?.artStyle || (visualStyle?.colorPalette && visualStyle.colorPalette.length > 0)) && <Divider className="my-2" />}
            <div>
              <div className="grid grid-cols-1 gap-2">
                {visualStyle.cinematography && (
                  <div>
                    <div className="flex items-center gap-1.5 text-default-500 mb-1">
                      <Camera className="w-3.5 h-3.5" />
                      <span className="text-sm font-bold">摄影</span>
                    </div>
                    <p className="text-sm text-foreground line-clamp-1">{visualStyle.cinematography}</p>
                  </div>
                )}
                {visualStyle.lightingStyle && (
                  <div>
                    <div className="flex items-center gap-1.5 text-default-500 mb-1">
                      <Sun className="w-3.5 h-3.5" />
                      <span className="text-sm font-bold">光影</span>
                    </div>
                    <p className="text-sm text-foreground line-clamp-1">{visualStyle.lightingStyle}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {eraContext && (
          <>
            {(visualStyle?.artStyle || (visualStyle?.colorPalette && visualStyle.colorPalette.length > 0) || visualStyle?.cinematography || visualStyle?.lightingStyle) && <Divider className="my-2" />}
            <div>
              <div className="flex items-center gap-1.5 text-default-500 mb-1.5">
                <Clapperboard className="w-3.5 h-3.5" />
                <span className="text-sm font-bold">时代背景</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {eraContext.era && (
                  <Chip size="sm" variant="flat" classNames={{ base: 'bg-content2 text-foreground border-content3', content: 'text-sm' }}>
                    {eraContext.era}
                  </Chip>
                )}
                {eraContext.location && (
                  <Chip size="sm" variant="flat" classNames={{ base: 'bg-content2 text-foreground border-content3', content: 'text-sm' }}>
                    {eraContext.location}
                  </Chip>
                )}
                {eraContext.season && (
                  <Chip size="sm" variant="flat" classNames={{ base: 'bg-content2 text-foreground border-content3', content: 'text-sm' }}>
                    {eraContext.season}
                  </Chip>
                )}
              </div>
            </div>
          </>
        )}

        <div className="flex-1">
          {references && (
            <>
              {(visualStyle?.artStyle || (visualStyle?.colorPalette && visualStyle.colorPalette.length > 0) || visualStyle?.cinematography || visualStyle?.lightingStyle || eraContext) && <Divider className="my-2" />}
              <div>
                <div className="flex items-center gap-1.5 text-default-500 mb-1.5">
                  <Film className="w-3.5 h-3.5" />
                  <span className="text-sm font-bold">参考</span>
                </div>

                {references.films && references.films.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {references.films.slice(0, 3).map((film, idx) => (
                      <Chip
                        key={idx}
                        size="sm"
                        variant="flat"
                        classNames={{ base: 'bg-content2 text-foreground border-content3', content: 'text-sm' }}
                        startContent={<Film className="w-2.5 h-2.5 text-primary" />}
                      >
                        {film}
                      </Chip>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

export default VisualStyleCard;
