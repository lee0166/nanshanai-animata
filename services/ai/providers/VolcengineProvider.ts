import { BaseProvider } from './BaseProvider';
import { AIResult } from '../interfaces';
import { ModelConfig } from '../../../types';
import { IVolcengineStrategy, Seedream4Strategy, Seedream3Strategy, DefaultStrategy, VolcImageRequest } from '../adapters/volcengine/strategies';
import { storageService } from '../../storage';

interface VolcVideoGenerationRequest {
    model: string;
    content: Array<{
        type: 'text' | 'image_url';
        text?: string;
        image_url?: {
            url: string; 
        };
    }>;
}

interface VolcTaskResponse {
    id: string;
    status?: string;
    error?: {
        code: string;
        message: string;
    };
}

interface VolcTaskStatusResponse {
    id: string;
    status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
    content?: {
        video_url?: string;
        last_frame_url?: string;
    };
    error?: {
        code: string;
        message: string;
    };
}

export class VolcengineProvider extends BaseProvider {
    id = 'volcengine';
    
    // Helper to determine the API endpoint
    private getBaseUrl(config?: ModelConfig): string {
        return config?.apiUrl || 'https://ark.cn-beijing.volces.com/api/v3';
    }

    private getStrategy(config: ModelConfig): IVolcengineStrategy {
        // Explicit strategy selection from config
        const strategyType = config.providerOptions?.volcengine?.strategy;
        
        if (strategyType === 'seedream-4') return new Seedream4Strategy();
        if (strategyType === 'seedream-3') return new Seedream3Strategy();
        
        // Default to DefaultStrategy if not specified or 'default'
        return new DefaultStrategy();
    }

    async generateImage(prompt: string, config: ModelConfig, referenceImages: string[] = [], aspectRatio: string = '1:1', resolution: string = '2K', count: number = 1, guidanceScale?: number, extraParams?: Record<string, any>): Promise<AIResult> {
        try {
            console.log(`[VolcengineProvider] Generating image. Config ID: ${config.id}`);
            const apiKey = this.getApiKey(config);
            const url = `${this.getBaseUrl(config)}/images/generations`;
            
            // 1. Load Images
            const loadedImages: string[] = [];
            if (referenceImages && referenceImages.length > 0) {
                 const blobs = await Promise.all(referenceImages.map(img => this.loadBlobAsBase64(img)));
                 loadedImages.push(...blobs.filter((b): b is string => !!b));
            }

            // 2. Prepare Strategy
            const strategy = this.getStrategy(config);
            const size = strategy.resolveSize(aspectRatio, resolution);
            
            // 3. Prepare Request
            const body = strategy.prepareRequest(prompt, config, loadedImages, size, count, guidanceScale, extraParams);

            console.log(`[VolcengineProvider] Request body:`, JSON.stringify(body, (key, value) => {
                if (key === 'image' || key === 'b64_json') return "<Base64_Data>";
                return value;
            }, 2));

            const response = await this.makeRequest(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Volcengine Error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                // Process results
                 const results = await Promise.all(data.data.map(async (item: any) => {
                    if (item.b64_json) {
                        return { base64: item.b64_json };
                    }
                    if (item.url) {
                        // Download logic
                         try {
                            const res = await fetch(item.url);
                            const blob = await res.blob();
                            const filename = `generated/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
                            await storageService.saveBinaryFile(filename, blob);
                            return { path: filename };
                         } catch (e) {
                            return { url: item.url };
                         }
                    }
                    return null;
                }));
                
                const validResults = results.filter(Boolean);
                if (validResults.length > 0) {
                     // Create meta
                     const { data: originalData, ...rawMeta } = data;
                     const sanitizedData = originalData?.map((item: any) => ({ ...item, b64_json: "<Base64_Data>" }));
                     
                     const [wStr, hStr] = size.split('x');
                     const meta = { 
                        ...rawMeta, 
                        data: sanitizedData,
                        aspectRatio,
                        resolution,
                        guidanceScale,
                        width: parseInt(wStr) || 0,
                        height: parseInt(hStr) || 0,
                        modelConfigId: config.id
                     };

                     if (count > 1 || validResults.length > 1) {
                        return { success: true, data: validResults, meta };
                     }
                     return { success: true, data: validResults[0], meta };
                }
            }

            return { success: false, error: "No image data found" };

        } catch (error: any) {
            console.error(`[VolcengineProvider] Exception:`, error);
            return { success: false, error: error.message };
        }
    }

    async generateVideo(prompt: string, config: ModelConfig, startImage?: string, endImage?: string, existingTaskId?: string, onTaskId?: (id: string) => void, extraParams?: Record<string, any>): Promise<AIResult> {
        try {
            const apiKey = this.getApiKey(config);
            
            if (existingTaskId) {
                 return await this.pollVideoTask(existingTaskId, apiKey, this.getBaseUrl(config));
            }

            const createUrl = `${this.getBaseUrl(config)}/contents/generations/tasks`;
            const content: any[] = [];

            // Determine if model supports advanced roles (e.g. first_frame/last_frame)
            const useRoles = config.capabilities?.supportsEndFrame === true || config.capabilities?.supportsStartFrame === true;
            // Check for multi-reference image support (role: reference_image)
            const useMultiRef = config.capabilities?.supportsReferenceImage === true && config.type === 'video';

            // Handle Prompt (Clean, parameters moved to body)
            content.push({ type: 'text', text: prompt });

            if (startImage) {
                const b64 = await this.loadBlobAsBase64(startImage);
                if (b64) {
                    const imgObj: any = { type: 'image_url', image_url: { url: b64 } };
                    if (useRoles) imgObj.role = 'first_frame';
                    content.push(imgObj);
                }
            }
            
            if (endImage && config.capabilities?.supportsEndFrame) {
                const b64 = await this.loadBlobAsBase64(endImage);
                if (b64) {
                    content.push({ type: 'image_url', image_url: { url: b64 }, role: 'last_frame' });
                }
            }

            // Handle Multi-Reference Images for Video
            if (useMultiRef && extraParams?.referenceImages && Array.isArray(extraParams.referenceImages)) {
                for (const imgPath of extraParams.referenceImages) {
                    const b64 = await this.loadBlobAsBase64(imgPath);
                    if (b64) {
                        content.push({ 
                            type: 'image_url', 
                            image_url: { url: b64 }, 
                            role: 'reference_image' 
                        });
                    }
                }
            }

            // Construct Body with unified parameter mapping
            const body: any = {
                model: config.modelId,
                content: content
            };
            
            // Map extraParams to API fields
            if (extraParams) {
                // Ratio (aspectRatio -> ratio)
                if (extraParams.aspectRatio || extraParams.ratio) {
                    body.ratio = extraParams.aspectRatio || extraParams.ratio;
                }
                
                // Duration
                if (extraParams.duration) body.duration = extraParams.duration;
                
                // Resolution
                if (extraParams.resolution) body.resolution = extraParams.resolution;
                
                // Seed
                if (extraParams.seed !== undefined) body.seed = extraParams.seed;
                
                // Watermark
                if (extraParams.watermark !== undefined) body.watermark = extraParams.watermark;
                
                // Return Last Frame
                if (extraParams.returnLastFrame !== undefined) body.return_last_frame = extraParams.returnLastFrame;
                
                // Frames
                if (extraParams.frames) body.frames = extraParams.frames;
                
                // FPS
                if (extraParams.framesPerSecond) body.framespersecond = extraParams.framesPerSecond;
                
                // Camera Fixed
                if (extraParams.cameraFixed !== undefined) body.camerafixed = extraParams.cameraFixed;
            }

            // Handle generate_audio
            // Check unified key first, then legacy key
            const shouldGenerateAudio = extraParams?.generateAudio !== undefined ? extraParams.generateAudio : extraParams?.generate_audio;
            if (config.capabilities?.supportsAudioGeneration && shouldGenerateAudio !== false) {
                body.generate_audio = true;
            } else if (shouldGenerateAudio === false) {
                body.generate_audio = false;
            }

            console.log(`[VolcengineProvider] Video Request body:`, JSON.stringify(body, null, 2));

            const createRes = await this.makeRequest(createUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify(body)
            });

            if (!createRes.ok) {
                 const txt = await createRes.text();
                 throw new Error(`Volcengine Video Error (${createRes.status}): ${txt}`);
            }

            const createData: VolcTaskResponse = await createRes.json();
            const taskId = createData.id;
            
            if (!taskId) throw new Error("Failed to get Task ID");
            
            if (onTaskId) onTaskId(taskId);
            
            return await this.pollVideoTask(taskId, apiKey, this.getBaseUrl(config));

        } catch (error: any) {
             return { success: false, error: error.message };
        }
    }

    private async pollVideoTask(taskId: string, apiKey: string, baseUrl: string): Promise<AIResult> {
        const pollUrl = `${baseUrl}/contents/generations/tasks/${taskId}`;
        const maxAttempts = 86400/5;// 24 hours (5s interval)
        const interval = 5000;

        for (let i = 0; i < maxAttempts; i++) {
             try {
                const res = await this.makeRequest(pollUrl, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                
                if (!res.ok) {
                     // retry logic
                     if (res.status >= 500) { await new Promise(r => setTimeout(r, interval)); continue; }
                     const txt = await res.text();
                     throw new Error(`Polling error: ${txt}`);
                }

                const data: VolcTaskStatusResponse = await res.json();
                if (data.status === 'succeeded') {
                     if (data.content && data.content.video_url) {
                         return { success: true, data: { videoUri: data.content.video_url }, meta: data };
                     }
                     return { success: false, error: "Task succeeded but no video URL", meta: data };
                }
                if (['failed', 'cancelled', 'expired'].includes(data.status)) {
                    return { success: false, error: `Video generation ${data.status}: ${data.error?.message}`, meta: data };
                }
             } catch (e) {
                 console.error("Polling exception", e);
             }
             await new Promise(r => setTimeout(r, interval));
        }
        return { success: false, error: "Video generation timed out" };
    }
}
