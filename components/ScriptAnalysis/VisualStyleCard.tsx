/**
 * Visual Style Card Component
 *
 * 视觉风格卡片组件
 * 展示剧本的视觉风格定义：美术指导、色彩方案、参考影片
 *
 * @module components/ScriptAnalysis/VisualStyleCard
 * @version 1.0.0
 */

import React from 'react';
import { Card, CardBody, CardHeader, Chip, Divider, Tooltip } from '@heroui/react';
import { Palette, Film, Camera, Sun, Brush, Clapperboard, User } from 'lucide-react';
import type { ScriptMetadata, VisualStyle, EraContext } from '../../types';

interface VisualStyleCardProps {
  metadata: ScriptMetadata;
  t: any;
}

/**
 * 颜色块组件
 */
const ColorBlock: React.FC<{ color: string; index: number }> = ({ color, index }) => {
  // 判断颜色是否为十六进制
  const isHex = color.startsWith('#');
  const displayColor = isHex ? color : `#${color}`;

  return (
    <Tooltip content={color}>
      <div
        className="w-10 h-10 rounded-lg border-2 border-content3 shadow-sm cursor-pointer transition-transform hover:scale-110"
        style={{ backgroundColor: displayColor }}
        aria-label={`颜色 ${index + 1}: ${color}`}
      />
    </Tooltip>
  );
};

/**
 * 视觉风格卡片组件
 */
export const VisualStyleCard: React.FC<VisualStyleCardProps> = ({ metadata, t }) => {
  const { visualStyle, eraContext, references } = metadata;

  if (!visualStyle && !eraContext) {
    return (
      <Card className="w-full">
        <CardBody>
          <div className="text-center text-default-500 py-8">
            <Palette className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无视觉风格信息</p>
            <p className="text-sm mt-1">请先解析剧本以获取视觉风格分析</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex items-center gap-3 pb-2">
        <div className="p-2 bg-secondary/10 rounded-lg">
          <Palette className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <h3 className="text-lg font-bold">视觉风格</h3>
          <p className="text-sm text-default-500">美术指导与色彩方案</p>
        </div>
      </CardHeader>

      <CardBody className="pt-0 space-y-4">
        {/* 美术风格 */}
        {visualStyle?.artStyle && (
          <div>
            <div className="flex items-center gap-2 text-default-500 mb-2">
              <Brush className="w-4 h-4" />
              <span className="text-sm font-medium">美术风格</span>
            </div>
            <div className="flex items-center gap-2">
              <Chip size="md" color="secondary" variant="flat">
                {visualStyle.artStyle}
              </Chip>
              {visualStyle.artDirection && (
                <span className="text-sm text-default-500">{visualStyle.artDirection}</span>
              )}
            </div>
            {visualStyle.artStyleDescription && (
              <p className="text-sm text-foreground mt-2 leading-relaxed">
                {visualStyle.artStyleDescription}
              </p>
            )}
          </div>
        )}

        {/* 色彩方案 */}
        {visualStyle?.colorPalette && visualStyle.colorPalette.length > 0 && (
          <>
            <Divider />
            <div>
              <div className="flex items-center gap-2 text-default-500 mb-3">
                <Palette className="w-4 h-4" />
                <span className="text-sm font-medium">主色调</span>
                {visualStyle.colorMood && (
                  <Chip size="sm" variant="flat" color="primary">
                    {visualStyle.colorMood}
                  </Chip>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {visualStyle.colorPalette.map((color, idx) => (
                  <ColorBlock key={idx} color={color} index={idx} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* 摄影与光影 */}
        {(visualStyle?.cinematography || visualStyle?.lightingStyle) && (
          <>
            <Divider />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visualStyle.cinematography && (
                <div>
                  <div className="flex items-center gap-2 text-default-500 mb-2">
                    <Camera className="w-4 h-4" />
                    <span className="text-sm font-medium">摄影风格</span>
                  </div>
                  <p className="text-sm text-foreground">{visualStyle.cinematography}</p>
                </div>
              )}
              {visualStyle.lightingStyle && (
                <div>
                  <div className="flex items-center gap-2 text-default-500 mb-2">
                    <Sun className="w-4 h-4" />
                    <span className="text-sm font-medium">光影风格</span>
                  </div>
                  <p className="text-sm text-foreground">{visualStyle.lightingStyle}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* 时代背景 */}
        {eraContext && (
          <>
            <Divider />
            <div>
              <div className="flex items-center gap-2 text-default-500 mb-3">
                <Clapperboard className="w-4 h-4" />
                <span className="text-sm font-medium">时代背景</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {eraContext.era && (
                  <Chip size="sm" variant="flat" color="default">
                    {eraContext.era}
                  </Chip>
                )}
                {eraContext.location && (
                  <Chip size="sm" variant="flat" color="default">
                    {eraContext.location}
                  </Chip>
                )}
                {eraContext.season && (
                  <Chip size="sm" variant="flat" color="success">
                    {eraContext.season}
                  </Chip>
                )}
              </div>
              {eraContext.eraDescription && (
                <p className="text-sm text-foreground leading-relaxed">
                  {eraContext.eraDescription}
                </p>
              )}
            </div>
          </>
        )}

        {/* 参考影片与导演 */}
        {references && (
          <>
            <Divider />
            <div>
              <div className="flex items-center gap-2 text-default-500 mb-3">
                <Film className="w-4 h-4" />
                <span className="text-sm font-medium">参考风格</span>
              </div>

              {references.films && references.films.length > 0 && (
                <div className="mb-2">
                  <span className="text-xs text-default-400 mb-1 block">参考影片</span>
                  <div className="flex flex-wrap gap-2">
                    {references.films.map((film, idx) => (
                      <Chip
                        key={idx}
                        size="sm"
                        variant="flat"
                        color="primary"
                        startContent={<Film className="w-3 h-3" />}
                      >
                        {film}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {references.directors && references.directors.length > 0 && (
                <div>
                  <span className="text-xs text-default-400 mb-1 block">参考导演</span>
                  <div className="flex flex-wrap gap-2">
                    {references.directors.map((director, idx) => (
                      <Chip
                        key={idx}
                        size="sm"
                        variant="flat"
                        color="secondary"
                        startContent={<User className="w-3 h-3" />}
                      >
                        {director}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
};

export default VisualStyleCard;
