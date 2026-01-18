import { ModelConfig, ModelParameter } from '../types';
import { storageService } from './storage';
import { DEFAULT_MODELS } from '../config/models';

/**
 * Standard Unified Keys for AI Model Parameters
 * These keys should be used across the application to refer to common parameters.
 */
export const UNIFIED_KEYS = {
    RESOLUTION: 'resolution',
    ASPECT_RATIO: 'aspectRatio',
    DURATION: 'duration',
    GUIDANCE_SCALE: 'guidanceScale',
    NEGATIVE_PROMPT: 'negativePrompt',
    SEED: 'seed',
    COUNT: 'count', // or generateCount
    STYLE: 'style',
    OFF_PEAK: 'offPeak',
    RESPONSE_FORMAT: 'responseFormat',
    GENERATE_AUDIO: 'generateAudio',
    WATERMARK: 'watermark',
    FRAMES: 'frames',
    FPS: 'framesPerSecond',
    CAMERA_FIXED: 'cameraFixed',
    RETURN_LAST_FRAME: 'returnLastFrame',
    MOVEMENT_AMPLITUDE: 'movementAmplitude',
    BGM: 'bgm',
    VOICE_ID: 'voiceId',
    IS_REC: 'isRec',
    PAYLOAD: 'payload',
    AUDIO: 'audio', // Map to generateAudio or audio
};

/**
 * Resolve the full static configuration for a runtime model instance.
 * This handles looking up the base definition in DEFAULT_MODELS using id or modelId.
 * 
 * @param runtimeModel The model instance from user settings
 * @returns The matching static configuration from DEFAULT_MODELS, or undefined
 */
export const resolveModelConfig = (runtimeModel: ModelConfig | undefined): ModelConfig | undefined => {
    if (!runtimeModel) return undefined;
    
    // 1. Priority: Match by templateId (User instances created from a template)
    if (runtimeModel.templateId) {
        const templateMatch = DEFAULT_MODELS.find(m => m.id === runtimeModel.templateId);
        if (templateMatch) return templateMatch;
    }
    
    // 2. Try exact match by ID (if user hasn't renamed/copied it yet, or if ID matches)
    // 3. Try match by modelId (the provider's model identifier)
    const exactMatch = DEFAULT_MODELS.find(m => m.id === runtimeModel.id || m.modelId === runtimeModel.modelId);
    if (exactMatch) return exactMatch;
    
    // 4. Fallback: match by provider and type (least specific)
    return DEFAULT_MODELS.find(m => m.provider === runtimeModel.provider && m.type === runtimeModel.type);
};

/**
 * Get all submittable parameter keys for a model (Unified Keys).
 * This returns the keys that the UI should present controls for.
 * 
 * @param modelConfig The model configuration object
 * @returns Array of parameter keys (e.g., ['resolution', 'aspectRatio', 'guidanceScale'])
 */
export const getUnifiedModelParams = (modelConfig: ModelConfig | undefined): string[] => {
    if (!modelConfig || !modelConfig.parameters) return [];
    return modelConfig.parameters.map(p => p.name);
};

/**
 * Get the definition/options for a specific parameter of a model.
 * 
 * @param modelConfig The model configuration object
 * @param paramKey The unified parameter key (e.g., 'resolution')
 * @returns The parameter definition including options (for select) or range (for number)
 */
export const getModelParamInfo = (modelConfig: ModelConfig | undefined, paramKey: string): ModelParameter | undefined => {
    if (!modelConfig || !modelConfig.parameters) return undefined;
    return modelConfig.parameters.find(p => p.name === paramKey);
};

/**
 * Helper to get options for a select parameter.
 * Returns empty array if parameter doesn't exist or is not a select type.
 */
export const getParamOptions = (modelConfig: ModelConfig | undefined, paramKey: string): { label: string; value: any }[] => {
    const param = getModelParamInfo(modelConfig, paramKey);
    if (param && param.type === 'select' && param.options) {
        return param.options;
    }
    return [];
};

/**
 * Helper to get range/defaults for a number parameter.
 */
export const getParamRange = (modelConfig: ModelConfig | undefined, paramKey: string) => {
    const param = getModelParamInfo(modelConfig, paramKey);
    if (param && param.type === 'number') {
        return {
            min: param.min,
            max: param.max,
            step: param.step,
            defaultValue: param.defaultValue
        };
    }
    return null;
};

/**
 * Filter parameters based on visibility/hidden conditions.
 * 
 * @param params List of model parameters
 * @param context Current generation context (type, start/end image presence)
 * @returns Filtered list of parameters
 */
export const processModelParams = (
    params: ModelParameter[],
    context: {
        generationType?: 'text_to_video' | 'first_last_frame' | 'multi_ref';
        hasStartImage?: boolean;
        hasEndImage?: boolean;
    }
): ModelParameter[] => {
    if (!params) return [];

    return params.filter(param => {
        // 1. Check Visibility Condition (Whitelist: Show ONLY if matches)
        if (param.visibilityCondition) {
            const cond = param.visibilityCondition;
            
            // Check generation type
            if (cond.generationType && context.generationType) {
                if (!cond.generationType.includes(context.generationType)) return false;
            }

            // Check start image
            if (cond.hasStartImage !== undefined) {
                const currentHasStart = !!context.hasStartImage;
                if (cond.hasStartImage !== currentHasStart) return false;
            }

            // Check end image
            if (cond.hasEndImage !== undefined) {
                const currentHasEnd = !!context.hasEndImage;
                if (cond.hasEndImage !== currentHasEnd) return false;
            }
        }

        // 2. Check Hidden Condition (Blacklist: Hide IF matches)
        if (param.hiddenCondition) {
            const cond = param.hiddenCondition;
            let match = true; // Assume match, check if any condition fails to match

            // Check generation type (If specified, must match to be hidden)
            if (cond.generationType) {
                if (!context.generationType || !cond.generationType.includes(context.generationType)) {
                    match = false;
                }
            }

            // Check start image (If specified, must match to be hidden)
            if (cond.hasStartImage !== undefined) {
                const currentHasStart = !!context.hasStartImage;
                if (cond.hasStartImage !== currentHasStart) {
                    match = false;
                }
            }

            // Check end image (If specified, must match to be hidden)
            if (cond.hasEndImage !== undefined) {
                const currentHasEnd = !!context.hasEndImage;
                if (cond.hasEndImage !== currentHasEnd) {
                    match = false;
                }
            }

            // If ALL specified conditions match, then we HIDE this parameter
            if (match) return false;
        }

        return true;
    });
};
