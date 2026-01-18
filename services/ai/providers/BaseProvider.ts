import { AIResult, IAIProvider } from '../interfaces';
import { ModelConfig } from '../../../types';
import { storageService } from '../../storage';

export abstract class BaseProvider implements IAIProvider {
    abstract id: string;

    abstract generateImage(prompt: string, config: ModelConfig, referenceImages?: string[], aspectRatio?: string, resolution?: string, count?: number, guidanceScale?: number, extraParams?: Record<string, any>): Promise<AIResult>;
    abstract generateVideo(prompt: string, config: ModelConfig, startImage?: string, endImage?: string, existingTaskId?: string, onTaskId?: (id: string) => void, extraParams?: Record<string, any>): Promise<AIResult>;

    validateConfig(config: ModelConfig): boolean {
        return !!config.apiKey;
    }

    protected getApiKey(config: ModelConfig): string {
        const key = config.apiKey || process.env.API_KEY;
        if (!key) {
            throw new Error(`API Key is missing for model: ${config.name}`);
        }
        return key;
    }

    protected async loadBlobAsBase64(urlOrPath: string): Promise<string | null> {
         if (urlOrPath.startsWith('data:')) return urlOrPath;
         
         try {
             let blob: Blob;
             if (urlOrPath.startsWith('http')) {
                const res = await this.makeRequest(urlOrPath);
                blob = await res.blob();
            } else {
                 const storageUrl = await storageService.getAssetUrl(urlOrPath);
                 if (!storageUrl) return null;
                 const res = await fetch(storageUrl);
                 blob = await res.blob();
             }
             return await this.blobToBase64DataUri(blob);
         } catch (e) {
             console.error("Failed to load blob as base64", e);
             return null;
         }
    }

    protected blobToBase64DataUri(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Universal proxy request helper
     * Routes requests through the Vite proxy in development to avoid CORS issues.
     */
    protected async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
        // In development, route through our universal proxy to handle CORS dynamically
        // Also support localhost in production (e.g. preview mode) if proxy is available
        const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        const shouldUseProxy = import.meta.env.DEV || isLocalhost;

        console.log(`[BaseProvider] Requesting: ${url}, Mode: ${import.meta.env.DEV ? 'DEV' : 'PROD'}, Localhost: ${isLocalhost}`);
        
        if (shouldUseProxy) {
            const proxyUrl = '/api/universal-proxy';
            const headers = new Headers(options.headers || {});
            
            // Check if X-Target-URL is already set (avoid double setting if chained)
            if (!headers.has('X-Target-URL')) {
                headers.set('X-Target-URL', url);
            }
            
            console.log(`[BaseProvider] Using Proxy: ${proxyUrl} -> ${url}`);
            return fetch(proxyUrl, {
                ...options,
                headers
            });
        }
        
        // In production, attempt direct fetch
        return fetch(url, options);
    }
}
