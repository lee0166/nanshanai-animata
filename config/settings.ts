import { AppSettings } from '../types';
import { DEFAULT_MODELS } from './models';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'zh',
  models: [],
  pollingInterval: 5000,
  useSandbox: false,
  maxConcurrentJobs: 3,
  // Duration Budget Configuration defaults
  durationBudget: {
    platform: 'douyin',
    pace: 'normal',
    useDurationBudget: false,
    useDynamicDuration: false,
    useProductionPrompt: false,
    useShotQC: false,
    qcAutoAdjust: false,
  },
};
