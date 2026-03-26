import React, { useEffect, useState, Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import JobMonitor from './components/JobMonitor';
import WelcomeView from './components/WelcomeView';
import LoadingView from './components/LoadingView';
import PageLoader from './components/PageLoader';
import { storageService } from './services/storage';
import { jobQueue } from './services/queue';
import { useApp } from './contexts/context';
import { useToast } from './contexts/ToastContext';
import { AssetType, Project } from './types';
import { PreviewProvider } from './components/PreviewProvider';

// 懒加载视图组件
const Dashboard = lazy(() => import('./views/Dashboard'));
const ProjectDetail = lazy(() => import('./views/ProjectDetail'));
const Settings = lazy(() => import('./views/Settings'));
const Tasks = lazy(() => import('./views/Tasks'));
const ScriptManager = lazy(() => import('./views/ScriptManager'));
const ShotManager = lazy(() => import('./views/ShotManager'));
const TimelineEditor = lazy(() => import('./views/TimelineEditor'));
const VideoAudioManager = lazy(() => import('./views/VideoAudioManager'));

const App: React.FC = () => {
  const { showToast } = useToast();
  const { reloadSettings, isConnected, isInitializing, isFsResponsive } = useApp();

  // Unified State for Project Navigation
  const [activeTab, setActiveTabState] = useState<AssetType>(AssetType.SCRIPT);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [tabClickTrigger, setTabClickTrigger] = useState(0);

  const setActiveTab = (tab: AssetType) => {
    setActiveTabState(tab);
    setTabClickTrigger(prev => prev + 1);
  };

  // Auto-load queue when connected and responsive
  useEffect(() => {
    if (isConnected && isFsResponsive && !isInitializing) {
      console.log('[APP] Triggering jobQueue.loadQueue()...');
      jobQueue.loadQueue();
    }
  }, [isConnected, isFsResponsive, isInitializing]);

  const handleConnect = async () => {
    try {
      const success = await storageService.connect();
      if (success) {
        await reloadSettings();
        jobQueue.loadQueue();
      }
    } catch (error: any) {
      console.error('[APP] Connection failed:', error);
      showToast(error.message || 'Connection failed', 'error');
    }
  };

  if (!isFsResponsive && isConnected) {
    // If we thought we were connected but FS is unresponsive, maybe show loading or reset
    // But typically LoadingView covers initialization.
  }

  if (isInitializing) {
    return <LoadingView />;
  }

  if (!isConnected) {
    return <WelcomeView onConnect={handleConnect} />;
  }

  return (
    <Router>
      <PreviewProvider>
        <Layout
          isConnected={isConnected}
          onConnect={handleConnect}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentProject={currentProject}
        >
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route
                path="/project/:id"
                element={
                  <ProjectDetail
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    tabClickTrigger={tabClickTrigger}
                    onProjectLoaded={setCurrentProject}
                  />
                }
              />
              <Route path="/settings" element={<Settings />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/scripts" element={<ScriptManager />} />
              <Route path="/project/:projectId/scripts" element={<ScriptManager />} />
              <Route
                path="/project/:projectId/shots"
                element={<ShotManager setActiveTab={setActiveTab} />}
              />
              <Route
                path="/project/:projectId/script/:scriptId/timeline"
                element={<TimelineEditor />}
              />
              <Route path="/project/:projectId/video-audio" element={<VideoAudioManager />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <JobMonitor />
        </Layout>
      </PreviewProvider>
    </Router>
  );
};

export default App;
