import { Job, JobStatus, Shot, Keyframe, GeneratedImage } from '../../types';
import { storageService } from '../storage';

interface ReviewItem {
  id: string;
  type: 'shot' | 'keyframe' | 'image' | 'video';
  entityId: string;
  projectId: string;
  scriptId: string;
  shotId?: string;
  keyframeId?: string;
  imageId?: string;
  videoId?: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

interface ReviewDecision {
  approved: boolean;
  comments?: string;
  adjustments?: Record<string, any>;
}

export class ReviewService {
  /**
   * 创建审核项
   */
  async createReviewItem(item: Omit<ReviewItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReviewItem> {
    const reviewItem: ReviewItem = {
      ...item,
      id: `review_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await storageService.saveReviewItem(reviewItem);
    return reviewItem;
  }

  /**
   * 获取待审核项
   */
  async getPendingReviews(projectId: string): Promise<ReviewItem[]> {
    const reviews = await storageService.getReviewItems(projectId);
    return reviews.filter(item => 
      item.status === JobStatus.NEEDS_REVIEW || item.status === JobStatus.IN_REVIEW
    );
  }

  /**
   * 提交审核决定
   */
  async submitReviewDecision(
    reviewId: string,
    projectId: string,
    decision: ReviewDecision
  ): Promise<ReviewItem> {
    const reviewItem = await storageService.getReviewItem(reviewId, projectId);
    if (!reviewItem) {
      throw new Error('审核项不存在');
    }

    const updatedReview: ReviewItem = {
      ...reviewItem,
      status: decision.approved ? JobStatus.APPROVED : JobStatus.REJECTED,
      updatedAt: Date.now(),
      metadata: {
        ...reviewItem.metadata,
        comments: decision.comments,
        adjustments: decision.adjustments,
      },
    };

    await storageService.saveReviewItem(updatedReview);
    return updatedReview;
  }

  /**
   * 将任务标记为需要审核
   */
  async markForReview(job: Job): Promise<void> {
    if (job.status !== JobStatus.COMPLETED) {
      throw new Error('只有完成的任务才能标记为需要审核');
    }

    const updatedJob = {
      ...job,
      status: JobStatus.NEEDS_REVIEW,
      updatedAt: Date.now(),
    };

    await storageService.saveJob(updatedJob);
  }

  /**
   * 开始审核
   */
  async startReview(reviewId: string, projectId: string): Promise<ReviewItem> {
    const reviewItem = await storageService.getReviewItem(reviewId, projectId);
    if (!reviewItem) {
      throw new Error('审核项不存在');
    }

    const updatedReview: ReviewItem = {
      ...reviewItem,
      status: JobStatus.IN_REVIEW,
      updatedAt: Date.now(),
    };

    await storageService.saveReviewItem(updatedReview);
    return updatedReview;
  }

  /**
   * 获取审核历史
   */
  async getReviewHistory(projectId: string): Promise<ReviewItem[]> {
    const reviews = await storageService.getReviewItems(projectId);
    return reviews.filter(item => 
      item.status === JobStatus.APPROVED || item.status === JobStatus.REJECTED
    );
  }

  /**
   * 为分镜创建审核项
   */
  async createShotReview(
    shot: Shot,
    projectId: string,
    scriptId: string
  ): Promise<ReviewItem> {
    return this.createReviewItem({
      type: 'shot',
      entityId: shot.id,
      projectId,
      scriptId,
      shotId: shot.id,
      status: JobStatus.NEEDS_REVIEW,
      metadata: {
        shotNumber: shot.shotNumber,
        sceneName: shot.sceneName,
        description: shot.description,
        duration: shot.duration,
        contentType: shot.contentType,
      },
    });
  }

  /**
   * 为关键帧创建审核项
   */
  async createKeyframeReview(
    keyframe: Keyframe,
    shot: Shot,
    projectId: string,
    scriptId: string
  ): Promise<ReviewItem> {
    return this.createReviewItem({
      type: 'keyframe',
      entityId: keyframe.id,
      projectId,
      scriptId,
      shotId: shot.id,
      keyframeId: keyframe.id,
      status: JobStatus.NEEDS_REVIEW,
      metadata: {
        sequence: keyframe.sequence,
        frameType: keyframe.frameType,
        description: keyframe.description,
        shotNumber: shot.shotNumber,
        sceneName: shot.sceneName,
      },
    });
  }

  /**
   * 为生成的图片创建审核项
   */
  async createImageReview(
    image: GeneratedImage,
    keyframe: Keyframe,
    shot: Shot,
    projectId: string,
    scriptId: string
  ): Promise<ReviewItem> {
    return this.createReviewItem({
      type: 'image',
      entityId: image.id,
      projectId,
      scriptId,
      shotId: shot.id,
      keyframeId: keyframe.id,
      imageId: image.id,
      status: JobStatus.NEEDS_REVIEW,
      metadata: {
        prompt: image.prompt,
        keyframeSequence: keyframe.sequence,
        shotNumber: shot.shotNumber,
        sceneName: shot.sceneName,
        width: image.width,
        height: image.height,
      },
    });
  }
}

export const reviewService = new ReviewService();
