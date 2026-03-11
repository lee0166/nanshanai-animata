import { Timeline, TimelineTrack, TimelineClip, Shot, ExportConfig } from '../../types';
import { storageService } from '../storage';

export interface CreateTimelineParams {
  projectId: string;
  scriptId: string;
  name: string;
  shots: Shot[];
}

export interface ExportTimelineParams {
  timeline: Timeline;
  config: ExportConfig;
  outputPath: string;
}

export interface TimelineOperationResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * 时间轴服务
 * 管理时间轴的创建、编辑和导出
 */
export class TimelineService {
  private readonly STORAGE_KEY = 'timelines';

  /**
   * 从分镜列表创建时间轴
   */
  async createTimeline(params: CreateTimelineParams): Promise<TimelineOperationResult> {
    try {
      const { projectId, scriptId, name, shots } = params;

      console.log(`[TimelineService] Creating timeline for ${shots.length} shots`);

      // 按sequence排序分镜
      const sortedShots = [...shots].sort((a, b) => a.sequence - b.sequence);

      // 创建视频轨道
      const videoClips: TimelineClip[] = [];
      let currentTime = 0;

      for (const shot of sortedShots) {
        if (shot.generatedVideo) {
          const duration = shot.duration || 5;
          const clip: TimelineClip = {
            id: `clip_${shot.id}`,
            shotId: shot.id,
            name: `${shot.sceneName} - ${shot.shotNumber || shot.sequence}`,
            startTime: currentTime,
            endTime: currentTime + duration,
            duration: duration,
            sourcePath: shot.generatedVideo,
            transition: { type: 'cut', duration: 0 },
          };
          videoClips.push(clip);
          currentTime += duration;
        }
      }

      const videoTrack: TimelineTrack = {
        id: `track_video_${Date.now()}`,
        type: 'video',
        name: '视频轨道',
        clips: videoClips,
      };

      const timeline: Timeline = {
        id: `timeline_${Date.now()}`,
        projectId,
        scriptId,
        name,
        tracks: [videoTrack],
        totalDuration: currentTime,
        resolution: '1920x1080',
        frameRate: 24,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // 保存到存储
      await this.saveTimeline(timeline);

      return { success: true, data: timeline };
    } catch (error) {
      console.error('[TimelineService] Create timeline failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 获取时间轴
   */
  async getTimeline(timelineId: string): Promise<Timeline | null> {
    try {
      const timelines = await this.getAllTimelines();
      return timelines.find(t => t.id === timelineId) || null;
    } catch (error) {
      console.error('[TimelineService] Get timeline failed:', error);
      return null;
    }
  }

  /**
   * 获取项目的所有时间轴
   */
  async getTimelinesByProject(projectId: string): Promise<Timeline[]> {
    try {
      const timelines = await this.getAllTimelines();
      return timelines.filter(t => t.projectId === projectId);
    } catch (error) {
      console.error('[TimelineService] Get timelines failed:', error);
      return [];
    }
  }

  /**
   * 更新片段在时间轴上的位置
   */
  async moveClip(
    timelineId: string,
    trackId: string,
    clipId: string,
    newStartTime: number
  ): Promise<TimelineOperationResult> {
    try {
      const timeline = await this.getTimeline(timelineId);
      if (!timeline) {
        return { success: false, error: '时间轴不存在' };
      }

      const track = timeline.tracks.find(t => t.id === trackId);
      if (!track) {
        return { success: false, error: '轨道不存在' };
      }

      const clipIndex = track.clips.findIndex(c => c.id === clipId);
      if (clipIndex === -1) {
        return { success: false, error: '片段不存在' };
      }

      const clip = track.clips[clipIndex];
      const duration = clip.duration;

      // 更新片段时间
      clip.startTime = newStartTime;
      clip.endTime = newStartTime + duration;

      // 重新排序片段
      track.clips.sort((a, b) => a.startTime - b.startTime);

      // 更新时间轴总时长
      timeline.totalDuration = Math.max(...track.clips.map(c => c.endTime), 0);
      timeline.updatedAt = Date.now();

      await this.saveTimeline(timeline);

      return { success: true, data: timeline };
    } catch (error) {
      console.error('[TimelineService] Move clip failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 重新排序片段（拖拽排序后使用）
   */
  async reorderClips(
    timelineId: string,
    trackId: string,
    clipOrder: string[]
  ): Promise<TimelineOperationResult> {
    try {
      const timeline = await this.getTimeline(timelineId);
      if (!timeline) {
        return { success: false, error: '时间轴不存在' };
      }

      const track = timeline.tracks.find(t => t.id === trackId);
      if (!track) {
        return { success: false, error: '轨道不存在' };
      }

      // 根据新的顺序重新排列片段
      const newClips: TimelineClip[] = [];
      let currentTime = 0;

      for (const clipId of clipOrder) {
        const clip = track.clips.find(c => c.id === clipId);
        if (clip) {
          clip.startTime = currentTime;
          clip.endTime = currentTime + clip.duration;
          newClips.push(clip);
          currentTime += clip.duration;
        }
      }

      track.clips = newClips;
      timeline.totalDuration = currentTime;
      timeline.updatedAt = Date.now();

      await this.saveTimeline(timeline);

      return { success: true, data: timeline };
    } catch (error) {
      console.error('[TimelineService] Reorder clips failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 删除片段
   */
  async deleteClip(
    timelineId: string,
    trackId: string,
    clipId: string
  ): Promise<TimelineOperationResult> {
    try {
      const timeline = await this.getTimeline(timelineId);
      if (!timeline) {
        return { success: false, error: '时间轴不存在' };
      }

      const track = timeline.tracks.find(t => t.id === trackId);
      if (!track) {
        return { success: false, error: '轨道不存在' };
      }

      track.clips = track.clips.filter(c => c.id !== clipId);

      // 重新计算时间
      let currentTime = 0;
      for (const clip of track.clips) {
        clip.startTime = currentTime;
        clip.endTime = currentTime + clip.duration;
        currentTime += clip.duration;
      }

      timeline.totalDuration = currentTime;
      timeline.updatedAt = Date.now();

      await this.saveTimeline(timeline);

      return { success: true, data: timeline };
    } catch (error) {
      console.error('[TimelineService] Delete clip failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 导出时间轴为视频文件
   * 注意：这是一个模拟实现，实际需要使用FFmpeg等工具
   */
  async exportVideo(params: ExportTimelineParams): Promise<TimelineOperationResult> {
    try {
      const { timeline, config, outputPath } = params;

      console.log(`[TimelineService] Exporting timeline to ${outputPath}`);
      console.log(`[TimelineService] Format: ${config.format}, Resolution: ${config.resolution}`);

      // 收集所有视频片段
      const videoTrack = timeline.tracks.find(t => t.type === 'video');
      if (!videoTrack || videoTrack.clips.length === 0) {
        return { success: false, error: '没有可导出的视频片段' };
      }

      // 在实际应用中，这里应该调用FFmpeg进行视频拼接
      // 由于浏览器环境限制，我们创建一个导出任务记录
      const exportTask = {
        id: `export_${Date.now()}`,
        timelineId: timeline.id,
        config,
        outputPath,
        status: 'pending' as const,
        progress: 0,
        createdAt: Date.now(),
      };

      // 保存导出任务
      await this.saveExportTask(exportTask);

      // 模拟导出过程
      setTimeout(() => {
        this.simulateExport(exportTask.id);
      }, 100);

      return { success: true, data: exportTask };
    } catch (error) {
      console.error('[TimelineService] Export video failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 导出为Premiere Pro工程文件（XML格式）
   */
  async exportToPremiere(timeline: Timeline, outputPath: string): Promise<TimelineOperationResult> {
    try {
      const xml = this.generatePremiereXML(timeline);
      await storageService.saveTextFile(outputPath, xml);
      return { success: true, data: { path: outputPath } };
    } catch (error) {
      console.error('[TimelineService] Export to Premiere failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 导出为Final Cut Pro工程文件（FCPXML格式）
   */
  async exportToFCPX(timeline: Timeline, outputPath: string): Promise<TimelineOperationResult> {
    try {
      const xml = this.generateFCPXML(timeline);
      await storageService.saveTextFile(outputPath, xml);
      return { success: true, data: { path: outputPath } };
    } catch (error) {
      console.error('[TimelineService] Export to FCPX failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 生成Premiere Pro XML
   */
  private generatePremiereXML(timeline: Timeline): string {
    const videoTrack = timeline.tracks.find(t => t.type === 'video');
    const clips = videoTrack?.clips || [];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<PremiereData Version="3">
  <Project Name="${timeline.name}">
    <Sequence ID="${timeline.id}">
      <Tracks>
        <VideoTrack>`;

    for (const clip of clips) {
      xml += `
          <Clip>
            <Name>${clip.name}</Name>
            <Start>${clip.startTime}</Start>
            <End>${clip.endTime}</End>
            <Duration>${clip.duration}</Duration>
            <FilePath>${clip.sourcePath}</FilePath>
          </Clip>`;
    }

    xml += `
        </VideoTrack>
      </Tracks>
    </Sequence>
  </Project>
</PremiereData>`;

    return xml;
  }

  /**
   * 生成Final Cut Pro X XML
   */
  private generateFCPXML(timeline: Timeline): string {
    const videoTrack = timeline.tracks.find(t => t.type === 'video');
    const clips = videoTrack?.clips || [];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<fcpxml version="1.9">
  <resources>
    <format id="r1" name="FFVideoFormat1080p24" frameDuration="1/24s" width="1920" height="1080"/>
  </resources>
  <library>
    <event name="${timeline.name}">
      <project name="${timeline.name}">`;

    for (const clip of clips) {
      xml += `
        <clip name="${clip.name}" offset="${clip.startTime}s" duration="${clip.duration}s">
          <video>
            <asset src="${clip.sourcePath}"/>
          </video>
        </clip>`;
    }

    xml += `
      </project>
    </event>
  </library>
</fcpxml>`;

    return xml;
  }

  /**
   * 模拟导出过程
   */
  private async simulateExport(taskId: string): Promise<void> {
    const task = await this.getExportTask(taskId);
    if (!task) return;

    task.status = 'processing';
    await this.saveExportTask(task);

    // 模拟进度更新
    const interval = setInterval(async () => {
      task.progress += 10;
      if (task.progress >= 100) {
        task.progress = 100;
        task.status = 'completed';
        clearInterval(interval);
      }
      await this.saveExportTask(task);
    }, 500);
  }

  /**
   * 获取所有时间轴
   */
  private async getAllTimelines(): Promise<Timeline[]> {
    const data = await storageService.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  /**
   * 保存时间轴
   */
  private async saveTimeline(timeline: Timeline): Promise<void> {
    const timelines = await this.getAllTimelines();
    const index = timelines.findIndex(t => t.id === timeline.id);

    if (index >= 0) {
      timelines[index] = timeline;
    } else {
      timelines.push(timeline);
    }

    await storageService.setItem(this.STORAGE_KEY, JSON.stringify(timelines));
  }

  /**
   * 获取导出任务
   */
  private async getExportTask(taskId: string): Promise<any | null> {
    const data = await storageService.getItem('export_tasks');
    const tasks = data ? JSON.parse(data) : [];
    return tasks.find((t: any) => t.id === taskId) || null;
  }

  /**
   * 保存导出任务
   */
  private async saveExportTask(task: any): Promise<void> {
    const data = await storageService.getItem('export_tasks');
    const tasks = data ? JSON.parse(data) : [];
    const index = tasks.findIndex((t: any) => t.id === task.id);

    if (index >= 0) {
      tasks[index] = task;
    } else {
      tasks.push(task);
    }

    await storageService.setItem('export_tasks', JSON.stringify(tasks));
  }
}

export const timelineService = new TimelineService();
