import React, { useState, useEffect } from 'react';
import { AppSettings, ThemeMode, Language } from '../types';
import { DEFAULT_SETTINGS } from '../config/settings';
import { storageService } from '../services/storage';
import { translations } from '../locales';
import { AppContext } from './context';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [browserSupported, setBrowserSupported] = useState(true);
  const [workspaceName, setWorkspaceName] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [isFsResponsive, setIsFsResponsive] = useState(true);

  const t = translations[settings.language];

  const checkConnection = async () => {
    const connected = await storageService.isConnected();
    setIsConnected(connected);
    const responsive = storageService.isResponsive();
    setIsFsResponsive(responsive);
    console.log(`[STORAGE] Connection check: Connected=${connected}, Responsive=${responsive}`);
    return connected;
  };

  const resetWorkspace = async () => {
    try {
      // Clear state first
      setIsConnected(false);
      setWorkspaceName('');
      setIsFsResponsive(true); // Reset this immediately for the UI
      
      // Clear storage service state
      await storageService.resetWorkspace();
      
      // Directly trigger picker as part of the same user gesture
      const connected = await storageService.connect(true);
      
      if (connected) {
        // Force full reload to clear all memory states and ensure clean IDB read
        window.location.href = '/'; 
      } else {
        window.location.reload(); 
      }
    } catch (e) {
      console.warn("Reset workspace failed:", e);
      window.location.reload();
    }
  };

  const reloadSettings = async () => {
    const start = performance.now();
    try {
      const connected = await checkConnection();
      if (connected) {
        setWorkspaceName(await storageService.getWorkspaceName());
        const s = await storageService.loadSettings();
        
        // Always start with DEFAULT_SETTINGS to ensure we have all fields
        // and to reset transient states like useSandbox when switching workspaces
        let merged = { ...DEFAULT_SETTINGS };
        
        if (s) {
          // Merge loaded settings over defaults
          merged = { ...merged, ...s };
        }

        const parsedPolling = Number((merged as any).pollingInterval);
        let pollingInterval = Number.isFinite(parsedPolling) ? parsedPolling : DEFAULT_SETTINGS.pollingInterval;
        if (pollingInterval > 0 && pollingInterval < 1000) {
          pollingInterval = pollingInterval * 1000;
        }
        merged.pollingInterval = Math.max(1000, Math.floor(pollingInterval));
        
        // CRITICAL: Ensure useSandbox matches the actual storage state
        // This fixes the UI sync issue when switching between sandbox and workspace
        merged.useSandbox = storageService.isOpfs();
        
        setSettings(merged);
      } else {
        setWorkspaceName(await storageService.getWorkspaceName());
      }
    } catch (e) {
      console.warn("[INIT] Failed to load settings:", e);
    }
  };

  // Load settings and auto-connect on mount
  useEffect(() => {
    let mounted = true;
    
    // 3. Force return to home on refresh if not at root
    // Using HashRouter, so we check the hash
    const currentHash = window.location.hash;
    if (currentHash && currentHash !== '#/' && currentHash !== '#') {
        console.log("[INIT] Redirecting to home from", currentHash);
        window.location.hash = '#/';
    }

    const init = async () => {
      console.log("[INIT] Starting App Initialization...");
      setIsInitializing(true);
      
      // Check browser support
      const supported = storageService.isBrowserSupported();
      setBrowserSupported(supported);
      
      if (!supported) {
        setIsInitializing(false);
        setLoaded(true);
        return;
      }

      // Try to connect storage
      try {
        const start = Date.now();
        console.log("[INIT] Attempting auto-connect...");
        const connected = await storageService.autoConnect();
        console.log("[INIT] autoConnect returned:", connected);
        
        if (mounted) {
          if (connected) {
            console.log("[INIT] Starting smoke test...");
            // Smoke test: try to load settings and projects to ensure FS is truly responsive
            // before we hide the loading screen. This catches hangs early.
            await Promise.all([
              reloadSettings(),
              storageService.getProjects() // This triggers projects.json read
            ]);
            console.log("[INIT] Smoke test complete.");
          } else {
            await reloadSettings();
          }

          // Set connection state AFTER we've verified responsiveness with smoke test
          setIsConnected(connected);
          setIsFsResponsive(storageService.isResponsive());
          
          // Ensure the loading screen is visible for at least 500ms for a smooth transition
          const elapsed = Date.now() - start;
          if (elapsed < 500) {
            await new Promise(r => setTimeout(r, 500 - elapsed));
          }
          
          console.log(`[INIT] Initialization complete. FS Responsive: ${storageService.isResponsive()}, Connected: ${connected}, Elapsed: ${Date.now() - start}ms`);
          setIsInitializing(false);
          setLoaded(true);
        }
      } catch (e) {
        console.error("[INIT] Initialization error:", e);
        if (mounted) {
          console.log(`[INIT] Initialization failed with error. FS Responsive: ${storageService.isResponsive()}`);
          setIsFsResponsive(storageService.isResponsive());
          setIsInitializing(false);
          setLoaded(true);
        }
      }
    };

    init();

    // Listen for window focus to refresh connection status
    const handleFocus = () => {
      checkConnection();
    };
    window.addEventListener('focus', handleFocus);

    return () => { 
      mounted = false; 
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Apply Theme
  useEffect(() => {
    const root = window.document.documentElement;
    const isDark = 
      settings.theme === 'dark' || 
      (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  const updateSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    // Only save if connected
    if (await storageService.isConnected()) {
        await storageService.saveSettings(newSettings);
    }
  };

  const toggleTheme = (mode: ThemeMode) => {
    updateSettings({ ...settings, theme: mode });
  };

  const toggleLanguage = (lang: Language) => {
    updateSettings({ ...settings, language: lang });
  };

  if (!loaded && !isInitializing) return null;

  const handleSwitchToSandbox = async () => {
    const success = await storageService.switchToSandbox();
    if (success) {
      localStorage.setItem('avss_use_sandbox', 'true');
      window.location.reload();
    }
  };

  return (
    <AppContext.Provider value={{ 
      settings, 
      updateSettings, 
      t, 
      toggleTheme, 
      toggleLanguage, 
      reloadSettings, 
      workspaceName, 
      isConnected, 
      isInitializing, 
      isFsResponsive,
      browserSupported, 
      resetWorkspace,
      checkConnection
    }}>
      {isInitializing ? (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center z-50">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 font-medium animate-pulse">{t.settings.initLoading}</p>
        </div>
      ) : !browserSupported ? (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center z-50 p-6 text-center">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl max-w-md border border-red-100 dark:border-red-900/30">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t.settings.browserNotSupported}</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-8">{t.settings.browserNotSupportedDesc}</p>
          </div>
        </div>
      ) : !isConnected && workspaceName && !isInitializing ? (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center z-50 p-6 text-center">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl max-w-md border border-amber-100 dark:border-amber-900/30">
            <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t.settings.initError}</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-8">{t.settings.initErrorDesc}</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleSwitchToSandbox}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
              >
                {t.settings.sandboxMode}
              </button>
              <button 
                onClick={() => resetWorkspace()}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium transition-all"
              >
                {t.settings.resetWorkspace}
              </button>
            </div>
          </div>
        </div>
      ) : (
        children
      )}
    </AppContext.Provider>
  );
};
