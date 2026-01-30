import { BaseProvider } from './BaseProvider';
import { AIResult } from '../interfaces';
import { ModelConfig } from '../../../types';

interface ModelscopeTaskResponse {
    task_id: string;
    task_status: string;
    output_images?: string[];
    errors?: { message: string };
}

export class ModelscopeProvider extends BaseProvider {
    id = 'modelscope';

    private getBaseUrl(config?: ModelConfig): string {
        return config?.apiUrl || 'https://api-inference.modelscope.cn/v1';
    }

    async generateImage(
        prompt: string,
        config: ModelConfig,
        referenceImages?: string[],
        aspectRatio?: string,
        resolution: string = '1024x1024',
        count: number = 1,
        guidanceScale?: number,
        extraParams?: Record<string, any>
    ): Promise<AIResult> {
        try {
            const apiKey = this.getApiKey(config);
            const baseUrl = this.getBaseUrl(config);

            const body: any = {
                model: config.modelId,
                prompt: prompt,
                n: count > 1 ? count : undefined,
            };

            if (resolution) {
                body.size = resolution;
            }

            if (guidanceScale) {
                body.guidance_scale = guidanceScale;
            }

            if (referenceImages && referenceImages.length > 0) {
                const images: string[] = [];
                for (const path of referenceImages) {
                    const b64 = await this.loadBlobAsBase64(path);
                    if (b64) images.push(b64);
                }
                if (images.length > 0) {
                    body.images = images;
                }
            }

            if (extraParams) {
                Object.assign(body, extraParams);
            }

            console.log(`[ModelscopeProvider] Submitting async image generation task: ${config.modelId}`);

            const submitResponse = await this.makeRequest(`${baseUrl}/images/generations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'X-ModelScope-Async-Mode': 'true'
                },
                body: JSON.stringify(body)
            });

            if (!submitResponse.ok) {
                const errorText = await submitResponse.text();
                throw new Error(`Modelscope API Error (${submitResponse.status}): ${errorText}`);
            }

            const submitData: any = await submitResponse.json();
            const taskId = submitData.task_id;

            if (!taskId) {
                throw new Error("Failed to get task_id from Modelscope API");
            }

            console.log(`[ModelscopeProvider] Task submitted: ${taskId}, polling for result...`);

            return await this.pollTask(taskId, apiKey, baseUrl);

        } catch (error: any) {
            console.error(`[ModelscopeProvider] Exception:`, error);
            return { success: false, error: error.message };
        }
    }

    private async pollTask(taskId: string, apiKey: string, baseUrl: string): Promise<AIResult> {
        const pollUrl = `${baseUrl}/tasks/${taskId}`;
        const maxAttempts = 86400 / 3;
        const interval = 12000;

        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await this.makeRequest(pollUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'X-ModelScope-Task-Type': 'image_generation'
                    }
                });

                if (!response.ok) {
                    if (response.status >= 500) {
                        await new Promise(r => setTimeout(r, interval));
                        continue;
                    }
                    const errorText = await response.text();
                    throw new Error(`Modelscope polling error (${response.status}): ${errorText}`);
                }

                const data: ModelscopeTaskResponse = await response.json();
                console.log(`[ModelscopeProvider] Task ${taskId} response:`, JSON.stringify(data, null, 2));

                if (data.task_status === 'SUCCEED') {
                    if (data.output_images && data.output_images.length > 0) {
                        const results = data.output_images.map((url: string) => ({ url }));
                        console.log(`[ModelscopeProvider] Task ${taskId} succeeded with ${results.length} images`);
                        return { success: true, data: results, meta: data };
                    }
                    return { success: false, error: "Task succeeded but no images found", meta: data };
                }

                if (data.task_status === 'FAILED') {
                    const errorMsg = data.errors?.message || 'Unknown error';
                    console.error(`[ModelscopeProvider] Task ${taskId} failed: ${errorMsg}`);
                    return { success: false, error: `Task failed: ${errorMsg}`, meta: data };
                }

                console.log(`[ModelscopeProvider] Task ${taskId} status: ${data.task_status} (attempt ${i + 1})`);

            } catch (e: any) {
                console.error(`[ModelscopeProvider] Polling exception for task ${taskId}:`, e);
            }

            await new Promise(r => setTimeout(r, interval));
        }

        return { success: false, error: "Image generation timed out (24h limit)" };
    }

    async generateVideo(
        prompt: string,
        config: ModelConfig,
        startImage?: string,
        endImage?: string,
        existingTaskId?: string,
        onTaskId?: (id: string) => void,
        extraParams?: Record<string, any>
    ): Promise<AIResult> {
        return { success: false, error: "Video generation not yet supported for Modelscope provider" };
    }
}
