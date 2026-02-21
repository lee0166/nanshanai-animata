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
            console.log('[VolcengineProvider] received referenceImages length:', referenceImages.length);
            if (referenceImages.length > 0) {
                console.log('[VolcengineProvider] first image preview:', referenceImages[0].substring(0, 50));
            }
            const apiKey = this.getApiKey(config);
            const url = `${this.getBaseUrl(config)}/images/generations`;

            // 1. Load Images
            const loadedImages: string[] = [];
            if (referenceImages && referenceImages.length > 0) {
                 const blobs = await Promise.all(referenceImages.map(img => this.loadBlobAsBase64(img)));
                 loadedImages.push(...blobs.filter((b): b is string => !!b));
            }
            console.log('[VolcengineProvider] loadedImages after processing:', loadedImages.length);

            // 2. Prepare Strategy
            const strategy = this.getStrategy(config);
            // 如果 resolution 已经是具体像素格式（如 1024x576），直接使用
            // 否则调用 resolveSize 计算
            const size = resolution && /^\d+x\d+$/.test(resolution) 
                ? resolution 
                : strategy.resolveSize(aspectRatio, resolution);
            
            // 3. Prepare Request
            const body = strategy.prepareRequest(prompt, config, loadedImages, size, count, guidanceScale, extraParams);

            console.log('[VolcengineProvider] body.image field:', body.image ? `present (length: ${Array.isArray(body.image) ? body.image.length : 1})` : 'not present');
            if (body.image) {
                const imagePreview = Array.isArray(body.image) 
                    ? body.image[0].substring(0, 50) 
                    : body.image.substring(0, 50);
                console.log('[VolcengineProvider] body.image preview:', imagePreview);
            }

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
                    // Support both b64_json (API standard) and base64 (actual response)
                    const base64Data = item.b64_json || item.base64;
                    if (base64Data) {
                        // Convert base64 to data URL
                        return { 
                            url: `data:image/jpeg;base64,${base64Data}`,
                            width: item.width || parseInt(size.split('x')[0]) || 0,
                            height: item.height || parseInt(size.split('x')[1]) || 0,
                            modelId: config.modelId
                        };
                    }
                    if (item.url) {
                        // Return URL for now, will handle download in KeyframeService
                        return { 
                            url: item.url,
                            width: item.width || parseInt(size.split('x')[0]) || 0,
                            height: item.height || parseInt(size.split('x')[1]) || 0,
                            modelId: config.modelId
                        };
                    }
                    return null;
                }));
                
                const validResults = results.filter(Boolean);
                console.log('[VolcengineProvider] validResults:', validResults);
                
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

                     // Always return array format for consistency across all providers
                     console.log('[VolcengineProvider] Returning success with data:', validResults);
                     return { success: true, data: validResults, metadata: meta };
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
                         return { success: true, data: { videoUri: data.content.video_url }, metadata: data };
                     }
                     return { success: false, error: "Task succeeded but no video URL", metadata: data };
                }
                if (['failed', 'cancelled', 'expired'].includes(data.status)) {
                    return { success: false, error: `Video generation ${data.status}: ${data.error?.message}`, metadata: data };
                }
             } catch (e) {
                 console.error("Polling exception", e);
             }
             await new Promise(r => setTimeout(r, interval));
        }
        return { success: false, error: "Video generation timed out" };
    }

    /**
     * Generate text using Volcengine LLM (OpenAI compatible API)
     * Supports Doubao, DeepSeek, Kimi, GLM and other models hosted on Volcengine
     */
    async generateText(
        prompt: string,
        config: ModelConfig,
        systemPrompt?: string,
        extraParams?: Record<string, any>
    ): Promise<AIResult> {
        try {
            const apiKey = this.getApiKey(config);
            const apiUrl = config.apiUrl || this.getBaseUrl(config);
            const modelId = config.modelId;

            // Build messages
            const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }
            messages.push({ role: 'user', content: prompt });

            // Get parameters from config or extraParams
            const temperature = extraParams?.temperature ?? 
                config.parameters?.find(p => p.name === 'temperature')?.defaultValue ?? 0.3;
            const maxTokens = extraParams?.maxTokens ?? 
                config.parameters?.find(p => p.name === 'maxTokens')?.defaultValue ?? 4000;

            // Build request body
            const requestBody: {
                model: string;
                messages: typeof messages;
                temperature: number;
                max_tokens: number;
                stream: boolean;
                enable_thinking?: boolean;
            } = {
                model: modelId,
                messages,
                temperature,
                max_tokens: maxTokens,
                stream: false,
            };

            // Add enable_thinking from model config (for DeepSeek R1, Kimi Thinking, etc.)
            const enableThinking = config.providerOptions?.enableThinking;
            if (enableThinking !== undefined) {
                requestBody.enable_thinking = enableThinking;
            }

            console.log(`[VolcengineProvider] LLM Request: ${apiUrl}/chat/completions`);
            console.log(`[VolcengineProvider] Model: ${modelId}`);
            console.log(`[VolcengineProvider] Temperature: ${temperature}, MaxTokens: ${maxTokens}`);

            const response = await this.makeRequest(`${apiUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify(requestBody),
            }, 120000); // 120 second timeout for LLM

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[VolcengineProvider] LLM API Error: ${response.status} - ${errorText}`);
                return {
                    success: false,
                    error: `API Error: ${response.status} - ${errorText}`,
                };
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content || '';

            console.log(`[VolcengineProvider] LLM Response received, length: ${content.length} chars`);

            return {
                success: true,
                data: content,
                metadata: {
                    usage: data.usage,
                    model: modelId,
                },
            };
        } catch (error: any) {
            console.error('[VolcengineProvider] LLM Error:', error);
            return {
                success: false,
                error: error.message || 'Unknown error occurred',
            };
        }
    }
}
