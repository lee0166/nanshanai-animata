
import React, { useEffect } from 'react';
import { Settings, Clapperboard, Moon, Sun, Languages, Database, ChevronLeft, Film, User, Map, Box, Library } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/context';
import { storageService } from '../services/storage';
import { AssetType, Project } from '../types';
import { 
  Navbar, 
  NavbarBrand, 
  NavbarContent, 
  NavbarItem, 
  Button, 
  Tooltip, 
  ButtonGroup,
  Tabs,
  Tab,
  Chip,
  Card
} from "@heroui/react";

interface LayoutProps {
  children: React.ReactNode;
  isConnected: boolean;
  onConnect: () => void;
  activeTab?: AssetType;
  setActiveTab?: (tab: AssetType) => void;
  currentProject?: Project | null;
}

import { jobQueue } from '../services/queue';

const Layout: React.FC<LayoutProps> = ({ children, isConnected, onConnect, activeTab, setActiveTab, currentProject }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, settings, toggleTheme, toggleLanguage } = useApp();
  
  const isRoot = location.pathname === '/' || location.pathname === '';
  const isSettings = location.pathname === '/settings';
  
  const projectMatch = location.pathname.match(/\/project\/([^\/]+)/);
  const isProject = !!projectMatch;
  const isOpfs = storageService.isOpfs();
  const isSandbox = isOpfs || localStorage.getItem('avss_use_sandbox') === 'true';

  useEffect(() => {
    document.title = t.appTitle;
  }, [t.appTitle]);

  // Warn user if jobs are running before unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Check jobQueue processing status
      // We can access the internal state or check storage via a synchronous method if available?
      // Actually queue.ts is in memory, so we can check jobQueue.getProcessingCount() if we expose it.
      // Or we can just check a global variable or storage?
      // Since queue.ts is a singleton, let's expose a method or property.
      // But jobQueue instance is imported.
      // Let's assume jobQueue has a way to know.
      // Wait, jobQueue.processingCount is private.
      // We need to make it public or add a getter.
      // For now, let's just edit Queue to add getProcessingCount() or similar.
      // But I can't edit Queue in this tool call.
      // I will assume I will add `getProcessingCount` to Queue class in next step or use `any` cast.
      // Actually, I can edit Queue first.
      
      // Let's assume we will add `hasActiveJobs()` method to jobQueue.
      if ((jobQueue as any).hasActiveJobs && (jobQueue as any).hasActiveJobs()) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const tabs = [
    { id: AssetType.CHARACTER, label: t.project.characters, icon: User },
    { id: AssetType.SCENE, label: t.project.scenes, icon: Map },
    { id: AssetType.ITEM, label: t.project.items, icon: Box },
    { id: AssetType.VIDEO_SEGMENT, label: t.project.segments, icon: Film },
    { id: AssetType.RESOURCES, label: t.project.resources, icon: Library },
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-200 transition-colors font-sans">
      <Navbar 
        maxWidth="full" 
        height="4rem"
        className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md"
      >
        <NavbarContent justify="start" className="gap-4">
          {!isRoot && (
            <NavbarItem>
              <Button
                isIconOnly
                variant="light"
                radius="lg"
                onPress={() => navigate(-1)}
                className="text-slate-500"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </NavbarItem>
          )}
          
          <NavbarBrand>
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8">
                <img src='/icon.png' className="w-full h-full object-contain" />
              </div>
              <span className="hidden sm:block font-black text-xl tracking-tighter uppercase text-slate-900 dark:text-white">
                {t.appTitle}
              </span>
            </Link>
          </NavbarBrand>

          {isConnected && isProject && currentProject && (
            <NavbarContent className="hidden lg:flex gap-4 ml-4">
              <NavbarItem>
                <div className="flex items-center gap-3">
                  <Chip 
                    variant="flat" 
                    color="primary"
                    className="h-9 px-3 rounded-xl font-black text-[10px] uppercase tracking-widest border-none"
                  >
                    {currentProject.name}
                  </Chip>
                  <span className="text-slate-300 dark:text-slate-700">/</span>
                  <Tabs 
                    aria-label={t.project.projectTabs} 
                    variant="light"
                    color="primary"
                    selectedKey={activeTab}
                    onSelectionChange={(key) => setActiveTab?.(key as AssetType)}
                    classNames={{
                      tabList: "bg-transparent p-0 gap-1",
                      tab: "group h-9 px-3",
                      tabContent: "font-bold text-[13px] uppercase tracking-wider text-slate-500 dark:text-slate-400 group-data-[selected=true]:text-white"
                    }}
                  >
                    {tabs.map((tab) => (
                      <Tab
                        key={tab.id}
                        title={
                          <div className="flex items-center gap-2">
                            <tab.icon className="w-4 h-4" />
                            <span>{tab.label}</span>
                          </div>
                        }
                      />
                    ))}
                  </Tabs>
                </div>
              </NavbarItem>
            </NavbarContent>
          )}
        </NavbarContent>

        <NavbarContent justify="end" className="gap-3">
          {isConnected && isSandbox && (
            <NavbarItem className="hidden sm:flex">
              <Chip
                startContent={<Database className="w-3.5 h-3.5" />}
                variant="flat"
                color="warning"
                className="h-9 px-3 rounded-xl font-black text-[10px] uppercase tracking-widest border-none bg-warning/10"
              >
                {t.settings.sandboxMode}
              </Chip>
            </NavbarItem>
          )}

          {!isConnected && !isSettings && (
            <NavbarItem>
              <Button
                color="primary"
                radius="lg"
                size="sm"
                className="font-bold px-5"
                onPress={onConnect}
              >
                {t.sidebar.openWorkspace}
              </Button>
            </NavbarItem>
          )}

          <NavbarItem>
            <ButtonGroup variant="flat" radius="lg" className="bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 rounded-xl">
              <Tooltip content={t.common.switchLanguage}>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => toggleLanguage(settings.language === 'en' ? 'zh' : 'en')}
                  className="text-slate-500 min-w-8 w-8 h-8"
                >
                  <Languages className="w-4 h-4" />
                </Button>
              </Tooltip>
              <Tooltip content={t.common.toggleTheme}>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => toggleTheme(settings.theme === 'dark' ? 'light' : 'dark')}
                  className="text-slate-500 min-w-8 w-8 h-8"
                >
                  {settings.theme === 'dark' ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
                </Button>
              </Tooltip>
              <Tooltip content={t.sidebar.settings}>
                <Button
                  isIconOnly
                  as={Link}
                  to="/settings"
                  size="sm"
                  variant={isSettings ? "solid" : "light"}
                  color={isSettings ? "primary" : "default"}
                  className={`min-w-8 w-8 h-8 ${!isSettings ? 'text-slate-500' : 'text-white font-bold'}`}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </Tooltip>
            </ButtonGroup>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      <main className="flex-1 overflow-hidden relative">
        {!isConnected && !isSettings ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-950">
            <Card className="max-w-lg p-10 md:p-14 border-none shadow-2xl bg-white dark:bg-slate-900 rounded-[2.5rem]">
              <div className="w-8 h-8 mx-auto mb-10">                
                <img src='/icon.png' className="w-full h-full object-contain" />
              </div>
              <h2 className="text-4xl font-black mb-4 text-slate-900 dark:text-white tracking-tighter uppercase">{t.workspace.selectTitle}</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed text-lg font-medium">
                {t.workspace.selectDesc}
              </p>
              <Button
                color="primary"
                size="lg"
                radius="full"
                className="w-full h-16 text-lg font-black uppercase tracking-widest shadow-xl shadow-indigo-500/30 active:scale-95 transition-all"
                onPress={onConnect}
              >
                {t.sidebar.openWorkspace}
              </Button>
            </Card>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
};

export default Layout;
