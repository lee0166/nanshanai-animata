
export interface ParamDefinition {
    labelKey: string;
    format?: (value: any) => string;
}

export const AI_PARAM_DEFINITIONS: Record<string, ParamDefinition> = {
    aspectRatio: { labelKey: 'aiParams.aspectRatio' },
    resolution: { labelKey: 'aiParams.resolution' },
    guidanceScale: { labelKey: 'aiParams.guidanceScale' },
    step: { labelKey: 'aiParams.step' },
    steps: { labelKey: 'aiParams.step' }, // Common alias
    strength: { labelKey: 'aiParams.strength' },
    sampler: { labelKey: 'aiParams.sampler' },
    seed: { labelKey: 'aiParams.seed' },
    negativePrompt: { labelKey: 'aiParams.negativePrompt' },
    modelConfigId: { labelKey: 'aiParams.modelConfigId' },
    style: { labelKey: 'aiParams.style' },
    generateCount: { labelKey: 'aiParams.generateCount' },
    // Video params
    duration: { labelKey: 'aiParams.duration' },
    fps: { labelKey: 'aiParams.fps' },
};
