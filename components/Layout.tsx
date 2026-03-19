import React, { useEffect } from 'react';
import {
  Settings,
  Moon,
  Sun,
  Languages,
  Database,
  ChevronLeft,
  Film,
  User,
  Map,
  Box,
  Library,
  FileText,
  Camera,
} from 'lucide-react';
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
  Card,
} from '@heroui/react';

interface LayoutProps {
  children: React.ReactNode;
  isConnected: boolean;
  onConnect: () => void;
  activeTab?: AssetType;
  setActiveTab?: (tab: AssetType) => void;
  currentProject?: Project | null;
}

import { jobQueue } from '../services/queue';

const Layout: React.FC<LayoutProps> = ({
  children,
  isConnected,
  onConnect,
  activeTab,
  setActiveTab,
  currentProject,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, settings, toggleTheme, toggleLanguage } = useApp();

  const isRoot = location.pathname === '/' || location.pathname === '';
  const isSettings = location.pathname === '/settings';

  const projectMatch = location.pathname.match(/\/project\/([^/]+)/);
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
    { id: AssetType.SCRIPT, label: '剧本管理', icon: FileText },
    { id: AssetType.CHARACTER, label: t.project.characters, icon: User },
    { id: AssetType.SCENE, label: t.project.scenes, icon: Map },
    { id: AssetType.ITEM, label: t.project.items, icon: Box },
    { id: AssetType.SHOT, label: '分镜管理', icon: Camera },
    { id: AssetType.VIDEO_SEGMENT, label: t.project.segments, icon: Film },
    { id: AssetType.VIDEO_AUDIO, label: '音视频管理', icon: Film },
    { id: AssetType.RESOURCES, label: t.project.resources, icon: Library },
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-200 transition-colors duration-300 font-sans">
      <Navbar
        maxWidth="full"
        height="4rem"
        className="border-b border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-all duration-300"
      >
        <NavbarContent justify="start" className="gap-4">
          {!isRoot && (
            <NavbarItem>
              <Button
                isIconOnly
                variant="light"
                radius="full"
                onPress={() => navigate(-1)}
                className="text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </NavbarItem>
          )}

          <NavbarBrand>
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 transition-transform duration-300 group-hover:scale-110">
                <img src="/icon.png" className="w-full h-full object-contain" />
              </div>
              <span className="hidden sm:block font-black text-xl tracking-tighter uppercase text-slate-900 dark:text-white transition-colors duration-300 group-hover:text-primary">
                {t.appTitle}
              </span>
            </Link>
          </NavbarBrand>

          {isConnected && isProject && currentProject && (
            <NavbarContent className="hidden md:flex gap-2 ml-2">
              <NavbarItem>
                <div className="flex items-center gap-3">
                  <Chip
                    variant="flat"
                    color="primary"
                    className="h-9 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest border-none bg-primary/10 text-primary dark:bg-primary/30 dark:text-primary/90"
                  >
                    {currentProject.name}
                  </Chip>
                  <span className="text-slate-300 dark:text-slate-600">/</span>
                  <Tabs
                    aria-label={t.project.projectTabs}
                    variant="light"
                    color="primary"
                    selectedKey={activeTab}
                    onSelectionChange={key => setActiveTab?.(key as AssetType)}
                    classNames={{
                      tabList: 'bg-transparent p-0 gap-1',
                      tab: 'group h-9 px-4 rounded-lg transition-all duration-300',
                      tabContent:
                        'font-bold text-[13px] uppercase tracking-wider text-slate-500 dark:text-slate-400 group-data-[selected=true]:text-primary transition-colors duration-300',
                    }}
                  >
                    {tabs.map(tab => (
                      <Tab
                        key={tab.id}
                        title={
                          <div className="flex items-center gap-2">
                            <tab.icon className="w-4 h-4 transition-colors duration-300 group-data-[selected=true]:text-primary" />
                            <span className="hidden lg:inline">{tab.label}</span>
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
                className="h-9 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest border-none bg-warning/10 text-warning dark:bg-warning/20"
              >
                {t.settings.sandboxMode}
              </Chip>
            </NavbarItem>
          )}

          {!isConnected && !isSettings && (
            <NavbarItem>
              <Button
                color="primary"
                variant="solid"
                radius="full"
                size="sm"
                className="font-bold px-8 py-3 shadow-2xl shadow-primary/50 transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-white/30 bg-primary text-white hover:bg-primary/90 focus:ring-4 focus:ring-primary/30 focus:outline-none"
                onPress={onConnect}
              >
                {t.sidebar.openWorkspace}
              </Button>
            </NavbarItem>
          )}

          <NavbarItem>
            <ButtonGroup
              variant="flat"
              radius="full"
              className="bg-slate-100 dark:bg-slate-700 p-0.5 border border-slate-200 dark:border-slate-600 rounded-xl transition-all duration-300 sm:gap-1 gap-0.5"
            >
              <Tooltip content={t.common.switchLanguage}>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => toggleLanguage(settings.language === 'en' ? 'zh' : 'en')}
                  className="text-slate-500 min-w-8 w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-300"
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
                  className="text-slate-500 min-w-8 w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-300"
                >
                  {settings.theme === 'dark' ? (
                    <Sun className="w-4 h-4" />
                  ) : (
                    <Moon className="w-4 h-4" />
                  )}
                </Button>
              </Tooltip>
              <Tooltip content={t.sidebar.settings}>
                <Button
                  isIconOnly
                  as={Link}
                  to="/settings"
                  size="sm"
                  variant={isSettings ? 'solid' : 'light'}
                  color={isSettings ? 'primary' : 'default'}
                  className={`min-w-8 w-8 h-8 rounded-full transition-all duration-300 ${!isSettings ? 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700' : 'text-white font-bold'}`}
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
            <Card className="max-w-lg p-10 md:p-14 border-none shadow-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] animate-fadeIn">
              <div className="w-16 h-16 mx-auto mb-10 transition-transform duration-500 hover:scale-110">
                <img src="/icon.png" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-4xl font-black mb-4 text-slate-900 dark:text-white tracking-tighter uppercase animate-slideIn">
                {t.workspace.selectTitle}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed text-lg font-medium animate-slideIn" style={{ animationDelay: '0.1s' }}>
                {t.workspace.selectDesc}
              </p>
              <Button
                color="primary"
                variant="solid"
                size="lg"
                radius="full"
                className="w-full h-16 text-lg font-black uppercase tracking-widest shadow-2xl shadow-primary/50 bg-primary text-white active:scale-95 transition-all duration-300 hover:shadow-primary/70 hover:scale-105 transform-gpu dark:bg-primary dark:text-white border-2 border-white/30 hover:border-white/50 focus:ring-4 focus:ring-primary/30 focus:outline-none"
                onPress={onConnect}
              >
                {t.sidebar.openWorkspace}
              </Button>
            </Card>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            {children}
          </div>
        )}
      </main>
    </div>
  );
};

export default Layout;
