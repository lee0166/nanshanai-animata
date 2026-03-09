import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
  Chip,
  Tooltip,
  Tabs,
  Tab,
  Divider
} from '@heroui/react';
import {
  Film,
  Scissors,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  Save,
  Trash2,
  GripVertical,
  Clock,
  MonitorPlay,
  FileVideo,
  ChevronLeft,
  Settings,
  Layers,
  Grid3X3,
  List
} from 'lucide-react';
import { useApp } from '../contexts';
import { storageService } from '../services/storage';
import { timelineService } from '../services/editing';
import { videoGenerationService } from '../services/video';
import { Timeline, TimelineClip, Shot, ExportConfig } from '../types';
import { useToast } from '../contexts';

// View modes
 type ViewMode = 'timeline' | 'grid' | 'list';

// Timeline scale (pixels per second)
const TIMELINE_SCALE = 50;

export const TimelineEditor: React.FC = () => {
  const { projectId, scriptId } = useParams<{ projectId: string; scriptId: string }>();
  const navigate = useNavigate();
  const { t, settings } = useApp();
  const { showToast } = useToast();

  // State
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Export config
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: 'mp4',
    resolution: '1080p',
    frameRate: 24,
    quality: 'high',
    includeAudio: true
  });

  // Load data
  useEffect(() => {
    loadData();
  }, [projectId, scriptId]);

  const loadData = async () => {
    if (!projectId || !scriptId) return;

    setIsLoading(true);
    try {
      // Load script
      const script = await storageService.getScript(scriptId);
      if (script?.parseState?.shots) {
        setShots(script.parseState.shots);

        // Try to load existing timeline or create new one
        const timelines = await timelineService.getTimelinesByProject(projectId);
        const existingTimeline = timelines.find(t => t.scriptId === scriptId);

        if (existingTimeline) {
          setTimeline(existingTimeline);
        } else {
          // Create new timeline from shots
          const result = await timelineService.createTimeline({
            projectId,
            scriptId,
            name: `${script.title || 'Untitled'} - Timeline`,
            shots: script.parseState.shots
          });

          if (result.success && result.data) {
            setTimeline(result.data);
          }
        }
      }
    } catch (error) {
      console.error('[TimelineEditor] Failed to load data:', error);
      showToast('Failed to load timeline data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Get video clips
  const videoClips = useMemo(() => {
    return timeline?.tracks.find(t => t.type === 'video')?.clips || [];
  }, [timeline]);

  // Total duration
  const totalDuration = useMemo(() => {
    return timeline?.totalDuration || 0;
  }, [timeline]);

  // Format time (seconds to MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle clip selection
  const handleClipClick = (clipId: string) => {
    setSelectedClipId(clipId);
    const clip = videoClips.find(c => c.id === clipId);
    if (clip) {
      setCurrentTime(clip.startTime);
    }
  };

  // Handle drag start
  const handleDragStart = (clipId: string) => {
    setDraggedClipId(clipId);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  // Handle drop
  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedClipId || !timeline) return;

    const currentIndex = videoClips.findIndex(c => c.id === draggedClipId);
    if (currentIndex === -1 || currentIndex === targetIndex) {
      setDraggedClipId(null);
      setDragOverIndex(null);
      return;
    }

    // Reorder clips
    const newOrder = [...videoClips.map(c => c.id)];
    const [removed] = newOrder.splice(currentIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    const videoTrack = timeline.tracks.find(t => t.type === 'video');
    if (videoTrack) {
      const result = await timelineService.reorderClips(
        timeline.id,
        videoTrack.id,
        newOrder
      );

      if (result.success && result.data) {
        setTimeline(result.data);
        showToast('Clip order updated', 'success');
      }
    }

    setDraggedClipId(null);
    setDragOverIndex(null);
  };

  // Handle delete clip
  const handleDeleteClip = async (clipId: string) => {
    if (!timeline) return;

    const videoTrack = timeline.tracks.find(t => t.type === 'video');
    if (!videoTrack) return;

    const result = await timelineService.deleteClip(
      timeline.id,
      videoTrack.id,
      clipId
    );

    if (result.success && result.data) {
      setTimeline(result.data);
      setSelectedClipId(null);
      showToast('Clip deleted', 'success');
    }
  };

  // Handle export
  const handleExport = async () => {
    if (!timeline || !projectId) return;

    setIsExporting(true);
    try {
      const outputPath = `projects/${projectId}/exports/${timeline.name}_${Date.now()}.${exportConfig.format}`;

      const result = await timelineService.exportVideo({
        timeline,
        config: exportConfig,
        outputPath
      });

      if (result.success) {
        showToast('Export started. Check progress in job monitor.', 'success');
        setIsExportModalOpen(false);
      } else {
        showToast(`Export failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('[TimelineEditor] Export failed:', error);
      showToast('Export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle export to Premiere
  const handleExportToPremiere = async () => {
    if (!timeline || !projectId) return;

    try {
      const outputPath = `projects/${projectId}/exports/${timeline.name}_premiere.xml`;
      const result = await timelineService.exportToPremiere(timeline, outputPath);

      if (result.success) {
        showToast('Premiere project exported successfully', 'success');
      } else {
        showToast(`Export failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('[TimelineEditor] Premiere export failed:', error);
      showToast('Export failed', 'error');
    }
  };

  // Handle export to FCPX
  const handleExportToFCPX = async () => {
    if (!timeline || !projectId) return;

    try {
      const outputPath = `projects/${projectId}/exports/${timeline.name}_fcpx.fcpxml`;
      const result = await timelineService.exportToFCPX(timeline, outputPath);

      if (result.success) {
        showToast('Final Cut Pro project exported successfully', 'success');
      } else {
        showToast(`Export failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('[TimelineEditor] FCPX export failed:', error);
      showToast('Export failed', 'error');
    }
  };

  // Get shot by clip
  const getShotByClip = (clip: TimelineClip): Shot | undefined => {
    return shots.find(s => s.id === clip.shotId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0F0F23]">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0F0F23] text-[#F8FAFC]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#1E1B4B] border-b border-[#1E1B4B]/50">
        <div className="flex items-center gap-4">
          <Button
            variant="light"
            isIconOnly
            onPress={() => navigate(-1)}
          >
            <ChevronLeft size={20} />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{timeline?.name || 'Timeline Editor'}</h1>
            <p className="text-sm text-gray-400">
              {videoClips.length} clips · {formatTime(totalDuration)} total
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <ButtonGroup variant="flat">
            <Button
              isIconOnly
              variant={viewMode === 'timeline' ? 'solid' : 'light'}
              onPress={() => setViewMode('timeline')}
            >
              <Layers size={18} />
            </Button>
            <Button
              isIconOnly
              variant={viewMode === 'grid' ? 'solid' : 'light'}
              onPress={() => setViewMode('grid')}
            >
              <Grid3X3 size={18} />
            </Button>
            <Button
              isIconOnly
              variant={viewMode === 'list' ? 'solid' : 'light'}
              onPress={() => setViewMode('list')}
            >
              <List size={18} />
            </Button>
          </ButtonGroup>

          <Divider orientation="vertical" className="h-8" />

          {/* Export buttons */}
          <Button
            variant="flat"
            startContent={<FileVideo size={18} />}
            onPress={handleExportToPremiere}
          >
            Premiere
          </Button>
          <Button
            variant="flat"
            startContent={<MonitorPlay size={18} />}
            onPress={handleExportToFCPX}
          >
            FCPX
          </Button>
          <Button
            color="primary"
            startContent={<Download size={18} />}
            onPress={() => setIsExportModalOpen(true)}
          >
            Export Video
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Timeline/Grid/List View */}
        <div className="flex-1 overflow-auto p-6">
          {viewMode === 'timeline' && (
            <div className="space-y-4">
              {/* Time ruler */}
              <div className="flex items-end h-8 border-b border-gray-700">
                {Array.from({ length: Math.ceil(totalDuration / 5) + 1 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 text-xs text-gray-500"
                    style={{ width: 5 * TIMELINE_SCALE }}
                  >
                    {formatTime(i * 5)}
                  </div>
                ))}
              </div>

              {/* Video track */}
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Film size={16} className="text-primary" />
                  <span className="text-sm font-medium">Video Track</span>
                </div>

                <div
                  className="relative h-24 bg-[#1E1B4B]/30 rounded-lg overflow-hidden"
                  style={{ width: Math.max(totalDuration * TIMELINE_SCALE, 800) }}
                >
                  {videoClips.map((clip, index) => {
                    const shot = getShotByClip(clip);
                    const isSelected = selectedClipId === clip.id;
                    const isDragOver = dragOverIndex === index;

                    return (
                      <div
                        key={clip.id}
                        draggable
                        onDragStart={() => handleDragStart(clip.id)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        onClick={() => handleClipClick(clip.id)}
                        className={`
                          absolute top-2 bottom-2 rounded cursor-pointer
                          transition-all duration-200
                          ${isSelected ? 'ring-2 ring-primary' : ''}
                          ${isDragOver ? 'bg-primary/30' : 'bg-[#1E1B4B]'}
                          hover:bg-[#2d2a5c]
                        `}
                        style={{
                          left: clip.startTime * TIMELINE_SCALE,
                          width: Math.max(clip.duration * TIMELINE_SCALE - 4, 60)
                        }}
                      >
                        <div className="flex items-center gap-2 p-2 h-full">
                          <GripVertical size={16} className="text-gray-500 cursor-grab" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {clip.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatTime(clip.duration)}
                            </p>
                          </div>
                          {isSelected && (
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              onPress={(e) => {
                                e.stopPropagation();
                                handleDeleteClip(clip.id);
                              }}
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Playhead */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-[#E11D48] z-10"
                    style={{ left: currentTime * TIMELINE_SCALE }}
                  >
                    <div className="absolute -top-1 -left-1.5 w-4 h-4 bg-[#E11D48] rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'grid' && (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {videoClips.map((clip) => {
                const shot = getShotByClip(clip);
                const isSelected = selectedClipId === clip.id;

                return (
                  <Card
                    key={clip.id}
                    isPressable
                    onPress={() => handleClipClick(clip.id)}
                    className={`${isSelected ? 'ring-2 ring-primary' : ''}`}
                  >
                    <CardBody className="p-0 aspect-video bg-[#1E1B4B] flex items-center justify-center">
                      <Film size={32} className="text-gray-600" />
                    </CardBody>
                    <CardHeader className="py-2 px-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{clip.name}</p>
                        <p className="text-xs text-gray-500">{formatTime(clip.duration)}</p>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          )}

          {viewMode === 'list' && (
            <div className="space-y-2">
              {videoClips.map((clip, index) => {
                const shot = getShotByClip(clip);
                const isSelected = selectedClipId === clip.id;

                return (
                  <Card
                    key={clip.id}
                    isPressable
                    onPress={() => handleClipClick(clip.id)}
                    className={`${isSelected ? 'ring-2 ring-primary' : ''}`}
                  >
                    <CardBody className="flex items-center gap-4 py-3">
                      <span className="text-gray-500 w-8">{index + 1}</span>
                      <div className="w-16 h-12 bg-[#1E1B4B] rounded flex items-center justify-center">
                        <Film size={20} className="text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{clip.name}</p>
                        <p className="text-sm text-gray-500">{shot?.description?.slice(0, 60)}...</p>
                      </div>
                      <Chip size="sm" variant="flat">
                        {formatTime(clip.duration)}
                      </Chip>
                      <div className="flex gap-2">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={() => handleDeleteClip(clip.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Properties panel */}
        {selectedClipId && (
          <div className="w-80 border-l border-[#1E1B4B] bg-[#1E1B4B]/30 p-4">
            {(() => {
              const clip = videoClips.find(c => c.id === selectedClipId);
              const shot = clip ? getShotByClip(clip) : null;

              if (!clip || !shot) return null;

              return (
                <div className="space-y-4">
                  <h3 className="font-semibold">Clip Properties</h3>

                  <div>
                    <label className="text-xs text-gray-500">Name</label>
                    <p className="text-sm">{clip.name}</p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Duration</label>
                    <p className="text-sm">{formatTime(clip.duration)}</p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Shot Type</label>
                    <Chip size="sm" className="mt-1">{shot.shotType}</Chip>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Camera Movement</label>
                    <p className="text-sm">{shot.cameraMovement}</p>
                  </div>

                  <Divider />

                  <div>
                    <label className="text-xs text-gray-500">Description</label>
                    <p className="text-sm text-gray-400">{shot.description}</p>
                  </div>

                  {shot.dialogue && (
                    <div>
                      <label className="text-xs text-gray-500">Dialogue</label>
                      <p className="text-sm italic">&ldquo;{shot.dialogue}&rdquo;</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Playback controls */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#1E1B4B] border-t border-[#1E1B4B]/50">
        <div className="flex items-center gap-4">
          <Button isIconOnly variant="light" size="sm">
            <SkipBack size={20} />
          </Button>
          <Button
            isIconOnly
            color="primary"
            size="lg"
            onPress={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </Button>
          <Button isIconOnly variant="light" size="sm">
            <SkipForward size={20} />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <Clock size={16} className="text-gray-500" />
          <span className="font-mono text-lg">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
        </div>

        <div className="w-32" />
      </div>

      {/* Export Modal */}
      <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)}>
        <ModalContent>
          <ModalHeader>Export Video</ModalHeader>
          <ModalBody className="space-y-4">
            <Select
              label="Format"
              selectedKeys={[exportConfig.format]}
              onChange={(e) => setExportConfig({ ...exportConfig, format: e.target.value as any })}
            >
              <SelectItem key="mp4" value="mp4">MP4 (H.264)</SelectItem>
              <SelectItem key="mov" value="mov">MOV (ProRes)</SelectItem>
              <SelectItem key="prores" value="prores">ProRes 422</SelectItem>
            </Select>

            <Select
              label="Resolution"
              selectedKeys={[exportConfig.resolution]}
              onChange={(e) => setExportConfig({ ...exportConfig, resolution: e.target.value as any })}
            >
              <SelectItem key="720p" value="720p">720p HD</SelectItem>
              <SelectItem key="1080p" value="1080p">1080p Full HD</SelectItem>
              <SelectItem key="2k" value="2k">2K</SelectItem>
              <SelectItem key="4k" value="4k">4K UHD</SelectItem>
            </Select>

            <Select
              label="Frame Rate"
              selectedKeys={[String(exportConfig.frameRate)]}
              onChange={(e) => setExportConfig({ ...exportConfig, frameRate: Number(e.target.value) as any })}
            >
              <SelectItem key="24" value="24">24 fps (Cinematic)</SelectItem>
              <SelectItem key="25" value="25">25 fps (PAL)</SelectItem>
              <SelectItem key="30" value="30">30 fps (NTSC)</SelectItem>
              <SelectItem key="60" value="60">60 fps (High Frame Rate)</SelectItem>
            </Select>

            <Select
              label="Quality"
              selectedKeys={[exportConfig.quality]}
              onChange={(e) => setExportConfig({ ...exportConfig, quality: e.target.value as any })}
            >
              <SelectItem key="low" value="low">Low (Fast)</SelectItem>
              <SelectItem key="medium" value="medium">Medium</SelectItem>
              <SelectItem key="high" value="high">High</SelectItem>
              <SelectItem key="lossless" value="lossless">Lossless (Slow)</SelectItem>
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setIsExportModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isExporting}
              onPress={handleExport}
            >
              Start Export
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default TimelineEditor;
