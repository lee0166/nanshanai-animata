import { BaseProvider } from './BaseProvider';
import { AIResult } from '../interfaces';
import { ModelConfig } from '../../../types';

interface ViduTaskResponse {
    id: string;
    state?: string;
    err_code?: string;
    creations?: Array<{
        id: string;
        url: string;
        cover_url: string;
        watermarked_url: string;
    }>;
}

export class ViduProvider extends BaseProvider {
    id = 'vidu';

    private getBaseUrl(config?: ModelConfig): string {
        // Default to Vidu API endpoint
        // Ensure no trailing slash for easier concatenation
        const url = config?.apiUrl || 'https://api.vidu.cn/ent/v2';
        return url.endsWith('/') ? url.slice(0, -1) : url;
    }

    async generateImage(prompt: string, config: ModelConfig, referenceImages?: string[], aspectRatio?: string, resolution?: string, count?: number, guidanceScale?: number, extraParams?: Record<string, any>): Promise<AIResult> {
        try {
            const apiKey = this.getApiKey(config);
            const baseUrl = this.getBaseUrl(config);
            const endpoint = '/reference2image'; // As per documentation: https://platform.vidu.cn/docs/reference-to-image

            const body: any = {
                model: config.modelId, // viduq1 or viduq2
                prompt: prompt
            };

            // Common params
            if (resolution) {
                // Map unified '1K' to Vidu's '1080p'
                body.resolution = resolution === '1K' ? '1080p' : resolution;
            }
            if (aspectRatio) body.aspect_ratio = aspectRatio;
            if (extraParams?.seed) body.seed = extraParams.seed;

            // Handle Reference Images
            if (referenceImages && referenceImages.length > 0) {
                const imageUrls: string[] = [];
                for (const path of referenceImages) {
                    const b64 = await this.loadBlobAsBase64(path);
                    if (b64) imageUrls.push(b64);
                }
                if (imageUrls.length > 0) {
                    body.images = imageUrls;
                }
            } else if (config.capabilities?.requiresImageInput) {
                 return { success: false, error: `${config.modelId} requires at least one reference image.` };
            }

            console.log(`[ViduProvider] Creating video task at ${baseUrl}${endpoint} with model ${config.modelId}`);

            const response = await this.makeRequest(`${baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${apiKey}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Vidu API Error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            const taskId = data.id || data.task_id;

            if (!taskId) {
                throw new Error("Failed to get Task ID from Vidu API");
            }

            // Reuse polling logic, assuming image tasks follow similar state patterns
            return await this.pollVideoTask(taskId, apiKey, baseUrl);

        } catch (error: any) {
            console.error("[ViduProvider] Image Generation Error:", error);
            return { success: false, error: error.message };
        }
    }

    async generateVideo(prompt: string, config: ModelConfig, startImage?: string, endImage?: string, existingTaskId?: string, onTaskId?: (id: string) => void, extraParams?: Record<string, any>): Promise<AIResult> {
        try {
            const apiKey = this.getApiKey(config);
            const baseUrl = this.getBaseUrl(config);

            // If resuming a task
            if (existingTaskId) {
                return await this.pollVideoTask(existingTaskId, apiKey, baseUrl);
            }

            // Determine endpoint and payload based on inputs
            let endpoint = '';
            const body: any = {
                model: config.modelId,
                prompt: prompt
            };

            // Common params
            if (extraParams?.duration) body.duration = extraParams.duration;
            const ratio = extraParams?.aspectRatio || extraParams?.ratio;
            if (ratio) body.aspect_ratio = ratio; // Vidu uses aspect_ratio
            if (extraParams?.resolution) {
                // Map unified '1K' to Vidu's '1080p'
                body.resolution = extraParams.resolution === '1K' ? '1080p' : extraParams.resolution;
            }
            if (extraParams?.seed) body.seed = extraParams.seed;
            
            // New Vidu Params
            if (extraParams?.movementAmplitude) body.movement_amplitude = extraParams.movementAmplitude;
            if (extraParams?.bgm !== undefined) body.bgm = extraParams.bgm;
            // Map generateAudio (unified) to audio (API)
            if (extraParams?.generateAudio !== undefined) body.audio = extraParams.generateAudio;
            if (extraParams?.style) body.style = extraParams.style;
            if (extraParams?.isRec !== undefined) body.is_rec = extraParams.isRec;
            if (extraParams?.watermark !== undefined) body.watermark = extraParams.watermark;

            // Check offPeak (unified) or off_peak (legacy)
            const offPeak = extraParams?.offPeak !== undefined ? extraParams.offPeak : extraParams?.off_peak;
            if (offPeak !== undefined) body.off_peak = offPeak;
            
            // Handle different generation types
            const hasStart = !!startImage;
            const hasEnd = !!endImage;
            const hasRefs = extraParams?.referenceImages && extraParams.referenceImages.length > 0;
            const isReferenceToVideo = config.capabilities?.supportedGenerationTypes?.includes('multi_ref') && hasRefs;

            if (isReferenceToVideo) {
                // Reference to Video
                endpoint = '/reference2video';
                
                // Construct images array
                const imageUrls: string[] = [];
                // Load reference images
                if (extraParams?.referenceImages) {
                    for (let i = 0; i < extraParams.referenceImages.length; i++) {
                        const path = extraParams.referenceImages[i];
                        const b64 = await this.loadBlobAsBase64(path);
                        if (b64) {
                            imageUrls.push(b64);
                        } else {
                            console.warn(`[ViduProvider] Failed to load reference image at ${path}`);
                        }
                    }
                }
                
                if (imageUrls.length === 0) {
                     return { success: false, error: "Failed to load any reference images for multi-reference video generation." };
                }

                body.images = imageUrls;
                
            } else if (hasStart && hasEnd) {
                // Start + End to Video
                endpoint = '/start-end2video';
                const startB64 = await this.loadBlobAsBase64(startImage!);
                const endB64 = await this.loadBlobAsBase64(endImage!);
                if (startB64 && endB64) {
                    body.images = [startB64, endB64];
                } else {
                    throw new Error("Failed to load start or end image");
                }
            } else if (hasStart) {
                // Image to Video (Start Frame)
                endpoint = '/img2video';
                const startB64 = await this.loadBlobAsBase64(startImage!);
                if (startB64) {
                    body.images = [startB64];
                } else {
                    throw new Error("Failed to load start image");
                }
            } else {
                // Text to Video
                endpoint = '/text2video';
            }

            console.log(`[ViduProvider] Creating task at ${endpoint} with model ${config.modelId}`);
            
            const response = await this.makeRequest(`${baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${apiKey}` // Vidu uses 'Token' prefix usually, or Bearer. User said "Token {key}"
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Vidu API Error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            const taskId = data.id || data.task_id; // Vidu returns 'id' or 'task_id' depending on endpoint version

            if (!taskId) {
                throw new Error("Failed to get Task ID from Vidu API");
            }

            if (onTaskId) onTaskId(taskId);

            // Important: Return immediately so Queue can handle polling/persistence
            // We return a "Pending" result essentially, but our AIResult interface expects final data or a promise of it.
            // The Queue architecture for Video expects this method to BLOCK until completion (via polling),
            // OR to throw if submission fails.
            // 
            // HOWEVER, the Queue calls `generateVideo` and awaits it. If we await `pollVideoTask` here,
            // the Queue will be blocked on this single job, preventing parallelism if we had multiple workers (though JS is single threaded).
            // But `JobQueue.executeJob` is async and not awaited by `processQueue` loop, so blocking here is FINE and expected.
            // The `onTaskId` callback allows the Queue to save the Task ID before we finish polling.
            
            return await this.pollVideoTask(taskId, apiKey, baseUrl);

        } catch (error: any) {
            console.error("[ViduProvider] Error:", error);
            return { success: false, error: error.message };
        }
    }

    private async pollVideoTask(taskId: string, apiKey: string, baseUrl: string): Promise<AIResult> {
        const pollUrl = `${baseUrl}/tasks/${taskId}/creations`;
        const maxAttempts = 86400/5; // 24 hours (5s interval)
        const interval = 5000;

        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await this.makeRequest(pollUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Token ${apiKey}`
                    }
                });

                if (!response.ok) {
                    if (response.status >= 500) {
                        await new Promise(r => setTimeout(r, interval));
                        continue;
                    }
                    const txt = await response.text();
                    throw new Error(`Polling error: ${txt}`);
                }

                const data: any = await response.json();
                
                // State: created, queueing, processing, success, failed
                if (data.state === 'success') {
                    if (data.creations && data.creations.length > 0) {
                        // Determine if this is an image or video task
                        // Based on 'type' field (e.g., 'reference2image') or infer from content
                        const isImage = data.type && data.type.toLowerCase().includes('image');
                        
                        if (isImage) {
                            return {
                                success: true,
                                data: data.creations.map((c: any) => ({ url: c.url })),
                                meta: data
                            };
                        } else {
                             return { 
                                success: true, 
                                data: { videoUri: data.creations[0].url }, 
                                meta: data 
                            };
                        }
                    }
                    return { success: false, error: "Task succeeded but no creations found", meta: data };
                }

                if (data.state === 'failed') {
                    return { success: false, error: `Vidu Task Failed: ${data.err_code || 'Unknown error'}`, meta: data };
                }

                // Continue polling
                console.log(`[ViduProvider] Task ${taskId} status: ${data.state}`);

            } catch (e) {
                console.error("Polling exception", e);
            }
            
            await new Promise(r => setTimeout(r, interval));
        }

        return { success: false, error: "Video generation timed out" };
    }
}
