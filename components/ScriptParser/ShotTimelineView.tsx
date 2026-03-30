import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Shot,
  ScriptScene,
  Keyframe,
} from '../../types';
import {
  Card,
  CardBody,
  Button,
  Chip,
} from '@heroui/react';
import {
  Camera,
  Clock,
  ChevronLeft,
  ChevronRight,
  List,
  Image as ImageIcon,
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

  const totalDuration = useMemo(() => {
    return shots.reduce((sum, shot) => sum + (shot.duration || 0), 0);
  }, [shots]);

  const timelinePositions = useMemo(() => {
    let currentStart = 0;
    const positions = shots.map(shot => {
      const duration = shot.duration || 0;
      const position = {
        shotId: shot.id,
        start: currentStart,
        end: currentStart + duration,
        duration,
      };
      currentStart += duration;
      return position;
    });
    return positions;
  }, [shots]);

  const selectedShot = useMemo(() => {
    return shots.find(s => s.id === selectedShotId);
  }, [shots, selectedShotId]);

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
    setZoomLevel(Math.max(0.5, zoomLevel - 0.5));
  };

  const getTimelineWidth = () => {
    return Math.max(totalDuration * zoomLevel * 30, 1200);
  };

  const getShotWidth = (duration: number) => {
    return Math.max(duration * zoomLevel * 30, 120);
  };

  const getShotPosition = (start: number) => {
    return start * zoomLevel * 30;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const interval = zoomLevel < 1 ? 10 : zoomLevel < 2 ? 5 : 1;
    for (let i = 0; i <= totalDuration; i += interval) {
      markers.push(i);
    }
    return markers;
  }, [totalDuration, zoomLevel]);

  const getKeyframeImageUrl = (keyframe: Keyframe) => {
    const currentImage =
      keyframe.generatedImages?.find(img => img.id === keyframe.currentImageId) ||
      keyframe.generatedImage;
    
    if (!currentImage) return null;
    return imageUrls[currentImage.id] || currentImage.path;
  };

  return (
    <div className="flex flex-col h-full bg-background select-none">
      <div className="flex items-center justify-between p-4 border-b border-content3 shrink-0">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold">分镜时间线</h3>
          <Chip size="sm" variant="flat">
            共 {shots.length} 个镜头
          </Chip>
          <Chip size="sm" variant="flat">
            <Clock size={14} className="mr-1" />
            {Math.floor(totalDuration / 60)}分{totalDuration % 60}秒
          </Chip>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="flat"
            isIconOnly
            onPress={handleZoomOut}
            aria-label="缩小"
          >
            <ChevronLeft size={16} />
          </Button>
          <Chip size="sm" variant="flat">
            {Math.round(zoomLevel * 100)}%
          </Chip>
          <Button
            size="sm"
            variant="flat"
            isIconOnly
            onPress={handleZoomIn}
            aria-label="放大"
          >
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

      <div className="flex-1 overflow-hidden relative">
        <div
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setScrollLeft(Math.max(0, scrollLeft - 300));
          }}
        >
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            className="bg-content2/80 backdrop-blur"
          >
            <ChevronLeft size={16} />
          </Button>
        </div>
        <div
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setScrollLeft(scrollLeft + 300);
          }}
        >
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            className="bg-content2/80 backdrop-blur"
          >
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
              width: getTimelineWidth(),
              transform: `translateX(-${scrollLeft}px)`,
            }}
          >
            <div className="flex flex-col h-full">
              <div className="relative h-14 p-4 border-b border-content3 shrink-0">
                {timeMarkers.map(time => (
                  <div
                    key={time}
                    className="flex flex-col items-center"
                    style={{
                      position: 'absolute',
                      left: getShotPosition(time),
                      top: '16px',
                    }}
                  >
                    <div className="w-px h-4 bg-content4" />
                    <span className="text-xs text-slate-400 mt-1 whitespace-nowrap">
                      {formatTime(time)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex-1 p-4">
                <div className="relative h-full flex items-center">
                  {timelinePositions.map((position) => {
                    const shot = shots.find(s => s.id === position.shotId);
                    if (!shot) return null;
                    
                    const isSelected = shot.id === selectedShotId;
                    const hasKeyframes = shot.keyframes && shot.keyframes.length > 0;
                    const firstKeyframeWithImage = hasKeyframes 
                      ? shot.keyframes!.find(kf => {
                          const currentImage =
                            kf.generatedImages?.find(img => img.id === kf.currentImageId) ||
                            kf.generatedImage;
                          return !!currentImage;
                        })
                      : null;
                    
                    const previewImageUrl = firstKeyframeWithImage 
                      ? getKeyframeImageUrl(firstKeyframeWithImage)
                      : null;

                    return (
                      <motion.div
                        key={shot.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute top-1/2 -translate-y-1/2 transition-all duration-200"
                        style={{
                          left: getShotPosition(position.start),
                          width: getShotWidth(position.duration),
                          height: '280px',
                        }}
                        onClick={() => onSelectShot(shot)}
                      >
                        <div className="h-full p-1">
                          <Card
                            className={`h-full cursor-pointer transition-all duration-200 overflow-hidden ${
                              isSelected
                                ? 'ring-2 ring-primary shadow-xl'
                                : 'hover:shadow-lg'
                            }`}
                          >
                            <CardBody className="p-3 h-full flex flex-col gap-2">
                              <div className="flex items-center justify-between gap-2 shrink-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-primary">
                                    {shot.shotNumber || shot.sequence}
                                  </span>
                                  {shot.layer === 'key' && (
                                    <Chip size="sm" color="primary" variant="solid" classNames={{ base: 'h-5 text-[11px] px-1.5' }}>
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
                                <div className="h-[140px] rounded-lg overflow-hidden bg-content3">
                                  <img
                                    src={previewImageUrl}
                                    alt={shot.shotNumber || `镜头 ${shot.sequence}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="h-[140px] flex items-center justify-center bg-content3 rounded-lg">
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
                                        {CAMERA_MOVEMENT_LABELS[shot.cameraMovement] || shot.cameraMovement}
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
    </div>
  );
};
