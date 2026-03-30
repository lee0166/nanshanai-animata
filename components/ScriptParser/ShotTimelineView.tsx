import React, { useState, useMemo, useRef } from 'react';
import { Shot, ScriptScene, Keyframe } from '../../types';
import { Card, CardBody, Button, Chip } from '@heroui/react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  List,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Film,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { storageService } from '../../services/storage';

const SHOT_TYPE_LABELS: Record<string, string> = {
  extreme_long: '极远景',
  long: '远景',
  full: '全景',
  medium: '中景',
  close_up: '近景',
  extreme_close_up: '极近景',
};

const CAMERA_MOVEMENT_LABELS: Record<string, string> = {
  static: '固定',
  push: '推',
  pull: '拉',
  pan: '摇',
  tilt: '升降',
  track: '移',
  crane: '升降',
};

interface ShotTimelineViewProps {
  shots: Shot[];
  scenes: ScriptScene[];
  selectedShotId: string;
  onSelectShot: (shot: Shot) => void;
  onSwitchToListView: () => void;
  imageUrls: Record<string, string>;
}

export const ShotTimelineView: React.FC<ShotTimelineViewProps> = ({
  shots,
  scenes,
  selectedShotId,
  onSelectShot,
  onSwitchToListView,
  imageUrls,
}) => {
  const [scrollLeft, setScrollLeft] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartScrollLeft, setDragStartScrollLeft] = useState(0);
  const [isKeyframePanelExpanded, setIsKeyframePanelExpanded] = useState(true);

  const totalDuration = useMemo(() => {
    return shots.reduce((sum, shot) => sum + (shot.duration || 0), 0);
  }, [shots]);

  const storyboardData = useMemo(() => {
    let currentX = 0;
    const gap = 16 * zoomLevel;
    const cardWidth = 320 * zoomLevel;
    const data = shots.map(shot => {
      const item = {
        shot,
        x: currentX,
        width: cardWidth,
      };

      currentX += cardWidth + gap;
      return item;
    });
    return { items: data, totalWidth: Math.max(currentX, 1200) };
  }, [shots, zoomLevel]);

  const getCardHeight = () => {
    return 380 * zoomLevel;
  };

  const getPreviewImageHeight = () => {
    return 180 * zoomLevel;
  };

  const getPreviewImageWidth = () => {
    return ((180 * 16) / 9) * zoomLevel;
  };

  const getShotTypeColor = (type: string) => {
    switch (type) {
      case 'extreme_long':
      case 'long':
        return 'default';
      case 'full':
        return 'primary';
      case 'medium':
        return 'secondary';
      case 'close_up':
      case 'extreme_close_up':
        return 'success';
      default:
        return 'default';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedShot = useMemo(() => {
    return shots.find(s => s.id === selectedShotId);
  }, [shots, selectedShotId]);

  const selectedShotKeyframes = useMemo(() => {
    if (!selectedShot?.keyframes) return [];
    return selectedShot.keyframes;
  }, [selectedShot]);

  const getKeyframeImageUrl = (keyframe: Keyframe) => {
    const currentImage =
      keyframe.generatedImages?.find(img => img.id === keyframe.currentImageId) ||
      keyframe.generatedImage;

    if (!currentImage) return null;
    return imageUrls[currentImage.id] || currentImage.path;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartScrollLeft(scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const diff = e.clientX - dragStartX;
    setScrollLeft(Math.max(0, dragStartScrollLeft - diff));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setZoomLevel(Math.min(3, zoomLevel + 0.5));
  };

  const handleZoomOut = () => {
    setZoomLevel(Math.max(0.4, zoomLevel - 0.5));
  };

  return (
    <div className="flex flex-col h-full bg-background select-none">
      <div className="flex items-center justify-between p-4 border-b border-content3 shrink-0">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold">故事板视图</h3>
          <Chip size="sm" variant="flat">
            共 {shots.length} 个镜头
          </Chip>
          <Chip size="sm" variant="flat">
            <Clock size={14} className="mr-1" />
            {Math.floor(totalDuration / 60)}分{totalDuration % 60}秒
          </Chip>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="flat" isIconOnly onPress={handleZoomOut} aria-label="缩小">
            <ChevronLeft size={16} />
          </Button>
          <Chip size="sm" variant="flat">
            {Math.round(zoomLevel * 100)}%
          </Chip>
          <Button size="sm" variant="flat" isIconOnly onPress={handleZoomIn} aria-label="放大">
            <ChevronRight size={16} />
          </Button>
          <Button
            size="sm"
            variant="solid"
            color="primary"
            startContent={<List size={16} />}
            onPress={onSwitchToListView}
          >
            列表视图
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden relative">
          <div
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 cursor-pointer"
            onClick={e => {
              e.stopPropagation();
              setScrollLeft(Math.max(0, scrollLeft - 300));
            }}
          >
            <Button isIconOnly size="sm" variant="flat" className="bg-content2/80 backdrop-blur">
              <ChevronLeft size={16} />
            </Button>
          </div>
          <div
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 cursor-pointer"
            onClick={e => {
              e.stopPropagation();
              setScrollLeft(scrollLeft + 300);
            }}
          >
            <Button isIconOnly size="sm" variant="flat" className="bg-content2/80 backdrop-blur">
              <ChevronRight size={16} />
            </Button>
          </div>

          <div
            className="h-full overflow-hidden cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            ref={timelineRef}
          >
            <div
              className="h-full"
              style={{
                width: storyboardData.totalWidth,
                transform: `translateX(-${scrollLeft}px)`,
              }}
            >
              <div className="flex flex-col h-full">
                <div className="flex-1 p-4">
                  <div className="relative h-full flex items-center">
                    {storyboardData.items.map(({ shot, x, width }) => {
                      const cardHeight = getCardHeight();
                      const previewImageHeight = getPreviewImageHeight();
                      const previewImageWidth = getPreviewImageWidth();

                      const isSelected = shot.id === selectedShotId;
                      const hasKeyframes = shot.keyframes && shot.keyframes.length > 0;

                      let previewImageUrl = null;
                      if (hasKeyframes) {
                        for (const kf of shot.keyframes!) {
                          const currentImage =
                            kf.generatedImages?.find(img => img.id === kf.currentImageId) ||
                            kf.generatedImage;
                          if (currentImage) {
                            previewImageUrl = imageUrls[currentImage.id] || currentImage.path;
                            break;
                          }
                        }
                      }

                      return (
                        <motion.div
                          key={shot.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          className="absolute top-1/2 -translate-y-1/2 transition-all duration-200"
                          style={{
                            left: x,
                            width: width,
                            height: cardHeight,
                          }}
                          onClick={() => onSelectShot(shot)}
                        >
                          <div className="h-full p-1">
                            <Card
                              className={`h-full cursor-pointer transition-all duration-200 overflow-hidden ${
                                isSelected ? 'ring-2 ring-primary shadow-xl' : 'hover:shadow-lg'
                              }`}
                            >
                              <CardBody className="p-3 h-full flex flex-col gap-2">
                                <div className="flex items-center justify-between gap-2 shrink-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold text-primary">
                                      {shot.shotNumber || shot.sequence}
                                    </span>
                                    {shot.layer === 'key' && (
                                      <Chip
                                        size="sm"
                                        color="primary"
                                        variant="solid"
                                        classNames={{ base: 'h-5 text-[11px] px-1.5' }}
                                      >
                                        关键
                                      </Chip>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {hasKeyframes && (
                                      <Chip
                                        size="sm"
                                        color="success"
                                        variant="flat"
                                        classNames={{ base: 'h-5 text-[11px] px-1.5' }}
                                      >
                                        {shot.keyframes?.length}K
                                      </Chip>
                                    )}
                                  </div>
                                </div>

                                {previewImageUrl ? (
                                  <div
                                    className="rounded-lg overflow-hidden bg-content3 flex-shrink-0 flex justify-center"
                                    style={{ height: previewImageHeight }}
                                  >
                                    <img
                                      src={previewImageUrl}
                                      alt={shot.shotNumber || `镜头 ${shot.sequence}`}
                                      className="h-full object-contain"
                                    />
                                  </div>
                                ) : (
                                  <div
                                    className="flex items-center justify-center bg-content3 rounded-lg flex-shrink-0"
                                    style={{ height: previewImageHeight, width: '100%' }}
                                  >
                                    <ImageIcon size={32} className="text-slate-500" />
                                  </div>
                                )}

                                <div className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
                                  <p className="text-xs line-clamp-2 text-slate-300 leading-tight">
                                    {shot.description}
                                  </p>

                                  <div className="space-y-1 mt-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="flex items-center gap-1">
                                        <Chip
                                          size="sm"
                                          color={getShotTypeColor(shot.shotType) as any}
                                          variant="flat"
                                          classNames={{ base: 'h-4 text-[9px] px-1' }}
                                        >
                                          {SHOT_TYPE_LABELS[shot.shotType] || shot.shotType}
                                        </Chip>
                                        <Chip
                                          size="sm"
                                          variant="flat"
                                          classNames={{ base: 'h-4 text-[9px] px-1' }}
                                        >
                                          {CAMERA_MOVEMENT_LABELS[shot.cameraMovement] ||
                                            shot.cameraMovement}
                                        </Chip>
                                      </div>
                                      <div className="flex items-center gap-1 text-xs text-slate-400">
                                        <Clock size={10} />
                                        {shot.duration}s
                                      </div>
                                    </div>

                                    {shot.characters && shot.characters.length > 0 && (
                                      <div className="flex gap-1 flex-wrap overflow-hidden">
                                        {shot.characters.slice(0, 2).map((char, i) => (
                                          <Chip
                                            key={i}
                                            size="sm"
                                            variant="bordered"
                                            classNames={{ base: 'h-4 text-[9px] px-1' }}
                                          >
                                            {char}
                                          </Chip>
                                        ))}
                                        {shot.characters.length > 2 && (
                                          <Chip
                                            size="sm"
                                            variant="bordered"
                                            classNames={{ base: 'h-4 text-[9px] px-1' }}
                                          >
                                            +{shot.characters.length - 2}
                                          </Chip>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CardBody>
                            </Card>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-content3 bg-content1">
          <div
            className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-content2/50"
            onClick={() => setIsKeyframePanelExpanded(!isKeyframePanelExpanded)}
          >
            <div className="flex items-center gap-2">
              <Film size={18} className="text-slate-400" />
              <span className="text-sm font-medium text-foreground">
                {selectedShot
                  ? `${selectedShot.shotNumber || `镜头 ${selectedShot.sequence}`} - 关键帧`
                  : '选择一个分镜查看关键帧'}
              </span>
              {selectedShotKeyframes.length > 0 && (
                <Chip size="sm" variant="flat">
                  {selectedShotKeyframes.length} 个关键帧
                </Chip>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              aria-label={isKeyframePanelExpanded ? '收起关键帧' : '展开关键帧'}
            >
              {isKeyframePanelExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </Button>
          </div>

          {isKeyframePanelExpanded && (
            <div className="px-4 pb-4">
              {selectedShotKeyframes.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto py-2 px-1">
                  {selectedShotKeyframes.map((keyframe, index) => {
                    const currentImage =
                      keyframe.generatedImages?.find(img => img.id === keyframe.currentImageId) ||
                      keyframe.generatedImage;
                    const imageUrl = currentImage
                      ? imageUrls[currentImage.id] || currentImage.path
                      : null;

                    return (
                      <div key={keyframe.id} className="flex flex-col items-center gap-2 shrink-0">
                        <div className="relative">
                          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-3 h-1 bg-content4" />
                          <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-3 h-1 bg-content4" />

                          <div className="w-32 h-20 rounded-lg overflow-hidden bg-content3 border border-content3">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={`关键帧 ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon size={24} className="text-slate-500" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <Chip
                              size="sm"
                              color={
                                keyframe.frameType === 'start'
                                  ? 'success'
                                  : keyframe.frameType === 'end'
                                    ? 'primary'
                                    : 'default'
                              }
                              variant="flat"
                              classNames={{ base: 'h-4 text-[9px] px-1' }}
                            >
                              {keyframe.frameType === 'start'
                                ? '开始'
                                : keyframe.frameType === 'end'
                                  ? '结束'
                                  : '中间'}
                            </Chip>
                            <Chip
                              size="sm"
                              color={
                                keyframe.status === 'completed'
                                  ? 'success'
                                  : keyframe.status === 'generating'
                                    ? 'primary'
                                    : 'default'
                              }
                              variant="flat"
                              classNames={{ base: 'h-4 text-[9px] px-1' }}
                            >
                              {keyframe.status === 'completed'
                                ? '已完成'
                                : keyframe.status === 'generating'
                                  ? '生成中'
                                  : '待生成'}
                            </Chip>
                          </div>
                          <p className="text-xs text-slate-400 text-center max-w-[128px] line-clamp-2">
                            {keyframe.description?.substring(0, 30) || `关键帧 ${index + 1}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-slate-400">
                  {selectedShot ? '该分镜暂无关键帧' : '请在时间线上选择一个分镜'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
