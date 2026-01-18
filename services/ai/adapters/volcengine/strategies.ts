import { ModelConfig } from '../../../../types';

export interface VolcImageRequest {
    model: string;
    prompt: string;
    image?: string | string[];
    size?: string;
    sequential_image_generation?: 'auto' | 'disabled';
    sequential_image_generation_options?: {
        max_images?: number;
    };
    response_format?: 'url' | 'b64_json';
    watermark?: boolean;
    guidance_scale?: number;
}

export interface IVolcengineStrategy {
    resolveSize(aspectRatio: string, resolution: string): string;
    prepareRequest(prompt: string, config: ModelConfig, images: string[], size: string, count: number, guidanceScale?: number, extraParams?: Record<string, any>): VolcImageRequest;
}

export class Seedream4Strategy implements IVolcengineStrategy {
    resolveSize(aspectRatio: string, resolution: string): string {
         const map: Record<string, {w: number, h: number}> = {
             '1:1': {w: 2048, h: 2048},
             '4:3': {w: 2304, h: 1728},
             '3:4': {w: 1728, h: 2304},
             '16:9': {w: 2560, h: 1440},
             '9:16': {w: 1440, h: 2560},
             '3:2': {w: 2496, h: 1664},
             '2:3': {w: 1664, h: 2496},
             '21:9': {w: 3024, h: 1296},
             '9:21': {w: 1296, h: 3024}
         };
         const base = map[aspectRatio] || map['1:1'];
         
         let multiplier = 1;
         if (resolution === '4K') multiplier = 2;
         if (resolution === '1K') multiplier = 0.5;
         
         const w = Math.round(base.w * multiplier);
         const h = Math.round(base.h * multiplier);
         return `${w}x${h}`;
    }

    prepareRequest(prompt: string, config: ModelConfig, images: string[], size: string, count: number, guidanceScale?: number, extraParams?: Record<string, any>): VolcImageRequest {
        const body: VolcImageRequest = {
            model: config.modelId,
            prompt: count > 1 ? `${prompt}，生成${count}张图` : prompt,
            size: size,
            response_format: "b64_json",
            watermark: false
        };

        if (count > 1) {
            body.sequential_image_generation = "auto";
            body.sequential_image_generation_options = { max_images: count };
        }

        if (images.length > 0) {
            body.image = images.length === 1 ? images[0] : images;
        }

        if (guidanceScale) body.guidance_scale = guidanceScale;
        if (extraParams) Object.assign(body, extraParams);

        return body;
    }
}

export class Seedream3Strategy implements IVolcengineStrategy {
    resolveSize(aspectRatio: string, resolution: string): string {
        const map: Record<string, string> = {
             '1:1': '1024x1024',
             '4:3': '1152x864',
             '3:4': '864x1152',
             '16:9': '1280x720',
             '9:16': '720x1280',
             '3:2': '1248x832',
             '2:3': '832x1248',
             '21:9': '1512x648'
        };
        return map[aspectRatio] || '1024x1024';
    }

    prepareRequest(prompt: string, config: ModelConfig, images: string[], size: string, count: number, guidanceScale?: number, extraParams?: Record<string, any>): VolcImageRequest {
        const body: VolcImageRequest = {
            model: config.modelId,
            prompt: prompt,
            size: size,
            response_format: "b64_json",
            watermark: false
        };

        // Use configuration flag to determine if sequential generation is supported
        const disableSequential = config.providerOptions?.volcengine?.disableSequential === true;

        if (count > 1 && !disableSequential) {
              body.sequential_image_generation = "auto";
              body.sequential_image_generation_options = { max_images: count };
        }
        
        if (count > 1) {
            body.prompt = `${prompt}，生成${count}张图`;
        }

        if (guidanceScale !== undefined) {
            body.guidance_scale = guidanceScale;
        }

        if (images.length > 0) {
            // Check if it's an I2I model via explicit capability
            if (config.capabilities?.requiresImageInput) {
                body.image = images[0];
            }
        }
        
        if (extraParams) Object.assign(body, extraParams);

        return body;
    }
}

export class DefaultStrategy implements IVolcengineStrategy {
    resolveSize(aspectRatio: string, resolution: string): string {
        const ratioMap: Record<string, {w: number, h: number}> = {
            '1:1': {w: 1024, h: 1024},
            '4:3': {w: 1024, h: 768},
            '3:4': {w: 768, h: 1024},
            '16:9': {w: 1280, h: 720},
            '9:16': {w: 720, h: 1280},
            '21:9': {w: 1680, h: 720},
            '9:21': {w: 720, h: 1680}
        };
        const base = ratioMap[aspectRatio] || ratioMap['1:1'];
        let scale = 1;
        if (resolution === '2K') scale = 2;
        if (resolution === '4K') scale = 4;
        return `${base.w * scale}x${base.h * scale}`;
    }

    prepareRequest(prompt: string, config: ModelConfig, images: string[], size: string, count: number, guidanceScale?: number, extraParams?: Record<string, any>): VolcImageRequest {
        const shouldAppend = config.capabilities?.appendCountToPrompt ?? true;
        const body: VolcImageRequest = {
            model: config.modelId,
            prompt: (count > 1 && shouldAppend) ? `${prompt}，生成${count}张图` : prompt,
            size: size,
            response_format: "b64_json",
            watermark: false
        };
        if (count > 1) {
            body.sequential_image_generation = "auto";
            body.sequential_image_generation_options = { max_images: count };
        }
        if (images.length > 0) {
             body.image = images.length === 1 ? images[0] : images;
        }
        if (extraParams) Object.assign(body, extraParams);
        return body;
    }
}
