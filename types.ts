// Domain Types

export enum AssetType {
  CHARACTER = 'character',
  SCENE = 'scene',
  ITEM = 'item',
  VIDEO_SEGMENT = 'video_segment',
  RESOURCES = 'resources',
  IMAGE = 'image',
  VIDEO = 'video'
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface Asset {
  id: string;
  projectId: string;
  type: AssetType;
  name: string;
  prompt: string;
  negativePrompt?: string;
  filePath?: string; 
  thumbnailPath?: string;
  metadata?: Record<string, any>;
  category?: 'generated' | 'imported';
  createdAt: number;
  updatedAt: number;
}

export interface GeneratedImage {
  id: string;
  path: string;
  prompt: string;
  userPrompt?: string; // Original user input prompt
  modelConfigId: string; // Internal configuration ID (e.g., 'volc-img-1')
  modelId: string; // API model identifier (e.g., 'doubao-seedream-4-5-251128')
  referenceImages: string[];
  metadata?: Record<string, any>;
  createdAt: number;
  // Resource Metadata
  width?: number;
  height?: number;
  size?: number; // in bytes
  duration?: number; // in seconds (for video)
}

export interface CharacterAsset extends Asset {
  gender?: 'male' | 'female' | 'unlimited';
  ageGroup?: 'childhood' | 'youth' | 'middle_aged' | 'elderly' | 'unknown';
  generatedImages?: GeneratedImage[];
  currentImageId?: string;
}

export enum ItemType {
  PROP = 'prop',
  CREATURE = 'creature',
  ANIMAL = 'animal',
  EFFECT = 'effect',
  REFERENCE = 'reference'
}

export interface GeneratedVideo {
  id: string;
  name?: string;
  path: string;
  prompt: string;
  userPrompt?: string;
  modelConfigId: string;
  modelId: string;
  referenceImages?: string[];
  metadata?: Record<string, any>;
  params?: any;
  createdAt: number;
  duration?: number;
  width?: number;
  height?: number;
}

export interface FragmentAsset extends Asset {
  videoName?: string;
  videos?: GeneratedVideo[];
  currentVideoId?: string;
  generatedImages?: GeneratedImage[];
}

export interface ItemAsset extends Asset {
  itemType: ItemType;
  generatedImages?: GeneratedImage[];
  currentImageId?: string;
}

export interface SceneAsset extends Asset {
  generatedImages?: GeneratedImage[];
  currentImageId?: string;
}

export interface VideoSegment extends Asset {
  type: AssetType.VIDEO_SEGMENT;
  duration?: number;
  startImageId?: string;
  endImageId?: string;
  script?: string;
}

export interface Job {
  id: string;
  type: 'generate_image' | 'generate_video';
  status: JobStatus;
  projectId: string;
  params: any;
  result?: any;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

// --- New Settings Types ---

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'en' | 'zh';

export interface ModelCapabilities {
  supportsImageInput?: boolean;
  supportsVideoInput?: boolean;
  supportsAudioGeneration?: boolean;
  supportsReferenceImage?: boolean; // Generic reference image support
  supportsStartFrame?: boolean; // For video generation
  supportsEndFrame?: boolean; // For video generation
  supportedGenerationTypes?: ('text_to_video' | 'first_last_frame' | 'multi_ref')[]; // Supported generation modes
  maxReferenceImages?: number;
  maxBatchSize?: number; // Maximum number of images generated in one request
  appendCountToPrompt?: boolean; // Whether to append "，生成x张图" to the prompt
  requiresImageInput?: boolean; // For I2I or I2V specific models
  // Image generation specific capabilities
  supportedResolutions?: string[];
  defaultResolution?: string;
  minPixels?: number;
  maxPixels?: number;
  minAspectRatio?: number;
  maxAspectRatio?: number;
}

export interface ModelParameter {
  name: string; // API parameter name
  label: string; // UI display label
  type: 'string' | 'number' | 'boolean' | 'select';
  options?: { label: string; value: any }[]; // For select type
  defaultValue?: any;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  required?: boolean;
  visibilityCondition?: {
    // Defines when this parameter should be VISIBLE
    // All conditions must be met (AND logic)
    generationType?: ('text_to_video' | 'first_last_frame' | 'multi_ref')[]; // Visible only for these types
    hasStartImage?: boolean; // Visible if start image is present (true) or absent (false)
    hasEndImage?: boolean; // Visible if end image is present (true) or absent (false)
  };
  hiddenCondition?: {
    // Defines when this parameter should be HIDDEN
    // If ANY condition is met (OR logic within the object properties, but typically used for specific exclusion)
    // Actually, let's keep it simple: If this object matches context, HIDE the param.
    generationType?: ('text_to_video' | 'first_last_frame' | 'multi_ref')[];
    hasStartImage?: boolean;
    hasEndImage?: boolean;
  };
}

export interface ModelConfig {
  id: string;          // For templates, this is the template ID; for instances, this is the instance ID
  name: string;
  provider: string;
  modelId: string;
  type: 'image' | 'video';
  capabilities: ModelCapabilities;
  parameters: ModelParameter[];
  templateId?: string; // Only instances have this, pointing back to the template
  apiKey?: string;     // Instances must have this to work, templates don't
  isDefault?: boolean;
  apiUrl?: string;
  providerOptions?: any;
}

/**
 * Persisted model instance data in settings.json
 */
export interface ModelInstance {
  id: string;
  templateId: string;
  name: string;
  apiKey: string;
  isDefault?: boolean;
}

export interface AppSettings {
  theme: ThemeMode;
  language: Language;
  models: ModelConfig[]; // Runtime settings use full config
  pollingInterval: number;
  useSandbox: boolean;
  maxConcurrentJobs?: number;
}
