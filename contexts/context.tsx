import { createContext, useContext } from 'react';
import { AppSettings, ThemeMode, Language } from '../types';
import { translations } from '../locales';

export interface AppContextType {
  settings: AppSettings;
  updateSettings: (newSettings: AppSettings) => Promise<void>;
  t: (typeof translations)['en'];
  toggleTheme: (mode: ThemeMode) => void;
  toggleLanguage: (lang: Language) => void;
  reloadSettings: () => Promise<void>;
  workspaceName: string;
  isConnected: boolean;
  isInitializing: boolean;
  isFsResponsive: boolean;
  browserSupported: boolean;
  resetWorkspace: () => Promise<void>;
  checkConnection: () => Promise<boolean>;
}

export const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
