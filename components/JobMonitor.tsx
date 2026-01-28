import React, { useEffect, useState, useMemo } from 'react';
import { Job, JobStatus } from '../types';
import { jobQueue } from '../services/queue';
import { Loader2, CheckCircle, AlertCircle, ChevronUp, ChevronDown, Activity, ArrowRight, Minimize2, Maximize2 } from 'lucide-react';
import { storageService } from '../services/storage';
import { useApp } from '../contexts/context';
import { Card, CardHeader, CardBody, Chip, Button, Divider, ScrollShadow, Tooltip } from "@heroui/react";
import { useNavigate } from 'react-router-dom';

type ViewMode = 'expanded' | 'collapsed' | 'minimized';

const JobMonitor: React.FC = () => {
  const { t, settings } = useApp();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('expanded');

  // Load jobs logic
    useEffect(() => {
      let lastUpdate = 0;

      const load = async () => {
          const all = await storageService.getJobs();
          // Sort by newest first
          all.sort((a, b) => b.createdAt - a.createdAt);
          
          const recent = all.slice(0, 20);
          
          setJobs(prev => {
              // Only update if the polling data is actually different or we don't have jobs
              // To avoid race conditions with real-time notifications, we merge them
              const merged = [...prev];
              let changed = false;

              recent.forEach(job => {
                  const idx = merged.findIndex(j => j.id === job.id);
                  if (idx >= 0) {
                      // Only update if the new job is "more advanced" or newer
                      // We use updatedAt as a heuristic
                      if (job.updatedAt > merged[idx].updatedAt) {
                          merged[idx] = job;
                          changed = true;
                      }
                  } else {
                      merged.push(job);
                      changed = true;
                  }
              });

              if (!changed && prev.length === recent.length) return prev;
              
              return merged.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
          });
      };
  
      load();

    const unsubscribe = jobQueue.subscribe((updatedJob) => {
        setJobs(prev => {
            const exists = prev.find(j => j.id === updatedJob.id);
            if (exists) {
                // Always trust real-time notification for the specific job
                return prev.map(j => j.id === updatedJob.id ? updatedJob : j);
            }
            return [updatedJob, ...prev].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
        });
    });

    const intervalMs = Number.isFinite(settings.pollingInterval) ? settings.pollingInterval : 5000;
    const interval = setInterval(load, Math.max(1000, intervalMs));

    return () => {
        unsubscribe();
        clearInterval(interval);
    };
  }, [settings.pollingInterval]);

  // Auto-minimize when all jobs are complete
  useEffect(() => {
    const hasActive = jobs.some(j => j.status === JobStatus.PENDING || j.status === JobStatus.PROCESSING);
    if (!hasActive && jobs.length > 0) {
        // Delay slightly to let user see completion state
        const timer = setTimeout(() => {
            setViewMode('minimized');
        }, 3000);
        return () => clearTimeout(timer);
    } else if (hasActive && viewMode === 'minimized') {
        // Optional: Auto-expand if new jobs start? 
        // User didn't ask for auto-expand, but "minimized -> click -> collapsed".
        // Let's keep manual expansion to avoid annoyance, or maybe collapsed.
        setViewMode('collapsed');
    }
  }, [jobs, viewMode]);

  // Derived state
  const activeCount = jobs.filter(j => j.status === JobStatus.PENDING || j.status === JobStatus.PROCESSING).length;
  const processingCount = jobs.filter(j => j.status === JobStatus.PROCESSING).length;
  const maxDisplay = Math.max(1, Math.min(30, Number(settings.maxConcurrentJobs) || 3));
  const displayedJobs = jobs.slice(0, maxDisplay);

  if (jobs.length === 0) return null;

  // 1. Minimized Mode (Circle Icon)
  if (viewMode === 'minimized') {
      return (
          <Tooltip content={t.jobs.queue} placement="left">
            <Button
                isIconOnly
                color={activeCount > 0 ? "primary" : "default"}
                variant="shadow"
                radius="full"
                size="lg"
                className="fixed bottom-6 right-6 z-50 shadow-2xl animate-in fade-in zoom-in duration-300"
                onPress={() => setViewMode('collapsed')}
            >
                {activeCount > 0 ? (
                    <div className="relative">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                            {activeCount}
                        </span>
                    </div>
                ) : (
                    <Activity className="w-6 h-6" />
                )}
            </Button>
          </Tooltip>
      );
  }

  // 2. Collapsed Mode (Single Line Summary)
  if (viewMode === 'collapsed') {
      return (
        <Card 
            className="fixed bottom-6 right-6 z-50 w-80 shadow-2xl animate-in slide-in-from-bottom-5 duration-300 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg cursor-pointer"
            radius="lg"
            isPressable={false}
        >
            <div 
                className="w-full h-full"
                onClick={() => setViewMode('expanded')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if(e.key === 'Enter') setViewMode('expanded') }}
            >
                <CardBody className="py-4 px-5 flex flex-row items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-full ${activeCount > 0 ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                            {activeCount > 0 ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                {activeCount > 0 ? t.jobs.processing : t.jobs.queue}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                                {t.jobs.activeRunning.replace('{active}', String(activeCount)).replace('{running}', String(processingCount))}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-1 pointer-events-auto">
                        <Button isIconOnly size="sm" variant="light" radius="full" onPress={(e) => { setViewMode('minimized'); }}>
                            <Minimize2 className="w-4 h-4 text-slate-400" />
                        </Button>
                        <Button isIconOnly size="sm" variant="light" radius="full" onPress={() => setViewMode('expanded')}>
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                        </Button>
                    </div>
                </CardBody>
            </div>
        </Card>
      );
  }

  // 3. Expanded Mode (Full List)
  return (
    <Card 
      className="fixed bottom-6 right-6 z-50 w-96 h-auto max-h-[600px] shadow-2xl animate-in slide-in-from-bottom-5 duration-300 border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg flex flex-col"
      radius="lg"
    >
      <CardHeader className="px-5 py-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-800/50">
        <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-500" />
            <span className="font-black text-sm uppercase tracking-widest text-slate-900 dark:text-slate-100">
                {t.jobs.queue} <span className="ml-1 opacity-50">({jobs.length})</span>
            </span>
        </div>
        <div className="flex gap-1">
             <Button isIconOnly size="sm" variant="light" radius="full" onPress={() => setViewMode('minimized')}>
                <Minimize2 className="w-4 h-4 text-slate-400" />
            </Button>
            <Button isIconOnly size="sm" variant="light" radius="full" onPress={() => setViewMode('collapsed')}>
                <ChevronDown className="w-5 h-5 text-slate-400" />
            </Button>
        </div>
      </CardHeader>
      
      <CardBody className="p-0 overflow-hidden flex-1">
          <ScrollShadow className="h-full max-h-[400px] p-4 space-y-4">
              {displayedJobs.map(job => (
                  <div 
                      key={job.id} 
                      className="p-4 bg-slate-50/50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800/50 hover:border-indigo-500/30 transition-all group"
                  >
                      <div className="flex justify-between items-center mb-2">
                          <span className="font-black text-[10px] uppercase tracking-widest text-slate-500 group-hover:text-indigo-600 transition-colors">
                              {t.jobTypes?.[job.type] || job.type}
                          </span>
                          
                          {job.status === JobStatus.PENDING && (
                              <Chip size="sm" variant="flat" color="default" className="h-6 text-[10px] font-black uppercase tracking-widest px-2">
                                  {t.jobs.waiting}
                              </Chip>
                          )}
                          {job.status === JobStatus.PROCESSING && (
                              <Chip size="sm" variant="flat" color="primary" className="h-6 text-[10px] font-black uppercase tracking-widest px-2">
                                  {t.jobs.processing}
                              </Chip>
                          )}
                          {job.status === JobStatus.COMPLETED && (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                          )}
                          {job.status === JobStatus.FAILED && (
                              <AlertCircle className="w-5 h-5 text-red-500" />
                          )}
                      </div>
                      
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2" title={job.params.userPrompt || job.params.prompt}>
                          {job.params.userPrompt || job.params.prompt}
                      </p>
                      
                      {job.error && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20">
                              <p className="text-[10px] text-red-500 font-medium">{job.error}</p>
                          </div>
                      )}
                  </div>
              ))}
              {jobs.length > maxDisplay && (
                  <div className="text-center py-2">
                      <span className="text-xs text-slate-400 font-medium">
                          +{jobs.length - maxDisplay} more jobs...
                      </span>
                  </div>
              )}
          </ScrollShadow>
      </CardBody>

      <div className="p-4 border-t border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50">
        <Button 
            fullWidth 
            size="md" 
            variant="flat" 
            color="primary" 
            className="font-bold text-sm h-10"
            endContent={<ArrowRight className="w-4 h-4" />}
            onPress={() => navigate('/tasks')}
        >
            {t.jobs.viewAll}
        </Button>
      </div>
    </Card>
  );
};

export default JobMonitor;
