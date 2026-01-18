import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import ProjectDetail from './views/ProjectDetail';
import Settings from './views/Settings';
import JobMonitor from './components/JobMonitor';
import WelcomeView from './components/WelcomeView';
import LoadingView from './components/LoadingView';
import Tasks from './views/Tasks';
import { storageService } from './services/storage';
import { jobQueue } from './services/queue';
import { useApp } from './contexts/context';
import { useToast } from './contexts/ToastContext';
import { AssetType, Project } from './types';
import { ToastProvider } from './contexts/ToastContext';
import { PreviewProvider } from './components/PreviewProvider';

const App: React.FC = () => {
  const { showToast } = useToast();
  const { reloadSettings, t, isConnected, isInitializing, isFsResponsive, resetWorkspace } = useApp();

  // Unified State for Project Navigation
  const [activeTab, setActiveTab] = useState<AssetType>(AssetType.CHARACTER);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  // Auto-load queue when connected and responsive
  useEffect(() => {
    if (isConnected && isFsResponsive && !isInitializing) {
      console.log("[APP] Triggering jobQueue.loadQueue()...");
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
      console.error("[APP] Connection failed:", error);
      showToast(error.message || "Connection failed", 'error');
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
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route 
              path="/project/:id" 
              element={
                <ProjectDetail 
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  onProjectLoaded={setCurrentProject}
                />
              } 
            />
            <Route path="/settings" element={<Settings />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <JobMonitor />
        </Layout>
      </PreviewProvider>
    </Router>
  );
};

export default App;