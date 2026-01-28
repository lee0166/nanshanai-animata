import { AppSettings, ModelConfig, Job, JobStatus, AssetType } from '../types';
import { storageService } from './storage';
import { IAIProvider, AIResult } from './ai/interfaces';
import { VolcengineProvider } from './ai/providers/VolcengineProvider';
import { findModelConfig } from '../config/models';
import { ViduProvider } from './ai/providers/ViduProvider';

export interface GenerationJobParams {
    projectId: string;
    prompt: string;
    userPrompt?: string;
    assetName: string;
    assetType: AssetType;
    assetId: string;
    referenceImages?: string[];
    aspectRatio?: string;
    resolution?: string;
    style?: string;
    guidanceScale?: number;
}

export interface VideoGenerationJobParams {
    projectId: string;
    prompt: string;
    userPrompt?: string;
    assetName: string;
    assetType: AssetType;
    assetId: string;
    duration?: number;
    ratio?: string;
    startImage?: string;
    endImage?: string;
    referenceImages?: string[];
    extraParams?: Record<string, any>;
}

export class AIService {
    private providers: Map<string, IAIProvider> = new Map();

    constructor() {
        this.registerProvider(new VolcengineProvider());
        this.registerProvider(new ViduProvider());
    }

    registerProvider(provider: IAIProvider) {
        this.providers.set(provider.id, provider);
        console.log(`[AIService] Registered provider: ${provider.id}`);
    }

    /**
     * Creates generation jobs based on the model capabilities and requested count.
     * Handles splitting requests into multiple jobs if the model has a maxBatchSize limit.
     */
    createGenerationJobs(
        model: ModelConfig,
        params: GenerationJobParams,
        totalCount: number
    ): Job[] {
        const capabilities = model.capabilities || {};
        const maxBatchSize = capabilities.maxBatchSize || 4;
        
        console.log(`[AIService] Creating jobs for ${params.assetName} (${params.assetType}). Total: ${totalCount}, MaxBatch: ${maxBatchSize}`);

        const jobs: Job[] = [];
        let remaining = totalCount;

        while (remaining > 0) {
            const currentBatchCount = Math.min(remaining, maxBatchSize);
            
            // Check if model supports guidance scale (basic check based on ID convention or capability if added later)
            // For now, preserving the logic from UI: check if modelId includes 'seededit'
            const isSeedEdit = model.modelId.includes('seededit');
            
            const job: Job = {
                id: typeof crypto.randomUUID === 'function'
                    ? crypto.randomUUID()
                    : Math.random().toString(36).substring(2) + Date.now().toString(36),
                projectId: params.projectId,
                type: 'generate_image',
                status: JobStatus.PENDING,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                params: {
                    prompt: params.prompt,
                    userPrompt: params.userPrompt,
                    model: model.id, // config ID
                    modelConfigId: model.id, // config ID
                    modelId: model.modelId, // API model ID
                    assetName: params.assetName,
                    assetType: params.assetType,
                    assetId: params.assetId,
                    projectId: params.projectId,
                    referenceImages: params.referenceImages,
                    aspectRatio: params.aspectRatio,
                    resolution: params.resolution,
                    generateCount: currentBatchCount,
                    style: params.style,
                    guidanceScale: isSeedEdit ? params.guidanceScale : undefined
                }
            };
            
            jobs.push(job);
            remaining -= currentBatchCount;
        }

        return jobs;
    }

    /**
     * Creates video generation jobs.
     * Currently video models typically don't support batching in a single request,
     * so this creates multiple individual jobs.
     */
    createVideoGenerationJobs(
        model: ModelConfig,
        params: VideoGenerationJobParams,
        totalCount: number
    ): Job[] {
        console.log(`[AIService] Creating video jobs for ${params.assetName} (${params.assetType}). Total: ${totalCount}`);

        const jobs: Job[] = [];
        
        for (let i = 0; i < totalCount; i++) {
            const job: Job = {
                id: typeof crypto.randomUUID === 'function'
                    ? crypto.randomUUID()
                    : Math.random().toString(36).substring(2) + Date.now().toString(36),
                projectId: params.projectId,
                type: 'generate_video',
                status: JobStatus.PENDING,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                params: {
                    prompt: params.prompt,
                    userPrompt: params.userPrompt,
                    model: model.id, // config ID
                    modelConfigId: model.id, // config ID
                    modelId: model.modelId, // API model ID
                    assetName: params.assetName,
                    assetType: params.assetType,
                    assetId: params.assetId,
                    projectId: params.projectId,
                    duration: params.duration,
                    ratio: params.ratio,
                    startImage: params.startImage,
                    endImage: params.endImage,
                    referenceImages: params.referenceImages,
                    extraParams: params.extraParams
                }
            };
            jobs.push(job);
        }

        return jobs;
    }

    // Helper to get configuration for a specific identifier (strictly by config ID)
    private async getModelConfig(identifier: string): Promise<ModelConfig | undefined> {
        const settings = await storageService.loadSettings();
        
        let config: ModelConfig | undefined;

        // 1. Try to find in loaded settings (user settings + defaults)
        if (settings && settings.models) {
            config = settings.models.find(m => m.id === identifier);
        }
        
        // 2. Fallback to static lookup if not found in settings (or settings failed to load)
        if (!config) {
            config = findModelConfig(identifier);
        }
        
        if (config) {
            console.log(`[AIService] Resolved model configuration for '${identifier}': ${config.name} (${config.modelId})`);
        } else {
            console.warn(`[AIService] Failed to resolve model configuration for '${identifier}'`);
        }
        
        return config;
    }

    // Helper to get all available models, optionally filtered
    async getModels(filter?: { type?: 'image' | 'video', provider?: string }): Promise<ModelConfig[]> {
        const settings = await storageService.loadSettings();
        if (!settings) return [];
        
        let models = settings.models;

        if (filter) {
            if (filter.type) {
                models = models.filter(m => m.type === filter.type);
            }
            if (filter.provider) {
                models = models.filter(m => m.provider === filter.provider);
            }
        }
        
        return models;
    }

    async generateImage(prompt: string, modelConfigId: string, referenceImages: string[], aspectRatio?: string, resolution?: string, count: number = 1, guidanceScale?: number, extraParams?: Record<string, any>): Promise<AIResult> {
        console.log(`[AIService] Generating image with model config ID: ${modelConfigId}, count: ${count}`);
        
        const config = await this.getModelConfig(modelConfigId);
        if (!config) {
            return { success: false, error: `Model configuration not found for ID: ${modelConfigId}` };
        }

        const provider = this.providers.get(config.provider);
        if (!provider) {
             return { success: false, error: `Unsupported provider: ${config.provider}` };
        }
        
        return provider.generateImage(prompt, config, referenceImages, aspectRatio, resolution, count, guidanceScale, extraParams);
    }

    async generateVideo(prompt: string, modelConfigId: string, startImage?: string, endImage?: string, existingTaskId?: string, onTaskId?: (id: string) => void, extraParams?: Record<string, any>): Promise<AIResult> {
        console.log(`[AIService] Generating video with model config ID: ${modelConfigId}${existingTaskId ? ` (Resuming taskId: ${existingTaskId})` : ''}`);

        const config = await this.getModelConfig(modelConfigId);
        if (!config) {
            return { success: false, error: `Model configuration not found for ID: ${modelConfigId}` };
        }

        const provider = this.providers.get(config.provider);
        if (!provider) {
             return { success: false, error: `Unsupported provider: ${config.provider}` };
        }

        return provider.generateVideo(prompt, config, startImage, endImage, existingTaskId, onTaskId, extraParams);
    }
}

export const aiService = new AIService();
export type { AIResult } from './ai/interfaces';
