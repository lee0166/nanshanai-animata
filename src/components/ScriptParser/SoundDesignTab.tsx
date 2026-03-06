/**
 * SoundDesignTab - 声音设计Tab组件
 * 
 * 展示基于情绪曲线和分镜音效的声音设计方案
 */

import React, { useMemo } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Chip,
  Progress,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from '@heroui/react';
import { Music, Volume2, Wind, Zap, BarChart3 } from 'lucide-react';
import type { ScriptMetadata, Shot } from '@/types';
import {
  soundDesigner,
  type SoundDesignAnalysis,
} from '@/src/services/parsing/professional';

interface SoundDesignTabProps {
  metadata: ScriptMetadata;
  shots: Shot[];
}

export const SoundDesignTab: React.FC<SoundDesignTabProps> = ({
  metadata,
  shots,
}) => {
  // 使用 useMemo 缓存分析结果
  const analysis = useMemo(() => {
    return soundDesigner.analyze(metadata, shots);
  }, [metadata, shots]);

  // 渲染统计卡片
  const renderStatsCards = () => {
    const { statistics } = analysis;
    const stats = [
      {
        label: '总分镜数',
        value: statistics.totalShots,
        icon: <BarChart3 size={20} />,
        color: 'primary',
      },
      {
        label: '含音效分镜',
        value: statistics.shotsWithSound,
        icon: <Volume2 size={20} />,
        color: 'success',
      },
      {
        label: '环境音类型',
        value: statistics.uniqueAmbientSounds,
        icon: <Wind size={20} />,
        color: 'warning',
      },
      {
        label: '音效类型',
        value: statistics.uniqueEffectSounds,
        icon: <Zap size={20} />,
        color: 'danger',
      },
    ];

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-default-50">
            <CardBody className="flex flex-row items-center gap-3 p-4">
              <div className={`p-2 rounded-lg bg-${stat.color}-100 text-${stat.color}-600`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-default-500">{stat.label}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  };

  // 渲染整体音景
  const renderOverallSoundscape = () => {
    const { overallSoundscape } = analysis;

    return (
      <Card className="mb-6">
        <CardHeader className="flex items-center gap-2">
          <Music size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">整体音景</h3>
        </CardHeader>
        <Divider />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-default-50 rounded-lg">
              <p className="text-sm text-default-500 mb-1">主导情绪</p>
              <p className="text-lg font-medium">{overallSoundscape.dominantMood}</p>
            </div>
            <div className="p-4 bg-default-50 rounded-lg">
              <p className="text-sm text-default-500 mb-1">背景音调</p>
              <p className="text-lg font-medium">{overallSoundscape.backgroundTone}</p>
            </div>
            <div className="p-4 bg-default-50 rounded-lg">
              <p className="text-sm text-default-500 mb-1">动态范围</p>
              <p className="text-lg font-medium">{overallSoundscape.dynamicRange}</p>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  };

  // 渲染情绪音乐映射表
  const renderEmotionalMusicMap = () => {
    const { emotionalMusicMap } = analysis;

    if (emotionalMusicMap.length === 0) {
      return (
        <Card className="mb-6">
          <CardHeader>
            <h3 className="text-lg font-semibold">情绪音乐映射</h3>
          </CardHeader>
          <CardBody>
            <p className="text-default-500 text-center py-8">
              暂无情绪曲线数据
            </p>
          </CardBody>
        </Card>
      );
    }

    return (
      <Card className="mb-6">
        <CardHeader className="flex items-center gap-2">
          <Music size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">情绪音乐映射</h3>
        </CardHeader>
        <Divider />
        <CardBody>
          <Table aria-label="情绪音乐映射表">
            <TableHeader>
              <TableColumn>情节点</TableColumn>
              <TableColumn>情绪</TableColumn>
              <TableColumn>强度</TableColumn>
              <TableColumn>推荐音乐</TableColumn>
              <TableColumn>色调</TableColumn>
            </TableHeader>
            <TableBody>
              {emotionalMusicMap.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.plotPoint}</p>
                      <p className="text-xs text-default-400">{item.percentage}%</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat">
                      {item.emotion}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={item.intensity * 10}
                        className="w-16"
                        size="sm"
                        color={item.intensity >= 7 ? 'danger' : item.intensity >= 4 ? 'warning' : 'success'}
                      />
                      <span className="text-sm">{item.intensity}/10</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{item.suggestedMusic}</p>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color="secondary">
                      {item.colorTone}
                    </Chip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    );
  };

  // 渲染声音调色板
  const renderSoundPalette = () => {
    const { soundPalette } = analysis;

    return (
      <Card>
        <CardHeader className="flex items-center gap-2">
          <Volume2 size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">声音调色板</h3>
        </CardHeader>
        <Divider />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 环境音 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Wind size={18} className="text-success" />
                <h4 className="font-medium">环境音</h4>
                <Chip size="sm" variant="flat">{soundPalette.ambientSounds.length}</Chip>
              </div>
              <div className="flex flex-wrap gap-2">
                {soundPalette.ambientSounds.length > 0 ? (
                  soundPalette.ambientSounds.map((sound, index) => (
                    <Chip key={index} size="sm" variant="flat" color="success">
                      {sound}
                    </Chip>
                  ))
                ) : (
                  <p className="text-sm text-default-400">暂无环境音</p>
                )}
              </div>
            </div>

            {/* 音效 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap size={18} className="text-warning" />
                <h4 className="font-medium">音效</h4>
                <Chip size="sm" variant="flat">{soundPalette.effectSounds.length}</Chip>
              </div>
              <div className="flex flex-wrap gap-2">
                {soundPalette.effectSounds.length > 0 ? (
                  soundPalette.effectSounds.map((sound, index) => (
                    <Chip key={index} size="sm" variant="flat" color="warning">
                      {sound}
                    </Chip>
                  ))
                ) : (
                  <p className="text-sm text-default-400">暂无音效</p>
                )}
              </div>
            </div>

            {/* 配乐主题 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Music size={18} className="text-danger" />
                <h4 className="font-medium">配乐主题</h4>
                <Chip size="sm" variant="flat">{soundPalette.musicThemes.length}</Chip>
              </div>
              <div className="flex flex-wrap gap-2">
                {soundPalette.musicThemes.length > 0 ? (
                  soundPalette.musicThemes.map((theme, index) => (
                    <Chip key={index} size="sm" variant="flat" color="danger">
                      {theme}
                    </Chip>
                  ))
                ) : (
                  <p className="text-sm text-default-400">暂无配乐主题</p>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      {renderStatsCards()}

      {/* 整体音景 */}
      {renderOverallSoundscape()}

      {/* 情绪音乐映射 */}
      {renderEmotionalMusicMap()}

      {/* 声音调色板 */}
      {renderSoundPalette()}
    </div>
  );
};

export default SoundDesignTab;
