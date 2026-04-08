/**
 * EpisodePlanViewer - 分集方案查看器
 *
 * 显示分集方案，允许用户调整
 *
 * @module components/ScriptParser/EpisodePlanViewer
 * @version 1.0.0
 */

import React, { useState, useMemo } from 'react';
import { Card, CardBody, CardHeader, Divider, Chip, Button, Input, Tooltip } from '@heroui/react';
import { Film, Clock, ListVideo, Sparkles, Edit2, ChevronRight, ChevronDown } from 'lucide-react';
import { EpisodePlan, EpisodeInfo } from '../../types';

interface EpisodePlanViewerProps {
  episodePlan: EpisodePlan;
  onUpdateEpisodePlan?: (updatedPlan: EpisodePlan) => void;
  t?: any;
}

export const EpisodePlanViewer: React.FC<EpisodePlanViewerProps> = ({
  episodePlan,
  onUpdateEpisodePlan,
  t,
}) => {
  const [editingEpisode, setEditingEpisode] = useState<number | null>(null);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<number>>(new Set());
  const [localEpisodePlan, setLocalEpisodePlan] = useState<EpisodePlan>(episodePlan);

  const totalDurationMinutes = useMemo(() => {
    return Math.round(localEpisodePlan.totalDuration / 60);
  }, [localEpisodePlan]);

  const totalShotCount = useMemo(() => {
    return localEpisodePlan.episodes.reduce((sum, e) => sum + e.estimatedShotCount, 0);
  }, [localEpisodePlan]);

  const toggleEpisodeExpansion = (episodeNumber: number) => {
    const newExpanded = new Set(expandedEpisodes);
    if (newExpanded.has(episodeNumber)) {
      newExpanded.delete(episodeNumber);
    } else {
      newExpanded.add(episodeNumber);
    }
    setExpandedEpisodes(newExpanded);
  };

  const handleEpisodeDurationChange = (episodeNumber: number, newDuration: number) => {
    const updatedEpisodes = localEpisodePlan.episodes.map(ep => {
      if (ep.episodeNumber === episodeNumber) {
        return { ...ep, estimatedDuration: newDuration };
      }
      return ep;
    });

    const updatedTotalDuration = updatedEpisodes.reduce((sum, e) => sum + e.estimatedDuration, 0);

    const updatedPlan = {
      ...localEpisodePlan,
      episodes: updatedEpisodes,
      totalDuration: updatedTotalDuration,
    };

    setLocalEpisodePlan(updatedPlan);
    onUpdateEpisodePlan?.(updatedPlan);
  };

  const handleEpisodeCountChange = (newCount: number) => {
    if (newCount < 1 || newCount > 100) return;

    // 简单重新分配场景
    const currentEpisodes = localEpisodePlan.episodes;
    const allSceneNames = currentEpisodes.flatMap(e => e.sceneNames);
    const scenesPerNewEpisode = Math.ceil(allSceneNames.length / newCount);
    const newEpisodes: EpisodeInfo[] = [];

    for (let i = 0; i < newCount; i++) {
      const startIndex = i * scenesPerNewEpisode;
      const endIndex = Math.min((i + 1) * scenesPerNewEpisode, allSceneNames.length);
      const episodeScenes = allSceneNames.slice(startIndex, endIndex);

      const isClimax = i >= Math.floor(newCount * 0.6) && i <= Math.floor(newCount * 0.85);

      newEpisodes.push({
        episodeNumber: i + 1,
        title: `第${i + 1}集`,
        sceneNames: episodeScenes,
        estimatedDuration: Math.round(localEpisodePlan.totalDuration / newCount),
        estimatedShotCount: Math.round(totalShotCount / newCount),
        summary:
          episodeScenes.length > 0
            ? `本集包含${episodeScenes.length}个场景：${episodeScenes.join('、')}`
            : '',
        isClimax,
      });
    }

    const updatedPlan = {
      ...localEpisodePlan,
      totalEpisodes: newCount,
      episodes: newEpisodes,
    };

    setLocalEpisodePlan(updatedPlan);
    onUpdateEpisodePlan?.(updatedPlan);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 方案概览 */}
      <Card className="bg-content1">
        <CardHeader className="pb-0">
          <div className="flex items-center gap-3">
            <Sparkles className="text-primary" size={24} />
            <div>
              <h3 className="text-lg font-semibold">分集方案</h3>
              <p className="text-sm text-slate-400">根据平台标准为您智能规划</p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <ListVideo size={16} />
                <span>总集数</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={localEpisodePlan.totalEpisodes}
                  min={1}
                  max={100}
                  size="sm"
                  className="w-20"
                  onValueChange={val => handleEpisodeCountChange(Number(val))}
                />
                <span className="text-lg font-semibold">集</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Clock size={16} />
                <span>总时长</span>
              </div>
              <div className="text-lg font-semibold">{totalDurationMinutes}分钟</div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Film size={16} />
                <span>总分镜数</span>
              </div>
              <div className="text-lg font-semibold">{totalShotCount}个</div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Sparkles size={16} />
                <span>高潮集数</span>
              </div>
              <div className="text-lg font-semibold">
                {localEpisodePlan.episodes.filter(e => e.isClimax).length}集
              </div>
            </div>
          </div>

          <Divider className="my-4" />

          <p className="text-sm text-slate-300 whitespace-pre-line">
            {localEpisodePlan.description}
          </p>
        </CardBody>
      </Card>

      {/* 每集详情列表 */}
      <div className="flex flex-col gap-3">
        {localEpisodePlan.episodes.map(episode => {
          const isExpanded = expandedEpisodes.has(episode.episodeNumber);

          return (
            <Card key={episode.episodeNumber} className="bg-content1">
              <CardBody className="p-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleEpisodeExpansion(episode.episodeNumber)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                      <span className="text-primary font-semibold">{episode.episodeNumber}</span>
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{episode.title}</span>
                        {episode.isClimax && (
                          <Chip color="danger" variant="flat">
                            高潮
                          </Chip>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {editingEpisode === episode.episodeNumber ? (
                            <Input
                              type="number"
                              value={Math.round(episode.estimatedDuration / 60)}
                              min={1}
                              max={30}
                              size="sm"
                              className="w-16"
                              onValueChange={val => {
                                handleEpisodeDurationChange(
                                  episode.episodeNumber,
                                  Number(val) * 60
                                );
                              }}
                              onBlur={() => setEditingEpisode(null)}
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={e => {
                                e.stopPropagation();
                                setEditingEpisode(episode.episodeNumber);
                              }}
                              className="hover:text-primary cursor-pointer"
                            >
                              {Math.round(episode.estimatedDuration / 60)}分钟
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <Film size={14} />
                          {episode.estimatedShotCount}个分镜
                        </span>
                        <span>{episode.sceneNames.length}个场景</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Tooltip content={isExpanded ? '收起' : '展开'}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        aria-label={isExpanded ? '收起' : '展开'}
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </Button>
                    </Tooltip>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-content3">
                    <div className="flex flex-col gap-3">
                      {episode.summary && (
                        <div>
                          <div className="text-sm text-slate-400 mb-1">剧情概要</div>
                          <p className="text-sm text-slate-300">{episode.summary}</p>
                        </div>
                      )}

                      {episode.cliffhanger && (
                        <div>
                          <div className="text-sm text-slate-400 mb-1">本集悬念</div>
                          <p className="text-sm text-warning">{episode.cliffhanger}</p>
                        </div>
                      )}

                      {episode.sceneNames.length > 0 && (
                        <div>
                          <div className="text-sm text-slate-400 mb-1">包含场景</div>
                          <div className="flex flex-wrap gap-2">
                            {episode.sceneNames.map((sceneName, idx) => (
                              <Chip key={idx} variant="flat">
                                {sceneName}
                              </Chip>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default EpisodePlanViewer;
