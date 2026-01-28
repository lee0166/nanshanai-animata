import { Job, JobStatus, Asset, CharacterAsset, GeneratedImage, AssetType, FragmentAsset } from '../types';
import { storageService } from './storage';
import { VIDEO_EXTENSIONS } from './fileUtils';
import { aiService } from './aiService';
import { getMediaMetadata } from './metadata';

type JobUpdateCallback = (job: Job) => void;

export class JobQueue {
  private processingCount = 0;
  private inFlightIds = new Set<string>();
  private listeners: JobUpdateCallback[] = [];

  subscribe(callback: JobUpdateCallback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  hasActiveJobs(): boolean {
      return this.processingCount > 0 || this.inFlightIds.size > 0;
  }

  private notify(job: Job) {
    this.listeners.forEach(cb => cb(job));
  }

  async addJob(job: Job) {
    await storageService.saveJob(job);
    this.notify(job);
    this.processQueue();
  }

  async addJobs(jobs: Job[]) {
    if (jobs.length === 0) return;
    await storageService.saveJobs(jobs);
    jobs.forEach(job => this.notify(job));
    this.processQueue();
  }

  async loadQueue() {
    this.processQueue();
  }

  private async updateAssetWithResult(job: Job, resultPaths: string[]) {
    const projectId = job.params.projectId || job.projectId;
    if (!job.params.assetId || !projectId) {
      console.warn('[Queue] Missing assetId or projectId for asset update', job.params);
      return;
    }
    if (resultPaths.length === 0) {
      console.warn('[Queue] No result paths to update asset');
      return;
    }

    try {
      console.log(`[Queue] Updating asset ${job.params.assetId} with ${resultPaths.length} images. Project: ${projectId}`);
      
      await storageService.updateAsset(job.params.assetId, projectId, async (asset) => {
        console.log(`[Queue] Current asset state: type=${asset.type}, images=${(asset as CharacterAsset).generatedImages?.length || 0}`);

        if (job.type === 'generate_image') {
          const charAsset = asset as CharacterAsset;
          // Use userPrompt if available, otherwise fallback to prompt
          const finalPrompt = job.params.userPrompt || job.params.prompt || ""; 

          const newImages: GeneratedImage[] = await Promise.all(resultPaths.map(async path => {
            // Robust ID generation
            const uuid = typeof crypto.randomUUID === 'function' 
                ? crypto.randomUUID() 
                : Math.random().toString(36).substring(2) + Date.now().toString(36);
            
            let metadata = {};
            try {
               metadata = await getMediaMetadata(path);
            } catch (e) {
               console.warn(`[Queue] Failed to extract metadata for ${path}`, e);
            }

            return {
              id: uuid,
              path: path,
              prompt: finalPrompt, 
              userPrompt: job.params.userPrompt,
              modelConfigId: job.params.model,
              modelId: job.params.modelId || job.params.model,
              createdAt: Date.now(),
              referenceImages: job.params.referenceImages,
              ...metadata,
              metadata: {
                aspectRatio: job.params.aspectRatio,
                resolution: job.params.resolution,
                fullPrompt: job.params.prompt,
                style: job.params.style,
                generateCount: job.params.generateCount,
                guidanceScale: job.params.guidanceScale
              }
            };
          }));

          if (!charAsset.generatedImages) charAsset.generatedImages = [];
          const oldCount = charAsset.generatedImages.length;
          charAsset.generatedImages.push(...newImages);
          
          // Update current image to the last one
          const latestImage = newImages[newImages.length - 1];
          charAsset.filePath = latestImage.path;
          charAsset.currentImageId = latestImage.id;
          
          // Preserve user prompt if available
          if (job.params.userPrompt) {
            charAsset.prompt = job.params.userPrompt;
          } else if (!charAsset.prompt) {
             charAsset.prompt = "";
          }
          
          console.log(`[Queue] Saving asset ${charAsset.id}. Old count: ${oldCount}, New count: ${charAsset.generatedImages.length}`);
          return charAsset;
          
        } else if (job.type === 'generate_video') {
          // Extract metadata for the generated video
          let metadata = {};
          try {
            metadata = await getMediaMetadata(resultPaths[0]);
          } catch (e) {
            console.warn(`[Queue] Failed to extract metadata for video ${resultPaths[0]}`, e);
          }

          // If it's a video segment (fragment), add to its videos array
          if (job.params.assetType === AssetType.VIDEO_SEGMENT) {
            const fragmentAsset = asset as FragmentAsset;
            if (!fragmentAsset.videos) fragmentAsset.videos = [];
            
            const uuid = typeof crypto.randomUUID === 'function' 
                ? crypto.randomUUID() 
                : Math.random().toString(36).substring(2) + Date.now().toString(36);

            const newVideo = {
              id: uuid,
              name: job.params.assetName,
              path: resultPaths[0],
              prompt: job.params.prompt || "",
              userPrompt: job.params.userPrompt,
              modelConfigId: job.params.model,
              modelId: job.params.modelId || job.params.model,
              createdAt: Date.now(),
              params: job.params, // Store all params for sync
              ...metadata
            };
            
            fragmentAsset.videos.push(newVideo);
            fragmentAsset.filePath = newVideo.path;
            fragmentAsset.currentVideoId = newVideo.id;
          } else {
            // Standard asset update
            asset.filePath = resultPaths[0];
            asset.metadata = {
              ...asset.metadata,
              ...metadata,
              modelId: job.params.modelId || job.params.model,
              style: job.params.style
            };
          }

          asset.updatedAt = Date.now();
          console.log(`[Queue] Updated asset ${asset.id} with new video: ${resultPaths[0]}`);
          return asset;
        }
        
        return asset;
      });
    } catch (e) {
      console.error('[Queue] Failed to update asset with result:', e);
      throw e;
    }
  }

  private async processQueue() {
    const settings = await storageService.loadSettings();
    const maxJobs = settings?.maxConcurrentJobs || 3;
    // Enforce minimum polling interval of 2 seconds to prevent loops
    const pollInterval = Math.max(2000, settings?.pollingInterval || 5000);

    // Get all active jobs (PROCESSING)
    const activeJobs = await storageService.getJobs().then(jobs => jobs.filter(j => j.status === JobStatus.PROCESSING));
    this.processingCount = activeJobs.length;

    // If we are already running max jobs, just schedule next check
    if (this.processingCount >= maxJobs) {
      setTimeout(() => this.processQueue(), pollInterval);
      return;
    }

    try {
      const allJobs = await storageService.getJobs();

    // Check for stale jobs (PROCESSING in storage but not in memory)
     // This handles cases where the app crashed or a job failed to save its completion status
     const staleJobs = allJobs.filter(j => j.status === JobStatus.PROCESSING && !this.inFlightIds.has(j.id));
     if (staleJobs.length > 0) {
             console.log(`[Queue] Found ${staleJobs.length} stale PROCESSING jobs (not in memory). Handling recovery...`);
             
             for (const job of staleJobs) {
                 if (job.type === 'generate_image') {
                     const projectId = job.params.projectId || job.projectId;
                     const assetId = job.params.assetId;
                     const modelConfigId = job.params.modelConfigId || job.params.model;
                     const expectedCount = Number(job.params.generateCount) || 1;
                     
                     if (assetId && projectId) {
                         try {
                             const asset: any = await storageService.getAsset(assetId, projectId);
                             const generatedImages: any[] | undefined = asset?.generatedImages;
                             
                             if (Array.isArray(generatedImages) && generatedImages.length > 0) {
                                 const candidates = generatedImages
                                     .filter(img => img && typeof img.path === 'string' && typeof img.createdAt === 'number')
                                     .filter(img => img.createdAt >= job.createdAt)
                                     .filter(img => !modelConfigId || img.modelConfigId === modelConfigId)
                                     .sort((a, b) => a.createdAt - b.createdAt);
                                 
                                 if (candidates.length > 0) {
                                     const picked = candidates.slice(-expectedCount);
                                     job.result = picked.length > 1 ? { paths: picked.map(i => i.path) } : { path: picked[0].path };
                                     job.status = JobStatus.COMPLETED;
                                     job.updatedAt = Date.now();
                                     job.error = undefined;
                                     await storageService.saveJob(job);
                                     this.notify(job);
                                     continue;
                                 }
                             }
                        } catch {
                        }
                     }
                     
                     job.status = JobStatus.PENDING;
                     job.updatedAt = Date.now();
                     job.error = undefined;
                     await storageService.saveJob(job);
                     this.notify(job);
                 } else if (job.type === 'generate_video') {
                     // For video generation, check if we have a taskId to resume polling
                     if (job.params.taskId) {
                         console.log(`[Queue] Resuming stale video job ${job.id} with taskId: ${job.params.taskId}`);
                         // We don't change status, just execute (which handles resume)
                         // But we need to ensure executeJob doesn't re-submit.
                         // Actually executeJob calls aiService.generateVideo.
                         // We need to make sure executeJob handles resumption if taskId is present.
                         // Add it to inFlightIds immediately to prevent double processing in next loop
                         // this.executeJob(job); // This is async
                         
                         // BUT: executeJob checks inFlightIds.
                         // Let's just reset inFlightIds? No, we need to call executeJob.
                         this.executeJob(job);
                     } else {
                         // No taskId yet, so it failed before submission completed
                         console.log(`[Queue] Marking stale video job ${job.id} (no taskId) as FAILED.`);
                         job.status = JobStatus.FAILED;
                         job.error = "Task interrupted before submission";
                         job.updatedAt = Date.now();
                         await storageService.saveJob(job);
                         this.notify(job);
                     }
                 }
             }
             
             // Re-fetch active jobs count after reset/resume
             // Note: executeJob is async, so processingCount might lag slightly, but that's fine for next loop
             const activeJobs = await storageService.getJobs().then(jobs => jobs.filter(j => j.status === JobStatus.PROCESSING));
             this.processingCount = activeJobs.length;
     }
      
      // Get PENDING jobs
      const pendingJobs = allJobs
        .filter(j => j.status === JobStatus.PENDING && !this.inFlightIds.has(j.id))
        .sort((a, b) => a.createdAt - b.createdAt);

      if (pendingJobs.length > 0 || this.processingCount > 0) {
          console.log(`[Queue] Status: ${this.processingCount}/${maxJobs} active. Found ${pendingJobs.length} pending jobs.`);
      }

      if (pendingJobs.length === 0) {
        // No pending jobs, check again later
        setTimeout(() => this.processQueue(), pollInterval);
        return;
      }

      // Start as many jobs as we can
      const slotsAvailable = maxJobs - this.processingCount;
      const jobsToStart = pendingJobs.slice(0, slotsAvailable);

      if (jobsToStart.length > 0) {
        // Use Promise.all to start them concurrently but don't await their completion here
        jobsToStart.forEach(job => this.executeJob(job));
      }

      // Schedule next check immediately if we still have pending jobs and slots, otherwise interval
      // Wait, if we just started jobs, we don't need to check immediately unless we didn't fill slots?
      // Actually, better to check again after a short delay to ensure state updates
      setTimeout(() => this.processQueue(), jobsToStart.length > 0 ? 1000 : pollInterval);

    } catch (e) {
      console.error("[Queue] Loop error:", e);
      setTimeout(() => this.processQueue(), pollInterval);
    }
  }

  private async executeJob(currentJob: Job) {
    if (this.inFlightIds.has(currentJob.id)) return;
    
    this.inFlightIds.add(currentJob.id);
    this.processingCount++;
    console.log(`[Queue] STARTING job ${currentJob.id} (${currentJob.type}). Active: ${this.processingCount}`);

    try {
        // Mark as processing
        if (currentJob.status !== JobStatus.PROCESSING) {
            const claimed = await storageService.claimJob(currentJob.id);
            if (!claimed) {
                 console.log(`[Queue] Failed to claim job ${currentJob.id} (already taken/processed)`);
                 this.inFlightIds.delete(currentJob.id);
                 this.processingCount--;
                 return;
            }

            currentJob.status = JobStatus.PROCESSING;
            currentJob.updatedAt = Date.now();
            // No need to saveJob again as claimJob did it
            this.notify(currentJob);
        }

        if (currentJob.type === 'generate_image') {
           console.log(`[Queue] Calling aiService.generateImage for job ${currentJob.id}`);
           const referenceImages = currentJob.params.referenceImages || [];
           const generateCount = currentJob.params.generateCount || 1;
           const guidanceScale = currentJob.params.guidanceScale;
           
           // Use modelConfigId if available, otherwise fallback to model
           const modelConfigId = currentJob.params.modelConfigId || currentJob.params.model;

           const result = await aiService.generateImage(
             currentJob.params.prompt, 
             modelConfigId, 
             referenceImages,
             currentJob.params.aspectRatio,
             currentJob.params.resolution,
             generateCount,
             guidanceScale,
             { ...currentJob.params.extraParams, style: currentJob.params.style }
           );
           
           if (!result.success || !result.data) {
                throw new Error(result.error || "Image generation failed");
           }

           // Handle array or single object result
           const results = Array.isArray(result.data) ? result.data : [result.data];
           const savedPaths: string[] = [];

           if (results.length === 0) {
               throw new Error("No image data returned");
           }

           for (const item of results) {
               console.log(`[Queue] Processing item keys: ${Object.keys(item).join(',')}`);
               let blob: Blob;
               let ext = 'png';

               if (item.base64) {
                   const base64Data = item.base64;
                   
                   // Detect MIME type
                   let mime = 'image/png';
                   if (base64Data.startsWith('/9j/')) { mime = 'image/jpeg'; ext = 'jpg'; }
                   else if (base64Data.startsWith('iVBORw0KGgo')) { mime = 'image/png'; ext = 'png'; }
                   else if (base64Data.startsWith('R0lGOD')) { mime = 'image/gif'; ext = 'gif'; }
                   else if (base64Data.startsWith('UklGR')) { mime = 'image/webp'; ext = 'webp'; }

                   // Convert base64 to Blob directly (more robust than fetch data URI)
                   const cleanBase64 = base64Data.startsWith('data:') ? base64Data.split(',')[1] : base64Data;
                   const binaryStr = atob(cleanBase64);
                   const bytes = new Uint8Array(binaryStr.length);
                   for (let i = 0; i < binaryStr.length; i++) {
                       bytes[i] = binaryStr.charCodeAt(i);
                   }
                   blob = new Blob([bytes], { type: mime });
               } else if (item.url) {
                   console.log(`[Queue] Downloading generated image from: ${item.url}`);
                   
                   // Try to guess extension from URL
                   if (item.url.match(/\.jpg|\.jpeg/i)) ext = 'jpg';
                   else if (item.url.match(/\.webp/i)) ext = 'webp';

                   try {
                       const proxyUrl = `/api/proxy?url=${encodeURIComponent(item.url)}`;
                       const res = await fetch(proxyUrl);
                       if (!res.ok) throw new Error(`Proxy fetch failed: ${res.statusText}`);
                       blob = await res.blob();
                   } catch (proxyError: any) {
                       console.error('[Queue] Proxy fetch failed:', proxyError);
                       try {
                           console.log('[Queue] Proxy failed, trying direct fetch...');
                           const res = await fetch(item.url);
                           if (!res.ok) throw new Error(`Direct fetch failed: ${res.statusText}`);
                           blob = await res.blob();
                       } catch (directError: any) {
                           throw new Error(`Failed to download image: ${proxyError.message}`);
                       }
                   }
                   
                   // Update extension based on actual blob type
                   if (blob.type === 'image/jpeg') ext = 'jpg';
                   else if (blob.type === 'image/webp') ext = 'webp';
               } else {
                   continue; // Skip invalid
               }
               
               const timestamp = Date.now();
               const random = Math.random().toString(36).substring(2, 8);
               const typeDir = currentJob.params.assetType || 'images';
               let safeAssetName = (currentJob.params.assetName || 'default').replace(/[^a-zA-Z0-9\u4e00-\u9fa5_\-]/g, '_');
               if (!safeAssetName || safeAssetName.length === 0) safeAssetName = 'default';
               if (safeAssetName.length > 50) safeAssetName = safeAssetName.substring(0, 50);
               const filename = `${timestamp}_${random}.${ext}`;
               const path = `generated/${typeDir}/${safeAssetName}/${filename}`;
               
               console.log(`[Queue] Saving generated image to: ${path}`);
               await storageService.saveBinaryFile(path, blob!);
               
               // Update asset data - MOVED to after loop to prevent race conditions
               // await this.updateAssetWithResult(currentJob, path);
               savedPaths.push(path);
           }
           
           if (savedPaths.length === 0) {
                throw new Error("Failed to save any images");
           }

           // Batch update asset with all results
           await this.updateAssetWithResult(currentJob, savedPaths);

           // Inject local paths into meta for display
           const finalMeta = { ...result.meta };
           if (finalMeta.data && Array.isArray(finalMeta.data)) {
               finalMeta.data = finalMeta.data.map((item: any, index: number) => {
                   if (savedPaths[index]) {
                       return { ...item, b64_json: undefined, local_path: savedPaths[index] };
                   }
                   return item;
               });
           }

           currentJob.result = { paths: savedPaths, path: savedPaths[0], meta: finalMeta };
           currentJob.status = JobStatus.COMPLETED;
           
           // Notify UI listeners (important for CharacterDetail to reload)
           this.notify(currentJob);

        } 
        else if (currentJob.type === 'generate_video') {
            console.log(`[Queue] Calling aiService.generateVideo for job ${currentJob.id}`);
            
            const existingTaskId = currentJob.params.taskId;

            // Merge top-level params into extraParams for the provider
            const mergedExtraParams = {
                ...currentJob.params.extraParams,
                duration: currentJob.params.duration,
                ratio: currentJob.params.ratio,
                aspectRatio: currentJob.params.ratio, // ensure compatibility
                resolution: currentJob.params.resolution,
                referenceImages: currentJob.params.referenceImages
            };
            
            const result = await aiService.generateVideo(
                currentJob.params.prompt, 
                currentJob.params.model, 
                currentJob.params.startImage, 
                currentJob.params.endImage,
                existingTaskId,
                async (taskId) => {
                    console.log(`[Queue] Job ${currentJob.id} received taskId: ${taskId}`);
                    currentJob.params.taskId = taskId;
                    currentJob.updatedAt = Date.now();
                    await storageService.saveJob(currentJob);
                    this.notify(currentJob);
                },
                mergedExtraParams
            );
            
            if (!result.success || !result.data) {
                throw new Error(result.error || "Video generation failed");
            }

            const videoUri = result.data.videoUri;
            if (!videoUri) throw new Error("No video URI returned");
            
            console.log(`[Queue] Downloading generated video from: ${videoUri}`);
            
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 8);
            const typeDir = currentJob.params.assetType || 'videos';
            let safeAssetName = (currentJob.params.assetName || 'default').replace(/[^a-zA-Z0-9\u4e00-\u9fa5_\-]/g, '_');
            if (!safeAssetName || safeAssetName.length === 0) safeAssetName = 'default';
            if (safeAssetName.length > 50) safeAssetName = safeAssetName.substring(0, 50);
            const filename = `${timestamp}_${random}.${VIDEO_EXTENSIONS[0]}`;
            const path = `generated/${typeDir}/${safeAssetName}/${filename}`;

            let blob: Blob;
            try {
                const videoRes = await fetch(videoUri);
                if (!videoRes.ok) throw new Error("Failed to download generated video");
                blob = await videoRes.blob();
            } catch (e) {
                console.log('[Queue] Direct video fetch failed, trying proxy...');
                const proxyUrl = `/api/proxy?url=${encodeURIComponent(videoUri)}`;
                const videoRes = await fetch(proxyUrl);
                if (!videoRes.ok) throw new Error("Failed to download generated video via proxy");
                blob = await videoRes.blob();
            }
            
            console.log(`[Queue] Saving generated video to: ${path}`);
            await storageService.saveBinaryFile(path, blob);

            // Update asset data
            await this.updateAssetWithResult(currentJob, [path]);

            currentJob.result = { path };
            currentJob.status = JobStatus.COMPLETED;
        }
    } catch (err: any) {
        console.error(`[Queue] Job ${currentJob.id} failed:`, err);
        currentJob.status = JobStatus.FAILED;
        currentJob.error = err.message || "Unknown error";
    } finally {
        try {
            currentJob.updatedAt = Date.now();
            await storageService.saveJob(currentJob);
            this.notify(currentJob);
        } catch (saveError) {
            console.error(`[Queue] Failed to save job ${currentJob.id} status in finally block:`, saveError);
        }
        
        this.inFlightIds.delete(currentJob.id);
        this.processingCount--;
        // Trigger queue check to pick up next job if any
        this.processQueue();
    }
  }
}

export const jobQueue = new JobQueue();
