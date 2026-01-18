
import React, { useEffect, useState } from 'react';
import { Project } from '../types';
import { storageService } from '../services/storage';
import { Plus, Trash2, Folder, ExternalLink, AlertTriangle } from 'lucide-react';
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
  Divider
} from "@heroui/react";

const Dashboard: React.FC = () => {
  const { t, settings } = useApp();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  
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
    const data = await storageService.getProjects();
    setProjects(data);
  };

  const handleCreate = async () => {
    if (!newProjectName) return;

    try {
      const newProject: Project = {
        id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
        name: newProjectName,
        description: newProjectDesc,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await storageService.saveProject(newProject);
      
      onCreateClose();
      setNewProjectName('');
      setNewProjectDesc('');
      await loadProjects();
    } catch (error) {
      console.error("[DASHBOARD] Failed to create project:", error);
      showToast(settings.language === 'zh' ? "创建项目失败，请检查存储权限。" : "Failed to create project. Please check storage permissions.", 'error');
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
    } catch (error) {
      console.error("Failed to delete project:", error);
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
        <div>
          <h1 className="text-4xl font-black mb-2 uppercase tracking-tighter bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            {t.dashboard.title}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">{t.dashboard.subtitle}</p>
        </div>
        <Button
          color="primary"
          size="lg"
          radius="full"
          startContent={<Plus className="w-5 h-5" />}
          onPress={onCreateOpen}
          className="font-black uppercase tracking-widest text-xs shadow-2xl shadow-primary/40 active:scale-95 hover:scale-110 hover:shadow-primary/60 transition-all duration-300 ease-out transform-gpu"
        >
          {t.dashboard.newProject}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-[1600px] mx-auto">
        {projects.map((project) => (
          <div 
            key={project.id}
            onClick={() => handleCardClick(project.id)}
            className="cursor-pointer"
          >
          <Card 
            className="border-none bg-white dark:bg-slate-900/100 backdrop-blur-sm shadow-sm hover:scale-[1.02] transition-all duration-300 group h-full"
          >
            <CardBody className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                  <Folder className="w-8 h-8" />
                </div>
                <Tooltip content={t.settings.remove} color="danger">
                  <Button
                    isIconOnly
                    variant="light"
                    color="danger"
                    radius="full"
                    onClick={(e) => onRequestDelete(e, project.id)}
                    className="text-slate-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </Tooltip>
              </div>
              
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-3">
                {project.name}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2 min-h-[2.5rem] font-medium leading-relaxed">
                {project.description || t.dashboard.noDesc}
              </p>
            </CardBody>
            <Divider className="opacity-50" />
            <CardFooter className="px-8 py-4 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600">
                {t.dashboard.updated} {new Date(project.updatedAt).toLocaleDateString()}
              </span>
              <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
            </CardFooter>
          </Card>
          </div>
        ))}
      </div>

      {/* CREATE MODAL */}
      <Modal 
        isOpen={isCreateOpen} 
        onClose={onCreateClose}
        placement="center"
        backdrop="blur"
        size="md"
        radius="lg"
        classNames={{
          base: "dark:bg-slate-900 border border-slate-200 dark:border-slate-800",
          header: "border-b-[1px] border-slate-100 dark:border-slate-800 p-6",
          body: "p-8",
          footer: "border-t-[1px] border-slate-100 dark:border-slate-800 p-6",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {t.dashboard.createTitle}
                </h2>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-6">
                  <Input
                    label={t.dashboard.nameLabel}
                    placeholder=" "
                    labelPlacement="outside"
                    variant="bordered"
                    radius="lg"
                    size="lg"
                    autoFocus
                    value={newProjectName}
                    onValueChange={setNewProjectName}
                    classNames={{
                      label: "font-black text-[15px] uppercase tracking-widest text-slate-400 mb-2",
                      input: "text-[16px]",
                      inputWrapper: "border-2 group-data-[focus=true]:border-indigo-500"
                    }}
                  />
                  <Textarea
                    label={t.dashboard.descLabel}
                    placeholder=" "
                    labelPlacement="outside"
                    variant="bordered"
                    radius="lg"
                    size="lg"
                    minRows={4}
                    value={newProjectDesc}
                    onValueChange={setNewProjectDesc}
                    classNames={{
                      label: "font-black text-[15px] uppercase tracking-widest text-slate-400 mb-2",
                      input: "font-medium text-base",
                      inputWrapper: "border-2 group-data-[focus=true]:border-indigo-500"
                    }}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} className="font-bold text-slate-500">
                  {t.dashboard.cancel}
                </Button>
                <Button 
                  color="primary" 
                  onPress={handleCreate}
                  className="font-black uppercase tracking-widest text-xs px-8"
                  radius="lg"
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
          base: "dark:bg-slate-900 border border-slate-200 dark:border-slate-800",
          body: "p-8",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <ModalBody className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-danger-50 dark:bg-danger-900/20 text-danger rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Delete Project?</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
                {t.dashboard.confirmDelete}
              </p>
              <div className="flex gap-3 w-full">
                <Button fullWidth variant="light" onPress={onClose} className="font-bold text-slate-500">
                  Cancel
                </Button>
                <Button fullWidth color="danger" onPress={confirmDelete} className="font-bold shadow-lg shadow-danger-500/20">
                  Delete
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
