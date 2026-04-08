import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Chip,
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Divider,
  ScrollShadow,
  Spinner,
} from '@heroui/react';
import {
  Book,
  Search,
  Plus,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Copy,
  FileJson,
  Filter,
  CheckCircle2,
  Play,
  Users,
  MapPin,
  Film,
  Eye,
  X,
} from 'lucide-react';
import { Story } from '../services/dataset/types';
import {
  annotationSampleService,
  AnnotationSampleStats,
} from '../services/dataset/annotationSampleService';
import { useToast } from '../contexts/ToastContext';
import DeleteConfirmModal from './Shared/DeleteConfirmModal';

const AnnotationSampleManager: React.FC = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const [stats, setStats] = useState<AnnotationSampleStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoryIds, setSelectedStoryIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const { isOpen: isImportOpen, onOpen: onImportOpen, onClose: onImportClose } = useDisclosure();
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure();
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [importJson, setImportJson] = useState('');
  const { showToast } = useToast();

  const [deleteModalConfig, setDeleteModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const loadData = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => {
      setStories(annotationSampleService.getAllStories());
      setStats(annotationSampleService.getStats());
      setIsLoading(false);
    }, 300);
  }, []);

  useEffect(() => {
    loadData();
    return annotationSampleService.subscribe(loadData);
  }, [loadData]);

  const filteredStories = searchQuery
    ? annotationSampleService.searchStories(searchQuery)
    : stories;

  const showDeleteModal = (title: string, description: string, onConfirm: () => void) => {
    setDeleteModalConfig({
      isOpen: true,
      title,
      description,
      onConfirm: () => {
        onConfirm();
        setDeleteModalConfig(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleDeleteStory = (id: string, title: string) => {
    showDeleteModal('删除标注样本', `确定要删除标注样本"${title}"吗？此操作无法撤销。`, () => {
      const success = annotationSampleService.deleteStory(id);
      if (success) {
        showToast('样本已删除', 'success');
      }
    });
  };

  const handleDeleteSelected = () => {
    showDeleteModal(
      '批量删除标注样本',
      `确定要删除选中的 ${selectedStoryIds.size} 个标注样本吗？此操作无法撤销。`,
      () => {
        const count = annotationSampleService.deleteMultipleStories([...selectedStoryIds]);
        showToast(`已删除 ${count} 个样本`, 'success');
        setSelectedStoryIds(new Set());
      }
    );
  };

  const handleDuplicateStory = (id: string) => {
    const duplicated = annotationSampleService.duplicateStory(id);
    if (duplicated) {
      showToast('样本已复制', 'success');
    }
  };

  const handleExport = () => {
    const json = annotationSampleService.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annotation-samples-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('样本已导出', 'success');
  };

  const handleImport = () => {
    const success = annotationSampleService.importFromJSON(importJson);
    if (success) {
      showToast('样本已导入', 'success');
      onImportClose();
      setImportJson('');
    } else {
      showToast('导入失败，请检查JSON格式', 'error');
    }
  };

  const handleReset = () => {
    showDeleteModal(
      '重置为默认样本',
      '确定要重置所有样本为默认值吗？这将删除您的所有自定义样本，此操作无法撤销。',
      () => {
        annotationSampleService.resetToDefaults();
        showToast('已重置为默认样本', 'success');
        setSelectedStoryIds(new Set());
      }
    );
  };

  const handleCreateSample = () => {
    showToast('新建样本功能即将上线', 'info');
  };

  const handleViewSample = (story: Story) => {
    setViewingStory(story);
    onViewOpen();
  };

  const toggleSelectAll = () => {
    if (selectedStoryIds.size === filteredStories.length) {
      setSelectedStoryIds(new Set());
    } else {
      setSelectedStoryIds(new Set(filteredStories.map(s => s.id)));
    }
  };

  const toggleSelectStory = (id: string) => {
    const newSet = new Set(selectedStoryIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedStoryIds(newSet);
  };

  const formatDate = (date?: Date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">标注样本库管理</h1>
            <p className="text-slate-400 mt-1">管理和维护高质量的影视分镜标注样本</p>
          </div>
          <div className="flex gap-2">
            <Button color="primary" startContent={<Plus size={18} />} onPress={handleCreateSample}>
              新建样本
            </Button>
            <Button startContent={<Upload size={18} />} onPress={onImportOpen}>
              导入
            </Button>
            <Button startContent={<Download size={18} />} onPress={handleExport}>
              导出
            </Button>
            <Button
              startContent={<RefreshCw size={18} />}
              color="danger"
              variant="light"
              onPress={handleReset}
            >
              重置
            </Button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card className="bg-content1">
              <CardBody className="flex flex-col gap-1">
                <span className="text-slate-400 text-sm">故事总数</span>
                <span className="text-3xl font-bold text-primary">{stats.totalStories}</span>
              </CardBody>
            </Card>
            <Card className="bg-content1">
              <CardBody className="flex flex-col gap-1">
                <span className="text-slate-400 text-sm">分镜总数</span>
                <span className="text-3xl font-bold text-primary">{stats.totalShots}</span>
              </CardBody>
            </Card>
            <Card className="bg-content1">
              <CardBody className="flex flex-col gap-1">
                <span className="text-slate-400 text-sm">角色总数</span>
                <span className="text-3xl font-bold text-primary">{stats.totalCharacters}</span>
              </CardBody>
            </Card>
            <Card className="bg-content1">
              <CardBody className="flex flex-col gap-1">
                <span className="text-slate-400 text-sm">场景总数</span>
                <span className="text-3xl font-bold text-primary">{stats.totalScenes}</span>
              </CardBody>
            </Card>
            <Card className="bg-content1">
              <CardBody className="flex flex-col gap-1">
                <span className="text-slate-400 text-sm">平均质量分</span>
                <span className="text-3xl font-bold text-success">{stats.averageQualityScore}</span>
              </CardBody>
            </Card>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex gap-2 flex-1">
            <Input
              classNames={{ inputWrapper: 'bg-content1' }}
              placeholder="搜索故事标题、梗概或角色..."
              startContent={<Search size={18} className="text-slate-400" />}
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <Button isIconOnly variant="light" aria-label="筛选">
              <Filter size={18} />
            </Button>
          </div>
          {selectedStoryIds.size > 0 && (
            <div className="flex gap-2 items-center">
              <Chip color="primary">已选择 {selectedStoryIds.size} 个</Chip>
              <Button
                color="danger"
                variant="light"
                startContent={<Trash2 size={18} />}
                onPress={handleDeleteSelected}
              >
                批量删除
              </Button>
            </div>
          )}
        </div>
      </div>

      <ScrollShadow className="flex-1 -mx-6 px-6">
        <div className="grid grid-cols-1 gap-4 pb-6">
          <Card className="bg-content1">
            <CardHeader className="flex gap-3">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={
                  selectedStoryIds.size === filteredStories.length && filteredStories.length > 0
                }
                onChange={toggleSelectAll}
              />
              <div className="flex-1 grid grid-cols-12 gap-4 text-sm font-medium text-slate-400">
                <div className="col-span-4">故事信息</div>
                <div className="col-span-2 text-center">角色</div>
                <div className="col-span-2 text-center">场景</div>
                <div className="col-span-2 text-center">分镜</div>
                <div className="col-span-1 text-center">更新时间</div>
                <div className="col-span-1 text-right">操作</div>
              </div>
            </CardHeader>
            <Divider />
            <CardBody className="p-0">
              {filteredStories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Book size={48} className="mb-4 opacity-50" />
                  <p>没有找到匹配的标注样本</p>
                </div>
              ) : (
                filteredStories.map(story => (
                  <div key={story.id} className="border-b border-content3 last:border-0">
                    <div className="p-4 flex gap-3 items-center hover:bg-content2/50 transition-colors">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={selectedStoryIds.has(story.id)}
                        onChange={() => toggleSelectStory(story.id)}
                      />
                      <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground truncate">{story.title}</h3>
                            <p className="text-sm text-slate-400 line-clamp-2 mt-1">
                              {story.synopsis}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <Chip
                                color="success"
                                variant="flat"
                                startContent={<CheckCircle2 size={16} />}
                              >
                                高质量
                              </Chip>
                            </div>
                          </div>
                        </div>
                        <div className="col-span-2 text-center">
                          <div className="flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <Users size={16} className="text-slate-500" />
                            <span className="font-bold text-sm">
                              {story.characters?.length || 0}
                            </span>
                          </div>
                        </div>
                        <div className="col-span-2 text-center">
                          <div className="flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <MapPin size={16} className="text-slate-500" />
                            <span className="font-bold text-sm">{story.scenes?.length || 0}</span>
                          </div>
                        </div>
                        <div className="col-span-2 text-center">
                          <div className="flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <Film size={16} className="text-slate-500" />
                            <span className="font-bold text-sm">{story.shots?.length || 0}</span>
                          </div>
                        </div>
                        <div className="col-span-1 text-center text-sm text-slate-400">
                          {formatDate(story.updatedAt)}
                        </div>
                        <div className="col-span-1 text-right">
                          <div className="flex justify-end gap-1">
                            <Tooltip content="查看详情">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                aria-label="查看详情"
                                onPress={() => handleViewSample(story)}
                              >
                                <Eye size={16} />
                              </Button>
                            </Tooltip>
                            <Tooltip content="复制样本">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                aria-label="复制"
                                onPress={() => handleDuplicateStory(story.id)}
                              >
                                <Copy size={16} />
                              </Button>
                            </Tooltip>
                            <Tooltip content="删除">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="danger"
                                aria-label="删除"
                                onPress={() => handleDeleteStory(story.id, story.title)}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </ScrollShadow>

      <Modal isOpen={isImportOpen} onClose={onImportClose} size="3xl">
        <ModalContent>
          <ModalHeader>导入标注样本</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <p className="text-slate-400">请粘贴JSON格式的标注样本数据，或选择文件上传。</p>
              <textarea
                className="w-full h-64 p-4 rounded-lg bg-content1 border border-content3 text-foreground font-mono text-sm"
                placeholder='{"stories": [...]}'
                value={importJson}
                onChange={e => setImportJson(e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  id="json-upload"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = event => {
                        setImportJson(event.target?.result as string);
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
                <Button as="label" htmlFor="json-upload" startContent={<FileJson size={18} />}>
                  选择文件
                </Button>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onImportClose}>
              取消
            </Button>
            <Button color="primary" onPress={handleImport}>
              导入
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <DeleteConfirmModal
        isOpen={deleteModalConfig.isOpen}
        onClose={() => setDeleteModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={deleteModalConfig.onConfirm}
        title={deleteModalConfig.title}
        description={deleteModalConfig.description}
      />

      {/* 查看详情Modal */}
      <Modal isOpen={isViewOpen} onClose={onViewClose} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            <h3 className="text-xl font-bold">{viewingStory?.title}</h3>
          </ModalHeader>
          <ModalBody>
            {viewingStory && (
              <div className="space-y-8">
                {/* 故事梗概 */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Book size={18} className="text-primary" />
                    <h4 className="font-bold text-sm text-foreground">故事梗概</h4>
                  </div>
                  <div className="p-4 bg-content1 rounded-xl">
                    <p className="text-sm text-foreground leading-relaxed">
                      {viewingStory.synopsis}
                    </p>
                  </div>
                </section>

                {/* 统计信息 */}
                <section>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
                      <div className="text-3xl font-bold text-primary">
                        {viewingStory.characters?.length || 0}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">角色</div>
                    </div>
                    <div className="text-center p-5 bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-xl border border-secondary/20">
                      <div className="text-3xl font-bold text-secondary">
                        {viewingStory.scenes?.length || 0}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">场景</div>
                    </div>
                    <div className="text-center p-5 bg-gradient-to-br from-success/10 to-success/5 rounded-xl border border-success/20">
                      <div className="text-3xl font-bold text-success">
                        {viewingStory.shots?.length || 0}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">分镜</div>
                    </div>
                  </div>
                </section>

                {/* 角色列表 */}
                {viewingStory.characters && viewingStory.characters.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Users size={18} className="text-primary" />
                      <h4 className="font-bold text-sm text-foreground">角色列表</h4>
                      <Chip variant="flat" className="ml-auto">
                        {viewingStory.characters.length}
                      </Chip>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {viewingStory.characters.map((char, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-content1 rounded-xl border border-content3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="font-semibold text-foreground">{char.name}</div>
                            {char.nameEn && (
                              <div className="text-xs text-slate-500">{char.nameEn}</div>
                            )}
                          </div>
                          {char.personality && (
                            <div className="text-xs text-slate-400 mt-2">{char.personality}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 分镜列表 - 完整显示 */}
                {viewingStory.shots && viewingStory.shots.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Film size={18} className="text-primary" />
                      <h4 className="font-bold text-sm text-foreground">分镜列表</h4>
                      <Chip variant="flat" className="ml-auto">
                        {viewingStory.shots.length}
                      </Chip>
                    </div>
                    <div className="space-y-3">
                      {viewingStory.shots.map((shot, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-content1 rounded-xl border border-content3"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-bold text-primary text-sm">
                              {shot.shotNumber}
                            </span>
                            {shot.shotType && <Chip variant="flat">{shot.shotType}</Chip>}
                          </div>
                          {shot.visualDescription && (
                            <div className="text-sm text-slate-300 mt-2 leading-relaxed">
                              {shot.visualDescription}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onPress={onViewClose}>
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default AnnotationSampleManager;
