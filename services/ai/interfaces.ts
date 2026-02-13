import { ModelConfig } from '../../types';

export interface AIResult {
    success: boolean;
    data?: any;
    error?: string;
    metadata?: Record<string, any>;
}

export interface IAIProvider {
    id: string; // e.g. 'volcengine'
    generateImage(prompt: string, config: ModelConfig, referenceImages?: string[], aspectRatio?: string, resolution?: string, count?: number, guidanceScale?: number, extraParams?: Record<string, any>): Promise<AIResult>;
    generateVideo(prompt: string, config: ModelConfig, startImage?: string, endImage?: string, existingTaskId?: string, onTaskId?: (id: string) => void, extraParams?: Record<string, any>): Promise<AIResult>;
    generateText?(prompt: string, config: ModelConfig, systemPrompt?: string, extraParams?: Record<string, any>): Promise<AIResult>;
    validateConfig(config: ModelConfig): boolean;
}
