import React, { useEffect, useState } from 'react';
import { Project } from '../types';
import { storageService } from '../services/storage';
import { Plus, Trash2, Folder, ExternalLink, AlertTriangle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/context';
import { useToast } from '../contexts/ToastContext';
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Input,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Tooltip,
  Divider,
} from '@heroui/react';

const Dashboard: React.FC = () => {
  const { t, settings } = useApp();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Disclosures
  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();

  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await storageService.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('[DASHBOARD] Failed to load projects:', error);
      showToast(
        settings.language === 'zh'
          ? '加载项目失败，请检查存储权限。'
          : 'Failed to load projects. Please check storage permissions.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newProjectName) {
      showToast(
        settings.language === 'zh' ? '请输入项目名称。' : 'Please enter a project name.',
        'warning'
      );
      return;
    }

    try {
      const newProject: Project = {
        id:
          typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 11),
        name: newProjectName,
        description: newProjectDesc,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storageService.saveProject(newProject);

      onCreateClose();
      setNewProjectName('');
      setNewProjectDesc('');
      await loadProjects();
      showToast(
        settings.language === 'zh' ? '项目创建成功！' : 'Project created successfully!',
        'success'
      );
    } catch (error) {
      console.error('[DASHBOARD] Failed to create project:', error);
      showToast(
        settings.language === 'zh'
          ? '创建项目失败，请检查存储权限。'
          : 'Failed to create project. Please check storage permissions.',
        'error'
      );
    }
  };

  const onRequestDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setProjectToDelete(id);
    onDeleteOpen();
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      await storageService.deleteProject(projectToDelete);
      await loadProjects();
      showToast(
        settings.language === 'zh' ? '项目删除成功！' : 'Project deleted successfully!',
        'success'
      );
    } catch (error) {
      console.error('Failed to delete project:', error);
      showToast(
        settings.language === 'zh'
          ? '删除项目失败，请重试。'
          : 'Failed to delete project. Please try again.',
        'error'
      );
    } finally {
      setProjectToDelete(null);
      onDeleteClose();
    }
  };

  const handleCardClick = (id: string) => {
    navigate(`/project/${id}`);
  };

  return (
    <div className="h-full overflow-y-auto p-6 md:p-10 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200">
      <div className="flex justify-between items-center mb-10 max-w-[1600px] mx-auto">
        <div className="animate-fadeIn">
          <h1 className="text-4xl md:text-5xl font-black mb-2 uppercase tracking-tighter text-primary">
            {t.dashboard.title}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">
            {t.dashboard.subtitle}
          </p>
        </div>
        <Button
          size="lg"
          radius="full"
          startContent={<Plus className="w-5 h-5" />}
          onPress={onCreateOpen}
          className="font-black uppercase tracking-widest text-xs shadow-xl shadow-lime-500/30 active:scale-95 hover:scale-105 hover:shadow-lime-500/50 transition-all duration-300 ease-out transform-gpu"
          style={{
            background: 'linear-gradient(135deg, #A3E635 0%, #84CC16 100%)',
            color: '#000000',
          }}
        >
          {t.dashboard.newProject}
        </Button>
      </div>

      {loading ? (
        <div className="max-w-[1600px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <Card
                key={i}
                className="border-none bg-white dark:bg-slate-900/100 backdrop-blur-sm shadow-sm animate-pulse h-64"
              />
            ))}
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="max-w-[1600px] mx-auto py-20">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center shadow-soft">
            <Folder className="w-16 h-16 text-slate-300 dark:text-slate-500 mb-6" />
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
              {t.dashboard.emptyStateTitle}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md">
              {t.dashboard.emptyStateDesc}
            </p>
            <Button
              size="lg"
              radius="full"
              startContent={<Plus className="w-5 h-5" />}
              onPress={onCreateOpen}
              className="font-black uppercase tracking-widest text-xs shadow-xl shadow-lime-500/30 hover:shadow-lime-500/50 transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #A3E635 0%, #84CC16 100%)',
                color: '#000000',
              }}
            >
              {t.dashboard.newProject}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-[1600px] mx-auto">
          {projects.map((project, index) => (
            <div
              key={project.id}
              onClick={() => handleCardClick(project.id)}
              className="cursor-pointer animate-fadeIn"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <Card className="border-none bg-white dark:bg-slate-900/100 backdrop-blur-sm shadow-soft hover:shadow-hover hover:scale-[1.02] transition-all duration-300 group h-full">
                <CardBody className="p-8">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-primary/10 dark:bg-primary/20 rounded-2xl text-primary transition-all duration-300 group-hover:bg-lime-500 group-hover:text-white group-hover:shadow-lime-500">
                      <Folder className="w-8 h-8" />
                    </div>
                    <Tooltip content={t.settings.remove} color="danger">
                      <Button
                        isIconOnly
                        variant="light"
                        color="danger"
                        radius="full"
                        onClick={e => onRequestDelete(e, project.id)}
                        className="text-slate-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-all duration-300"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </Tooltip>
                  </div>

                  <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors mb-3">
                    {project.name}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2 min-h-[2.5rem] font-medium leading-relaxed mb-4">
                    {project.description || t.dashboard.noDesc}
                  </p>
                  <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-600 font-medium">
                    <span>
                      {t.dashboard.created} {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                    <span>
                      {t.dashboard.updated} {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardBody>
                <Divider className="opacity-50" />
                <CardFooter className="px-8 py-4 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600">
                    {t.dashboard.projectId}: {project.id.substring(0, 8)}...
                  </span>
                  <Button
                    variant="light"
                    size="sm"
                    endContent={<ChevronRight className="w-4 h-4" />}
                    className="text-primary hover:bg-primary/10 transition-colors duration-300"
                    onPress={() => handleCardClick(project.id)}
                  >
                    {t.dashboard.openProject}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={onCreateClose}
        placement="center"
        backdrop="blur"
        size="md"
        radius="lg"
        classNames={{
          base: 'dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-fadeIn',
          header: 'border-b-[1px] border-slate-100 dark:border-slate-800 p-6',
          body: 'p-8',
          footer: 'border-t-[1px] border-slate-100 dark:border-slate-800 p-6',
        }}
      >
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {t.dashboard.createTitle}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  {t.dashboard.createDesc}
                </p>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-6">
                  <Input
                    label={t.dashboard.nameLabel}
                    placeholder={t.dashboard.namePlaceholder}
                    labelPlacement="outside"
                    variant="bordered"
                    radius="lg"
                    size="lg"
                    autoFocus
                    value={newProjectName}
                    onValueChange={setNewProjectName}
                    classNames={{
                      label:
                        'font-black text-[15px] uppercase tracking-widest text-slate-400 dark:text-slate-300 mb-2',
                      input: 'text-[16px]',
                      inputWrapper:
                        'border-2 group-data-[focus=true]:border-primary transition-colors duration-300',
                    }}
                  />
                  <Textarea
                    label={t.dashboard.descLabel}
                    placeholder={t.dashboard.descPlaceholder}
                    labelPlacement="outside"
                    variant="bordered"
                    radius="lg"
                    size="lg"
                    minRows={4}
                    value={newProjectDesc}
                    onValueChange={setNewProjectDesc}
                    classNames={{
                      label:
                        'font-black text-[15px] uppercase tracking-widest text-slate-400 dark:text-slate-300 mb-2',
                      input: 'font-medium text-base',
                      inputWrapper:
                        'border-2 group-data-[focus=true]:border-primary transition-colors duration-300',
                    }}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  variant="light"
                  onPress={onClose}
                  className="font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-300"
                >
                  {t.dashboard.cancel}
                </Button>
                <Button
                  onPress={handleCreate}
                  className="font-black uppercase tracking-widest text-xs px-8 shadow-xl shadow-lime-500/30 hover:shadow-lime-500/50 transition-all duration-300"
                  radius="lg"
                  style={{
                    background: 'linear-gradient(135deg, #A3E635 0%, #84CC16 100%)',
                    color: '#000000',
                  }}
                >
                  {t.dashboard.create}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={onDeleteClose}
        placement="center"
        backdrop="blur"
        size="xs"
        radius="lg"
        classNames={{
          base: 'dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-fadeIn',
          body: 'p-8',
        }}
      >
        <ModalContent>
          {onClose => (
            <ModalBody className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-danger-50 dark:bg-danger-900/20 text-danger rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                {t.dashboard.deleteConfirmTitle}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
                {t.dashboard.confirmDelete}
              </p>
              <div className="flex gap-3 w-full">
                <Button
                  fullWidth
                  variant="light"
                  onPress={onClose}
                  className="font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-300"
                >
                  {t.dashboard.cancel}
                </Button>
                <Button
                  fullWidth
                  color="danger"
                  onPress={confirmDelete}
                  className="font-bold shadow-lg shadow-danger-500/20 hover:shadow-danger-500/40 transition-all duration-300"
                >
                  {t.dashboard.deleteConfirmAction}
                </Button>
              </div>
            </ModalBody>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default Dashboard;
