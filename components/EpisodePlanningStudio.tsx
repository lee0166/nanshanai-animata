/**
 * EpisodePlanningStudio - 分集规划工作室
 *
 * Kmeng AI Animata 2.0 核心组件
 * 允许用户在分镜生成完成后灵活规划分集方案
 *
 * @module components/EpisodePlanningStudio
 * @version 1.0.0
 */

import React, { useState, useMemo } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Badge,
  Tabs,
  Tab,
  ScrollShadow,
  Divider,
  Tooltip,
  Input,
  Textarea,
} from '@heroui/react';
import {
  Film,
  Clock,
  Plus,
  Trash2,
  GripVertical,
  Settings,
  CheckCircle2,
  AlertCircle,
  Info,
  Target,
  Layers,
} from 'lucide-react';
import { Shot, EpisodeInfo, EpisodePlan } from '../types';
import PlatformStandardService from '../services/parsing/PlatformStandardService';

interface EpisodePlanningStudioProps {
  shots: Shot[];
  onEpisodePlanChange: (plan: EpisodePlan) => void;
  initialPlan?: EpisodePlan;
}

interface DraggedShot {
  shot: Shot;
  fromEpisode: number;
}

export const EpisodePlanningStudio: React.FC<EpisodePlanningStudioProps> = ({
  shots,
  onEpisodePlanChange,
  initialPlan,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('douyin');
  const [episodePlan, setEpisodePlan] = useState<EpisodePlan>(() => {
    if (initialPlan) return initialPlan;
    // 默认创建单集
    return createDefaultEpisodePlan(shots);
  });
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [draggedShot, setDraggedShot] = useState<DraggedShot | null>(null);

  // 创建默认分集方案（单集）
  function createDefaultEpisodePlan(allShots: Shot[]): EpisodePlan {
    const totalDuration = allShots.reduce((sum, shot) => sum + (shot.duration || 3), 0);
    return {
      id: 'default',
      totalEpisodes: 1,
      episodes: [
        {
          episodeNumber: 1,
          title: '第 1 集',
          sceneNames: Array.from(new Set(allShots.map(s => s.sceneName))),
          estimatedDuration: totalDuration,
          estimatedShotCount: allShots.length,
          summary: '完整故事',
          isClimax: false,
        },
      ],
      description: '默认单集方案',
      totalDuration,
    };
  }

  // 计算每集的分镜
  const shotsByEpisode = useMemo(() => {
    const result: Record<number, Shot[]> = {};
    episodePlan.episodes.forEach(ep => {
      result[ep.episodeNumber] = shots.filter(shot => ep.sceneNames.includes(shot.sceneName));
    });
    return result;
  }, [shots, episodePlan]);

  // 获取平台标准
  const platformStandard = PlatformStandardService.getStandard(selectedPlatform);

  // 添加新集
  const addEpisode = () => {
    const newEpisodeNumber = episodePlan.totalEpisodes + 1;
    const newEpisode: EpisodeInfo = {
      episodeNumber: newEpisodeNumber,
      title: `第${newEpisodeNumber}集`,
      sceneNames: [],
      estimatedDuration: 0,
      estimatedShotCount: 0,
      summary: '',
      isClimax: false,
    };
    const newPlan: EpisodePlan = {
      ...episodePlan,
      totalEpisodes: newEpisodeNumber,
      episodes: [...episodePlan.episodes, newEpisode],
    };
    setEpisodePlan(newPlan);
    onEpisodePlanChange(newPlan);
  };

  // 删除集
  const deleteEpisode = (episodeNumber: number) => {
    if (episodePlan.totalEpisodes <= 1) return;
    const newEpisodes = episodePlan.episodes.filter(ep => ep.episodeNumber !== episodeNumber);
    // 重新编号
    newEpisodes.forEach((ep, index) => {
      ep.episodeNumber = index + 1;
      ep.title = `第${index + 1}集`;
    });
    const newPlan: EpisodePlan = {
      ...episodePlan,
      totalEpisodes: newEpisodes.length,
      episodes: newEpisodes,
    };
    setEpisodePlan(newPlan);
    onEpisodePlanChange(newPlan);
    if (selectedEpisode === episodeNumber) {
      setSelectedEpisode(1);
    }
  };

  // 更新集信息
  const updateEpisode = (episodeNumber: number, updates: Partial<EpisodeInfo>) => {
    const newEpisodes = episodePlan.episodes.map(ep =>
      ep.episodeNumber === episodeNumber ? { ...ep, ...updates } : ep
    );
    const newPlan: EpisodePlan = {
      ...episodePlan,
      episodes: newEpisodes,
    };
    setEpisodePlan(newPlan);
    onEpisodePlanChange(newPlan);
  };

  // 处理拖拽开始
  const handleDragStart = (shot: Shot, fromEpisode: number) => {
    setDraggedShot({ shot, fromEpisode });
  };

  // 处理拖拽放下
  const handleDrop = (toEpisode: number) => {
    if (!draggedShot) return;

    const { shot, fromEpisode } = draggedShot;
    if (fromEpisode === toEpisode) {
      setDraggedShot(null);
      return;
    }

    // 从原集移除场景
    const fromEpisodeInfo = episodePlan.episodes.find(ep => ep.episodeNumber === fromEpisode);
    const toEpisodeInfo = episodePlan.episodes.find(ep => ep.episodeNumber === toEpisode);

    if (!fromEpisodeInfo || !toEpisodeInfo) {
      setDraggedShot(null);
      return;
    }

    // 更新原集
    const newFromEpisode = {
      ...fromEpisodeInfo,
      sceneNames: fromEpisodeInfo.sceneNames.filter(name => name !== shot.sceneName),
      estimatedShotCount: fromEpisodeInfo.sceneNames.filter(name => name !== shot.sceneName).length,
      estimatedDuration: shotsByEpisode[fromEpisode]
        .filter(s => s.sceneName !== shot.sceneName)
        .reduce((sum, s) => sum + (s.duration || 3), 0),
    };

    // 更新目标集
    const newToEpisode = {
      ...toEpisodeInfo,
      sceneNames: [...toEpisodeInfo.sceneNames, shot.sceneName],
      estimatedShotCount: toEpisodeInfo.sceneNames.length + 1,
      estimatedDuration: toEpisodeInfo.estimatedDuration + (shot.duration || 3),
    };

    const newEpisodes = episodePlan.episodes.map(ep => {
      if (ep.episodeNumber === fromEpisode) return newFromEpisode;
      if (ep.episodeNumber === toEpisode) return newToEpisode;
      return ep;
    });

    const newPlan: EpisodePlan = {
      ...episodePlan,
      episodes: newEpisodes,
      totalDuration: episodePlan.episodes.reduce((sum, ep) => sum + ep.estimatedDuration, 0),
    };

    setEpisodePlan(newPlan);
    onEpisodePlanChange(newPlan);
    setDraggedShot(null);
  };

  // 检查分集是否符合平台标准
  const checkEpisodeCompliance = (episode: EpisodeInfo) => {
    if (!platformStandard) return { compliant: true, issues: [] };

    const issues: string[] = [];
    const duration = episode.estimatedDuration / 60; // 转换为分钟

    // 检查时长
    const [minDuration, maxDuration] = platformStandard.episodeDurationRange;
    if (duration < minDuration / 60) {
      issues.push(`时长过短（${duration.toFixed(1)}分钟 < ${minDuration / 60}分钟）`);
    }
    if (duration > maxDuration / 60) {
      issues.push(`时长过长（${duration.toFixed(1)}分钟 > ${maxDuration / 60}分钟）`);
    }

    // 检查分镜数
    if (episode.estimatedShotCount < platformStandard.shotsPerEpisodeRange[0]) {
      issues.push(
        `分镜数过少（${episode.estimatedShotCount} < ${platformStandard.shotsPerEpisodeRange[0]}）`
      );
    }
    if (episode.estimatedShotCount > platformStandard.shotsPerEpisodeRange[1]) {
      issues.push(
        `分镜数过多（${episode.estimatedShotCount} > ${platformStandard.shotsPerEpisodeRange[1]}）`
      );
    }

    return {
      compliant: issues.length === 0,
      issues,
    };
  };

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* 顶部工具栏 */}
      <Card>
        <CardBody className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">目标平台</span>
              </div>
              <select
                value={selectedPlatform}
                onChange={e => setSelectedPlatform(e.target.value)}
                className="text-sm border border-default-300 rounded px-2 py-1 bg-transparent"
              >
                <option value="douyin">抖音</option>
                <option value="kuaishou">快手</option>
                <option value="bilibili">B 站</option>
                <option value="premium">精品短剧</option>
              </select>
              {platformStandard && (
                <Chip size="sm" variant="flat" color="primary">
                  {platformStandard.platform === 'douyin' && '抖音'}
                  {platformStandard.platform === 'kuaishou' && '快手'}
                  {platformStandard.platform === 'bilibili' && 'B 站'}
                  {platformStandard.platform === 'premium' && '精品短剧'}
                </Chip>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Tooltip content="添加新集">
                <Button
                  size="sm"
                  color="primary"
                  onPress={addEpisode}
                  startContent={<Plus className="w-4 h-4" />}
                >
                  添加分集
                </Button>
              </Tooltip>
              <Button
                size="sm"
                variant="light"
                onPress={() => {
                  const newPlan = createDefaultEpisodePlan(shots);
                  setEpisodePlan(newPlan);
                  onEpisodePlanChange(newPlan);
                  setSelectedEpisode(1);
                }}
              >
                重置为单集
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 分集列表（横向滚动） */}
      <ScrollShadow className="flex-1">
        <div className="flex gap-4 pb-4">
          {episodePlan.episodes.map(episode => {
            const compliance = checkEpisodeCompliance(episode);
            const isSelected = episode.episodeNumber === selectedEpisode;

            return (
              <Card
                key={episode.id || episode.episodeNumber}
                className={`min-w-[320px] max-w-[320px] transition-all ${
                  isSelected
                    ? 'border-2 border-primary'
                    : 'border-2 border-transparent hover:border-default-200'
                }`}
                isPressable
                onPress={() => setSelectedEpisode(episode.episodeNumber)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-default-400" />
                      <span className="font-medium">{episode.title}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {compliance.compliant ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : (
                        <Tooltip
                          content={
                            <div className="space-y-1">
                              {compliance.issues.map((issue, i) => (
                                <p key={i}>{issue}</p>
                              ))}
                            </div>
                          }
                        >
                          <AlertCircle className="w-4 h-4 text-warning cursor-help" />
                        </Tooltip>
                      )}
                      {episodePlan.totalEpisodes > 1 && (
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="danger"
                          onPress={() => deleteEpisode(episode.episodeNumber)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <Divider />
                <CardBody className="space-y-3 pt-3">
                  {/* 统计信息 */}
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <Film className="w-3.5 h-3.5 text-default-400" />
                      <span>{episode.estimatedShotCount}个分镜</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-default-400" />
                      <span>{(episode.estimatedDuration / 60).toFixed(1)}分钟</span>
                    </div>
                  </div>

                  {/* 场景列表 */}
                  <div className="space-y-1">
                    <div className="text-xs text-default-500">包含场景：</div>
                    {episode.sceneNames.length === 0 ? (
                      <div
                        className="text-xs text-default-400 p-2 border border-dashed border-default-300 rounded text-center"
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => handleDrop(episode.episodeNumber)}
                      >
                        拖拽分镜到此处
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {Array.from(new Set(episode.sceneNames)).map(sceneName => {
                          const sceneShots =
                            shotsByEpisode[episode.episodeNumber]?.filter(
                              s => s.sceneName === sceneName
                            ) || [];
                          return (
                            <div
                              key={sceneName}
                              draggable
                              onDragStart={() =>
                                handleDragStart(sceneShots[0], episode.episodeNumber)
                              }
                              onDragOver={e => e.preventDefault()}
                              onDrop={() => handleDrop(episode.episodeNumber)}
                              className="text-xs p-2 bg-default-50 rounded cursor-move hover:bg-default-100"
                            >
                              {sceneName} ({sceneShots.length}个镜头)
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 编辑摘要 */}
                  <div className="space-y-1">
                    <div className="text-xs text-default-500">本集概要：</div>
                    <Textarea
                      size="sm"
                      placeholder="输入本集剧情概要..."
                      value={episode.summary}
                      onChange={e =>
                        updateEpisode(episode.episodeNumber, { summary: e.target.value })
                      }
                      className="text-xs"
                    />
                  </div>

                  {/* 悬念钩子 */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-default-500">
                      <Target className="w-3 h-3" />
                      <span>结尾悬念：</span>
                    </div>
                    <Textarea
                      size="sm"
                      placeholder="设置本集结尾的钩子或悬念..."
                      value={episode.cliffhanger || ''}
                      onChange={e =>
                        updateEpisode(episode.episodeNumber, { cliffhanger: e.target.value })
                      }
                      className="text-xs"
                    />
                  </div>

                  {/* 高潮标记 */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={episode.isClimax}
                      onChange={e =>
                        updateEpisode(episode.episodeNumber, { isClimax: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span className="text-xs">设为高潮集</span>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </ScrollShadow>

      {/* 底部总结 */}
      <Card>
        <CardBody className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">总计：{episodePlan.totalEpisodes}集</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-default-400" />
                <span className="text-sm text-default-600">
                  总时长：{(episodePlan.totalDuration / 60).toFixed(1)}分钟
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-default-400" />
                <span className="text-sm text-default-600">总分镜：{shots.length}个</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Chip
                size="sm"
                color={
                  episodePlan.episodes.every(ep => checkEpisodeCompliance(ep).compliant)
                    ? 'success'
                    : 'warning'
                }
                startContent={
                  episodePlan.episodes.every(ep => checkEpisodeCompliance(ep).compliant) ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5" />
                  )
                }
              >
                {episodePlan.episodes.every(ep => checkEpisodeCompliance(ep).compliant)
                  ? '符合平台标准'
                  : '需调整'}
              </Chip>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default EpisodePlanningStudio;
