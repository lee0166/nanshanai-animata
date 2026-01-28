import { AppSettings } from '../types';
import { DEFAULT_MODELS } from './models';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'zh',
  models: [],
  pollingInterval: 5000,
  useSandbox: false
};
