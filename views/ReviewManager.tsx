import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Script,
  Shot,
  Keyframe,
  GeneratedImage,
  JobStatus,
  AssetType,
} from '../types';
import { storageService } from '../services/storage';
import { reviewService } from '../services/review/ReviewService';
import { useApp } from '../contexts/context';
import { useToast } from '../contexts/ToastContext';
import {
  Card,
  CardBody,
  Button,
  Chip,
  Progress,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
  Textarea,
  Badge,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@heroui/react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Edit3,
  AlertCircle,
  Film,
  Camera,
  Image as ImageIcon,
  Video,
} from 'lucide-react';

interface ReviewManagerProps {
  projectId?: string;
  setActiveTab?: (tab: AssetType) => void;
}

export const ReviewManager: React.FC<ReviewManagerProps> = ({
  projectId: propProjectId,
  setActiveTab,
}) => {
  const { projectId: urlProjectId } = useParams<{ projectId: string }>();
  const projectId = propProjectId || urlProjectId;
  const { t } = useApp();
  const { showToast } = useToast();

  const [scripts, setScripts] = useState<Script[]>([]);
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);
  const [reviewHistory, setReviewHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('pending');
  const [reviewDecision, setReviewDecision] = useState<{
    approved: boolean;
    comments: string;
  }>({
    approved: true,
    comments: '',
  });

  // 设置当前活动标签为审核管理
  useEffect(() => {
    setActiveTab?.(AssetType.SHOT);
  }, [setActiveTab]);

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      if (!projectId) {
        setIsLoading(false);
        return;
      }

      try {
        // 加载剧本数据
        const data = await storageService.getScripts(projectId);
        setScripts(data);

        // 加载待审核项
        const pending = await reviewService.getPendingReviews(projectId);
        setPendingReviews(pending);

        // 加载审核历史
        const history = await reviewService.getReviewHistory(projectId);
        setReviewHistory(history);
      } catch (error) {
        console.error('加载审核数据失败:', error);
        showToast('加载审核数据失败', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [projectId]);

  // 获取审核项的详细信息
  const getReviewDetails = async (review: any) => {
    try {
      let details = { ...review };

      // 根据类型加载详细信息
      if (review.type === 'shot') {
        // 查找对应的分镜
        for (const script of scripts) {
          const shot = script.parseState?.shots?.find((s: Shot) => s.id === review.shotId);
          if (shot) {
            details.shot = shot;
            break;
          }
        }
      } else if (review.type === 'keyframe') {
        // 查找对应的关键帧
        for (const script of scripts) {
          const shot = script.parseState?.shots?.find((s: Shot) => s.id === review.shotId);
          if (shot) {
            const keyframe = shot.keyframes?.find((kf: Keyframe) => kf.id === review.keyframeId);
            if (keyframe) {
              details.keyframe = keyframe;
              details.shot = shot;
              break;
            }
          }
        }
      } else if (review.type === 'image') {
        // 查找对应的图片
        for (const script of scripts) {
          const shot = script.parseState?.shots?.find((s: Shot) => s.id === review.shotId);
          if (shot) {
            const keyframe = shot.keyframes?.find((kf: Keyframe) => kf.id === review.keyframeId);
            if (keyframe) {
              const image = keyframe.generatedImages?.find((img: GeneratedImage) => img.id === review.imageId);
              if (image) {
                details.image = image;
                details.keyframe = keyframe;
                details.shot = shot;
                break;
              }
            }
          }
        }
      }

      return details;
    } catch (error) {
      console.error('获取审核详情失败:', error);
      return review;
    }
  };

  // 开始审核
  const handleStartReview = async (review: any) => {
    try {
      const details = await getReviewDetails(review);
      setSelectedReview(details);
      setReviewDecision({
        approved: true,
        comments: '',
      });
      setIsReviewModalOpen(true);
    } catch (error) {
      console.error('开始审核失败:', error);
      showToast('开始审核失败', 'error');
    }
  };

  // 提交审核决定
  const handleSubmitReview = async () => {
    if (!selectedReview) return;

    try {
      await reviewService.submitReviewDecision(selectedReview.id, projectId, {
        approved: reviewDecision.approved,
        comments: reviewDecision.comments,
      });

      // 刷新数据
      const pending = await reviewService.getPendingReviews(projectId);
      setPendingReviews(pending);
      const history = await reviewService.getReviewHistory(projectId);
      setReviewHistory(history);

      setIsReviewModalOpen(false);
      setSelectedReview(null);
      showToast('审核完成', 'success');
    } catch (error) {
      console.error('提交审核决定失败:', error);
      showToast('提交审核决定失败', 'error');
    }
  };

  // 获取状态标签
  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case JobStatus.NEEDS_REVIEW:
        return <Badge color="warning">待审核</Badge>;
      case JobStatus.IN_REVIEW:
        return <Badge color="primary">审核中</Badge>;
      case JobStatus.APPROVED:
        return <Badge color="success">已通过</Badge>;
      case JobStatus.REJECTED:
        return <Badge color="danger">已拒绝</Badge>;
      default:
        return <Badge color="default">未知</Badge>;
    }
  };

  // 获取类型图标
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'shot':
        return <Film size={16} />;
      case 'keyframe':
        return <Camera size={16} />;
      case 'image':
        return <ImageIcon size={16} />;
      case 'video':
        return <Video size={16} />;
      default:
        return <Eye size={16} />;
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Progress size="sm" isIndeterminate aria-label="加载中..." />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* 头部 */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">审核管理</h1>
            <p className="text-sm text-slate-500 mt-1">
              管理AI生成内容的审核流程
            </p>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* 标签切换 */}
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={setSelectedTab}
            className="mb-6"
          >
            <Tab key="pending" title="待审核" />
            <Tab key="history" title="审核历史" />
          </Tabs>

          {/* 待审核列表 */}
          {selectedTab === 'pending' && (
            <Card className="shadow-lg border-none">
              <CardBody className="p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  待审核项目 ({pendingReviews.length})
                </h2>
                
                {pendingReviews.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">暂无待审核项目</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell>类型</TableCell>
                        <TableCell>项目信息</TableCell>
                        <TableCell>状态</TableCell>
                        <TableCell>创建时间</TableCell>
                        <TableCell>操作</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingReviews.map((review) => (
                        <TableRow key={review.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTypeIcon(review.type)}
                              <span className="text-sm font-medium">
                                {review.type === 'shot' ? '分镜' :
                                 review.type === 'keyframe' ? '关键帧' :
                                 review.type === 'image' ? '生成图片' : '视频'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {review.metadata?.sceneName && (
                                <div className="font-medium">{review.metadata.sceneName}</div>
                              )}
                              {review.metadata?.shotNumber && (
                                <div className="text-slate-500">{review.metadata.shotNumber}</div>
                              )}
                              {review.metadata?.description && (
                                <div className="text-slate-600 dark:text-slate-400 truncate">
                                  {review.metadata.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(review.status)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-slate-500">
                              {new Date(review.createdAt).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              color="primary"
                              variant="flat"
                              onPress={() => handleStartReview(review)}
                            >
                              审核
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardBody>
            </Card>
          )}

          {/* 审核历史 */}
          {selectedTab === 'history' && (
            <Card className="shadow-lg border-none">
              <CardBody className="p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  审核历史 ({reviewHistory.length})
                </h2>
                
                {reviewHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock size={48} className="mx-auto text-slate-400 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">暂无审核历史</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell>类型</TableCell>
                        <TableCell>项目信息</TableCell>
                        <TableCell>状态</TableCell>
                        <TableCell>审核时间</TableCell>
                        <TableCell>评论</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviewHistory.map((review) => (
                        <TableRow key={review.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTypeIcon(review.type)}
                              <span className="text-sm font-medium">
                                {review.type === 'shot' ? '分镜' :
                                 review.type === 'keyframe' ? '关键帧' :
                                 review.type === 'image' ? '生成图片' : '视频'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {review.metadata?.sceneName && (
                                <div className="font-medium">{review.metadata.sceneName}</div>
                              )}
                              {review.metadata?.shotNumber && (
                                <div className="text-slate-500">{review.metadata.shotNumber}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(review.status)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-slate-500">
                              {new Date(review.updatedAt).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              {review.metadata?.comments || '无'}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* 审核模态框 */}
      <Modal isOpen={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <h2 className="text-lg font-semibold">审核项目</h2>
          </ModalHeader>
          <ModalBody>
            {selectedReview && (
              <div className="space-y-4">
                {/* 项目信息 */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {getTypeIcon(selectedReview.type)}
                    <h3 className="font-medium">
                      {selectedReview.type === 'shot' ? '分镜' :
                       selectedReview.type === 'keyframe' ? '关键帧' :
                       selectedReview.type === 'image' ? '生成图片' : '视频'}
                    </h3>
                  </div>
                  
                  {selectedReview.shot && (
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">场景：</span>
                        {selectedReview.shot.sceneName}
                      </div>
                      <div>
                        <span className="font-medium">镜号：</span>
                        {selectedReview.shot.shotNumber || selectedReview.shot.sequence}
                      </div>
                      <div>
                        <span className="font-medium">描述：</span>
                        {selectedReview.shot.description}
                      </div>
                    </div>
                  )}
                  
                  {selectedReview.keyframe && (
                    <div className="space-y-2 text-sm mt-2">
                      <div>
                        <span className="font-medium">关键帧序号：</span>
                        {selectedReview.keyframe.sequence}
                      </div>
                      <div>
                        <span className="font-medium">关键帧类型：</span>
                        {selectedReview.keyframe.frameType}
                      </div>
                      <div>
                        <span className="font-medium">描述：</span>
                        {selectedReview.keyframe.description}
                      </div>
                    </div>
                  )}
                  
                  {selectedReview.image && (
                    <div className="mt-4">
                      <div className="font-medium mb-2">生成图片：</div>
                      <div className="rounded-lg overflow-hidden">
                        <img 
                          src={selectedReview.image.path} 
                          alt="生成图片" 
                          className="w-full h-auto max-h-64 object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* 审核决定 */}
                <div>
                  <h3 className="font-medium mb-3">审核决定</h3>
                  <div className="flex gap-4 mb-4">
                    <Button
                      color={reviewDecision.approved ? 'success' : 'default'}
                      variant={reviewDecision.approved ? 'solid' : 'flat'}
                      onPress={() => setReviewDecision({ ...reviewDecision, approved: true })}
                      className="flex-1"
                    >
                      <CheckCircle2 size={16} className="mr-2" />
                      通过
                    </Button>
                    <Button
                      color={!reviewDecision.approved ? 'danger' : 'default'}
                      variant={!reviewDecision.approved ? 'solid' : 'flat'}
                      onPress={() => setReviewDecision({ ...reviewDecision, approved: false })}
                      className="flex-1"
                    >
                      <XCircle size={16} className="mr-2" />
                      拒绝
                    </Button>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">评论</label>
                    <Textarea
                      value={reviewDecision.comments}
                      onChange={(e) => setReviewDecision({ ...reviewDecision, comments: e.target.value })}
                      placeholder="请输入审核评论..."
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setIsReviewModalOpen(false)}>
              取消
            </Button>
            <Button color="primary" onPress={handleSubmitReview}>
              提交审核
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default ReviewManager;
