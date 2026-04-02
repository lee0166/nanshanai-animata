import {
  Project,
  Asset,
  Job,
  AppSettings,
  JobStatus,
  AssetType,
  CharacterAsset,
  SceneAsset,
  ItemAsset,
  VideoSegment,
  Script,
} from '../types';
import { DEFAULT_SETTINGS } from '../config/settings';
import { DEFAULT_MODELS, COMMON_IMAGE_PARAMS, COMMON_VOLC_VIDEO_PARAMS } from '../config/models';
import { extractMp4Fps } from './metadata';
import { VIDEO_EXTENSIONS, IMAGE_EXTENSIONS, isVideoFile, getFileType } from './fileUtils';
import { createMultiLayerCache, MultiLayerCache } from './cache/MultiLayerCache';

// Helper to serialize/deserialize data
const IDB_KEY_DIR_HANDLE = 'avss_dir_handle';
const DB_NAME = 'ai_video_shorts_db';
const STORE_NAME = 'handles';

export interface ResourceItem {
  id: string;
  path: string;
  type: 'image' | 'video';
  source: 'generated' | 'imported';
  sourceAssetId?: string; // If generated, the Asset ID it belongs to
  sourceAssetType?: AssetType;
  sourceAssetName?: string;
  metadata?: {
    width?: number;
    height?: number;
    size?: number;
    duration?: number;
    fps?: number;
    modelId?: string;
    fileType?: string;
  };
  prompt?: string;
  generationParams?: any;
  createdAt: number;
}

export class StorageService {
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private useOpfs: boolean = false;
  private isFsResponsive: boolean = true; // Circuit breaker flag
  private locks: Map<string, Promise<void>> = new Map();
  private cache: MultiLayerCache;

  // 内存缓存层 - 减少文件系统 I/O
  private memoryCache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private readonly DEFAULT_MEMORY_CACHE_TTL = 30 * 1000; // 30秒

  // 快捷缓存键
  private readonly CACHE_KEY_SETTINGS = 'settings';
  private readonly CACHE_KEY_JOBS = 'jobs_queue';
  private readonly CACHE_KEY_ASSETS_PREFIX = 'assets_';
  private readonly CACHE_KEY_SCRIPTS_PREFIX = 'scripts_';

  constructor() {
    // 初始化多层缓存（settings 缓存 5 分钟）
    this.cache = createMultiLayerCache({
      enableL1: true,
      enableL2: true,
      defaultTTL: 5 * 60 * 1000, // 5 分钟
      maxL1Items: 100,
    });
  }

  // 内存缓存辅助方法
  private getMemoryCache<T>(key: string): T | null {
    const cached = this.memoryCache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.memoryCache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  private setMemoryCache<T>(key: string, data: T, ttl?: number): void {
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_MEMORY_CACHE_TTL,
    });
  }

  private invalidateMemoryCache(keyPattern: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.memoryCache.keys()) {
      if (key.includes(keyPattern)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
    }
  }

  private clearMemoryCache(): void {
    this.memoryCache.clear();
  }

  // Simple mutex lock to prevent race conditions on file operations
  private async lock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    let resolveUnlock: () => void;
    const newLock = new Promise<void>(resolve => {
      resolveUnlock = resolve;
    });

    // Get the current lock or a resolved promise
    const currentLock = this.locks.get(key) || Promise.resolve();

    // Update the lock map immediately so next caller waits for us
    this.locks.set(
      key,
      currentLock.then(() => newLock)
    );

    try {
      // Wait for the previous operation to finish (ignoring its success/failure)
      await currentLock.catch(() => {});
      // Execute our function
      return await fn();
    } finally {
      // Release our lock
      resolveUnlock!();
      // Cleanup: if we are the last lock, delete the key
      if (this.locks.get(key) === currentLock.then(() => newLock)) {
        // This check is tricky because promises are objects.
        // Actually we don't strictly need to delete, but it keeps map small.
        // It's hard to compare promise chains safely.
        // Let's just leave it or use a counter.
        // For now, map size is negligible (number of files).
      }
    }
  }

  private async getDB(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return null;
    return new Promise(resolve => {
      // Set a hard timeout for DB opening
      const timeout = setTimeout(() => {
        console.warn('IndexedDB opening timed out.');
        resolve(null);
      }, 1000);

      try {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => {
          clearTimeout(timeout);
          resolve(request.result);
        };
        request.onerror = () => {
          clearTimeout(timeout);
          resolve(null);
        };
      } catch (e) {
        clearTimeout(timeout);
        resolve(null);
      }
    });
  }

  private async saveHandleToIDB(handle: FileSystemDirectoryHandle) {
    try {
      const db = await this.getDB();
      if (!db) return;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(handle, IDB_KEY_DIR_HANDLE);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('Failed to save handle to IDB:', e);
    }
  }

  private async getHandleFromIDB(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const db = await this.getDB();
      if (!db) return null;
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(IDB_KEY_DIR_HANDLE);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn('Failed to get handle from IDB:', e);
      return null;
    }
  }

  async isConnected(): Promise<boolean> {
    if (!this.directoryHandle) return false;
    // Check if we still have permission
    try {
      if (this.useOpfs) return true;

      // Some environments (like Trae preview) might have partially implemented APIs
      if (typeof this.directoryHandle.queryPermission !== 'function') {
        console.log('[STORAGE] queryPermission not supported, assuming connected');
        return true;
      }

      // Add a timeout to queryPermission
      const status = await new Promise<string>(resolve => {
        const t = setTimeout(() => {
          console.warn('[STORAGE] queryPermission timed out (3s).');
          resolve('timeout');
        }, 3000);
        this.directoryHandle!.queryPermission({ mode: 'readwrite' })
          .then(s => {
            clearTimeout(t);
            resolve(s);
          })
          .catch(e => {
            clearTimeout(t);
            console.warn('[STORAGE] queryPermission error:', e);
            resolve('denied');
          });
      });

      if (status === 'granted') return true;
      if (status === 'prompt') return false; // Needs requestPermission

      // If it's a timeout or denied, let's try a "real" operation as a fallback
      // because queryPermission can be buggy in some browsers
      console.log(`[STORAGE] queryPermission returned ${status}, trying fallback entries check...`);

      return await new Promise<boolean>(async resolve => {
        const t = setTimeout(() => {
          console.warn('[STORAGE] entries check timed out (3s).');
          resolve(false);
        }, 3000);
        try {
          const iter = this.directoryHandle!.entries();
          await iter.next();
          clearTimeout(t);
          console.log('[STORAGE] entries check successful');
          resolve(true);
        } catch (e) {
          clearTimeout(t);
          console.warn('[STORAGE] entries check failed:', e);
          resolve(false);
        }
      });
    } catch (e) {
      console.error('[STORAGE] isConnected unexpected error:', e);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    return this.resetWorkspace();
  }

  async resetWorkspace(): Promise<void> {
    console.log('[STORAGE] Resetting workspace...');
    this.directoryHandle = null;
    this.useOpfs = false;
    this.isFsResponsive = true;

    // Also clear useSandbox setting
    localStorage.removeItem('avss_use_sandbox');

    // Clear IDB
    try {
      const db = await this.getDB();
      if (db) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        // Delete specifically the handle
        await new Promise((resolve, reject) => {
          const req = store.delete(IDB_KEY_DIR_HANDLE);
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        });
        console.log('[STORAGE] IDB handle cleared.');
      }
    } catch (e) {
      console.warn('Failed to clear IDB handle:', e);
    }
  }

  isBrowserSupported(): boolean {
    return (
      typeof window.showDirectoryPicker === 'function' ||
      (typeof navigator.storage !== 'undefined' &&
        typeof navigator.storage.getDirectory === 'function')
    );
  }

  async getWorkspaceName(): Promise<string> {
    return this.directoryHandle?.name || '';
  }

  async getAllResources(projectId: string): Promise<ResourceItem[]> {
    const assets = await this.getAssets(projectId);
    const resources: ResourceItem[] = [];

    for (const asset of assets) {
      // 1. Imported Resources (AssetType.IMAGE / VIDEO)
      if (asset.type === AssetType.IMAGE || asset.type === AssetType.VIDEO) {
        if (asset.filePath) {
          resources.push({
            id: asset.id,
            path: asset.filePath,
            type: asset.type === AssetType.VIDEO ? 'video' : 'image',
            source: 'imported',
            sourceAssetId: asset.id,
            sourceAssetType: asset.type,
            sourceAssetName: asset.name,
            createdAt: asset.createdAt,
            metadata: {
              width: asset.metadata?.width,
              height: asset.metadata?.height,
              size: asset.metadata?.size,
              duration: asset.metadata?.duration,
              fps: asset.metadata?.fps,
              fileType: asset.metadata?.fileType || asset.filePath?.split('.').pop()?.toLowerCase(),
            },
          });
        }
      }

      // 2. Generated Resources (in Character/Scene/Item/VideoSegment)
      // Check generatedImages
      const genAsset = asset as CharacterAsset | SceneAsset | ItemAsset;
      if (genAsset.generatedImages && genAsset.generatedImages.length > 0) {
        for (const img of genAsset.generatedImages) {
          resources.push({
            id: img.id,
            path: img.path,
            type: getFileType(img.path) === 'video' ? 'video' : 'image', // Use utility check
            source: 'generated',
            sourceAssetId: asset.id,
            sourceAssetType: asset.type,
            sourceAssetName: asset.name,
            createdAt: img.createdAt,
            metadata: {
              width: img.width,
              height: img.height,
              size: img.size,
              duration: img.duration,
              fps: img.metadata?.fps,
              modelId: img.modelId,
              fileType: img.path.split('.').pop()?.toLowerCase(),
            },
            prompt: img.prompt,
            generationParams: img.metadata,
          });
        }
      }

      // Check VideoSegment result (filePath)
      if (asset.type === AssetType.VIDEO_SEGMENT) {
        if (asset.filePath) {
          // If it's not in generatedImages (Video generation usually just sets filePath)
          // Check if we already added it (unlikely unless duplicates)
          const exists = resources.some(r => r.path === asset.filePath);
          if (!exists) {
            resources.push({
              id: asset.id + '_video',
              path: asset.filePath,
              type: 'video',
              source: 'generated',
              sourceAssetId: asset.id,
              sourceAssetType: asset.type,
              sourceAssetName: asset.name,
              createdAt: asset.updatedAt,
              metadata: {
                width: asset.metadata?.width,
                height: asset.metadata?.height,
                size: asset.metadata?.size,
                duration: asset.metadata?.duration,
                fps: asset.metadata?.fps,
                modelId: asset.metadata?.modelId,
                fileType: VIDEO_EXTENSIONS[0],
              },
              prompt: asset.prompt,
              generationParams: asset.metadata,
            });
          }
        }
      }
    }

    return resources.sort((a, b) => b.createdAt - a.createdAt);
  }

  async importResource(projectId: string): Promise<void> {
    if (!this.directoryHandle) throw new Error('Workspace not connected');

    // 1. Pick file
    let fileHandle: FileSystemFileHandle;
    try {
      [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Images & Videos',
            accept: {
              'image/*': IMAGE_EXTENSIONS.map(e => `.${e}`) as `.${string}`[],
              'video/*': VIDEO_EXTENSIONS.map(e => `.${e}`) as `.${string}`[],
            },
          },
        ],
        multiple: false,
      });
    } catch (e) {
      return; // Cancelled
    }

    const file = await fileHandle.getFile();
    const isVideo = file.type.startsWith('video/');
    const ext = file.name.split('.').pop() || (isVideo ? VIDEO_EXTENSIONS[0] : IMAGE_EXTENSIONS[0]);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const newFileName = `${timestamp}_${random}.${ext}`;
    const targetPath = `imported/${newFileName}`;

    // 2. Read and get dimensions
    let width = 0;
    let height = 0;
    let duration = 0;
    let fps: number | undefined;

    try {
      if (isVideo) {
        // Try to extract FPS first if it's MP4
        if (file.type === 'video/mp4') {
          try {
            console.log('[Storage] Attempting to extract FPS from MP4 file...');
            fps = await extractMp4Fps(file);
            console.log('[Storage] FPS extraction result:', fps);
          } catch (e) {
            console.warn('Failed to extract FPS from imported MP4', e);
          }
        }

        // For video, we need to create a temporary video element
        const url = URL.createObjectURL(file);
        await new Promise<void>(resolve => {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.onloadedmetadata = () => {
            width = video.videoWidth;
            height = video.videoHeight;
            duration = video.duration;
            URL.revokeObjectURL(url);
            resolve();
          };
          video.onerror = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          video.src = url;
        });
      } else {
        // For image
        const bitmap = await createImageBitmap(file);
        width = bitmap.width;
        height = bitmap.height;
        bitmap.close();
      }
    } catch (e) {
      console.warn('Failed to extract metadata from imported file', e);
    }

    // 3. Save file
    await this.saveBinaryFile(targetPath, file);

    // 4. Create Asset
    const newAsset: Asset = {
      id: crypto.randomUUID(),
      projectId,
      type: isVideo ? AssetType.VIDEO : AssetType.IMAGE,
      name: file.name,
      prompt: '',
      filePath: targetPath,
      category: 'imported',
      metadata: {
        width,
        height,
        size: file.size,
        duration: isVideo ? duration : undefined,
        fps: fps,
        fileType: ext.toLowerCase(),
        originalName: file.name,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.saveAsset(newAsset);
  }

  async deleteJob(jobId: string): Promise<void> {
    if (!this.directoryHandle) return;
    try {
      return this.lock('jobs_queue.json', async () => {
        const jobs = await this.getJobs();
        const filtered = jobs.filter(j => j.id !== jobId);
        await this.writeJson('jobs_queue.json', filtered);
      });
    } catch (e) {
      console.error('Failed to delete job:', e);
      throw e;
    }
  }

  // Auto-connect to previously saved directory
  async autoConnect(): Promise<boolean> {
    if (this.directoryHandle) return true;

    const handle = await this.getHandleFromIDB();
    if (!handle) return false;

    // Check if this handle is actually OPFS (Fix for phantom workspace bug)
    let isOpfsHandle = false;
    try {
      if (navigator.storage && navigator.storage.getDirectory) {
        const opfsRoot = await navigator.storage.getDirectory();
        if (await handle.isSameEntry(opfsRoot)) {
          console.warn('[STORAGE] Detected OPFS handle in IDB. Marking as sandbox.');
          isOpfsHandle = true;
        }
      }
    } catch (e) {
      console.warn('[STORAGE] Failed to check OPFS identity:', e);
    }

    this.directoryHandle = handle;
    this.useOpfs = isOpfsHandle;
    this.isFsResponsive = true;

    // Verify permission
    const granted = await this.isConnected();
    if (!granted) {
      // Permission lost (e.g., after browser restart)
      // Note: We keep the handle so we can request permission later with user gesture
      console.log('[STORAGE] Permission not granted, keeping handle for later request');
      return false;
    }

    return true;
  }

  /**
   * Check if there's a previous workspace selection (but may need permission)
   */
  async hasPreviousWorkspace(): Promise<boolean> {
    const handle = await this.getHandleFromIDB();
    return !!handle;
  }

  /**
   * Request permission for the existing handle
   * Must be called with user gesture (e.g., button click)
   */
  async requestPermissionForExisting(): Promise<boolean> {
    if (!this.directoryHandle) {
      // Try to restore handle from IDB
      const connected = await this.autoConnect();
      return connected;
    }

    try {
      const status = await this.directoryHandle.requestPermission({ mode: 'readwrite' });
      if (status === 'granted') {
        console.log('[STORAGE] Permission granted for existing workspace');
        return true;
      }
      return false;
    } catch (e) {
      console.error('[STORAGE] Permission request failed:', e);
      return false;
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!this.directoryHandle) return false;
    try {
      const status = await this.directoryHandle.requestPermission({ mode: 'readwrite' });
      return status === 'granted';
    } catch (e) {
      console.error('Permission request failed:', e);
      return false;
    }
  }

  private async requestNewHandle(): Promise<boolean> {
    if (typeof window.showDirectoryPicker !== 'function') {
      throw new Error('showDirectoryPicker not supported');
    }

    console.log('[STORAGE] Triggering showDirectoryPicker...');
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
    });
    console.log('[STORAGE] Directory picker success:', handle.name);

    if (handle.kind !== 'directory') {
      const settings = await this.loadSettings();
      const msg =
        settings?.language === 'zh'
          ? '请选择一个文件夹，而不是文件。'
          : 'Please select a folder, not a file.';
      throw new Error(msg);
    }

    this.directoryHandle = handle;
    this.useOpfs = false;
    this.isFsResponsive = true;

    // Clear existing handle first to avoid state corruption if write fails
    try {
      const db = await this.getDB();
      if (db) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(IDB_KEY_DIR_HANDLE);
        await new Promise(r => {
          tx.oncomplete = r;
          tx.onerror = r;
        });
      }
    } catch (e) {}

    await this.saveHandleToIDB(handle);
    return true;
  }

  async connect(forcePicker = false): Promise<boolean> {
    const previousHandle = this.directoryHandle;
    const previousUseOpfs = this.useOpfs;

    try {
      // 1. If forcePicker is requested, always show picker
      if (forcePicker) {
        return await this.requestNewHandle();
      }

      // 2. Check for Sandbox Mode first (no permission needed)
      const useSandbox = localStorage.getItem('avss_use_sandbox') === 'true';
      if (useSandbox) {
        console.log('[STORAGE] Bootstrapping with Sandbox Mode...');
        return await this.switchToSandbox();
      }

      // Reset responsiveness when manually connecting
      this.isFsResponsive = true;

      // If we already have a handle (from autoConnect), just request permission
      if (this.directoryHandle && !this.useOpfs) {
        const granted = await this.requestPermission();
        if (granted) return true;
      }

      // Otherwise, show the picker
      return await this.requestNewHandle();
    } catch (e: any) {
      // If user cancelled, stay on current workspace
      if (e.name === 'AbortError') {
        console.log('User cancelled directory picker. Keeping current workspace.');
        this.directoryHandle = previousHandle;
        this.useOpfs = previousUseOpfs;
        return !!this.directoryHandle;
      }

      console.warn('Connect failed:', e);

      // If we had a handle before, keep it
      if (previousHandle) {
        this.directoryHandle = previousHandle;
        this.useOpfs = previousUseOpfs;
        return true;
      }

      // Fallback to Origin Private File System (OPFS) if blocked and no previous handle
      if (navigator.storage && navigator.storage.getDirectory) {
        try {
          console.log('Attempting fallback to OPFS...');
          const root = await navigator.storage.getDirectory();
          this.directoryHandle = root;
          this.useOpfs = true;
          return true;
        } catch (opfsError) {
          console.error('OPFS fallback failed:', opfsError);
        }
      }

      return false;
    }
  }

  // --- Generic File Operations ---

  private async getFileHandle(
    filename: string,
    create = false
  ): Promise<FileSystemFileHandle | null> {
    if (!this.directoryHandle) throw new Error('Workspace not connected');
    try {
      // console.log(`[STORAGE] getFileHandle: ${filename} (create: ${create})`);
      return await this.directoryHandle.getFileHandle(filename, { create });
    } catch (e) {
      // console.warn(`[STORAGE] getFileHandle failed for ${filename}:`, e);
      return null;
    }
  }

  // List all files in the workspace directory
  async listFiles(): Promise<{ name: string; kind: 'file' | 'directory' }[]> {
    if (!this.directoryHandle) return [];

    const files: { name: string; kind: 'file' | 'directory' }[] = [];
    try {
      // @ts-ignore - TypeScript doesn't know about values() method
      for await (const entry of this.directoryHandle.values()) {
        files.push({ name: entry.name, kind: entry.kind });
      }
    } catch (e) {
      console.error('[STORAGE] Failed to list files:', e);
    }
    return files;
  }

  private async writeJson(filename: string, data: any): Promise<void> {
    const start = performance.now();

    // Circuit breaker: if FS is known to be unresponsive, skip it
    if (!this.directoryHandle || !this.isFsResponsive) {
      throw new Error('FileSystem not responsive or not connected');
    }

    const MAX_RETRIES = 3;
    let lastError: any;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await new Promise<void>(async (resolve, reject) => {
          const timeout = setTimeout(() => {
            console.warn(
              `[STORAGE] FileSystem write timeout for ${filename} (5s). Tripping circuit breaker.`
            );
            this.isFsResponsive = false; // Mark as unresponsive
            reject(new Error('FileSystem write timeout'));
          }, 5000);

          try {
            const handle = await this.getFileHandle(filename, true);
            if (handle) {
              const writable = await handle.createWritable();
              await writable.write(JSON.stringify(data, null, 2));
              await writable.close();
              clearTimeout(timeout);
              const duration = performance.now() - start;
              if (duration > 100) {
                console.log(
                  `[STORAGE] Slow FileSystem write: ${filename} took ${duration.toFixed(2)}ms`
                );
              }
              resolve();
            } else {
              clearTimeout(timeout);
              reject(new Error(`Failed to get file handle for ${filename}`));
            }
          } catch (e) {
            clearTimeout(timeout);
            reject(e);
          }
        });
        return; // Success
      } catch (e) {
        lastError = e;
        console.warn(
          `[STORAGE] Write attempt ${attempt + 1}/${MAX_RETRIES} failed for ${filename}:`,
          e
        );
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
        }
      }
    }
    throw lastError;
  }

  private async readJson<T>(filename: string): Promise<T | null> {
    const start = performance.now();

    if (!this.directoryHandle || !this.isFsResponsive) {
      return null;
    }

    return await new Promise<T | null>(async resolve => {
      const timeout = setTimeout(() => {
        console.warn(
          `[STORAGE] FileSystem read timeout for ${filename} (5s). Tripping circuit breaker.`
        );
        this.isFsResponsive = false; // Mark as unresponsive
        resolve(null);
      }, 5000);

      try {
        const handle = await this.getFileHandle(filename);
        if (handle) {
          const file = await handle.getFile();
          const text = await file.text();
          const data = JSON.parse(text) as T;

          clearTimeout(timeout);
          const duration = performance.now() - start;
          // Only log slow reads (>100ms) or in development debug mode
          if (duration > 100) {
            console.log(`[STORAGE] Slow read ${filename}: ${duration.toFixed(2)}ms`);
          }
          resolve(data);
        } else {
          clearTimeout(timeout);
          // Silently return null for missing files - this is normal
          resolve(null);
        }
      } catch (e) {
        clearTimeout(timeout);
        console.error(`[STORAGE] Error reading ${filename}:`, e);
        resolve(null);
      }
    });
  }

  async saveBinaryFile(filePath: string, blob: Blob): Promise<string> {
    if (!this.directoryHandle) throw new Error('Workspace not connected');

    const parts = filePath.split('/');
    const fileName = parts.pop()!;
    let currentDir = this.directoryHandle;

    // Navigate/Create directories
    for (const part of parts) {
      currentDir = await currentDir.getDirectoryHandle(part, { create: true });
    }

    const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    return filePath;
  }

  async saveTextFile(filePath: string, content: string): Promise<string> {
    const blob = new Blob([content], { type: 'text/plain' });
    return this.saveBinaryFile(filePath, blob);
  }

  /**
   * 获取存储项（兼容localStorage风格API）
   * @param key 存储键
   * @returns 存储值或null
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const file = await this.getFile(`${key}.json`);
      if (!file) return null;
      return await file.text();
    } catch (e) {
      console.error(`[STORAGE] Failed to get item ${key}:`, e);
      return null;
    }
  }

  /**
   * 设置存储项（兼容localStorage风格API）
   * @param key 存储键
   * @param value 存储值
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      await this.saveTextFile(`${key}.json`, value);
    } catch (e) {
      console.error(`[STORAGE] Failed to set item ${key}:`, e);
      throw e;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    if (!this.directoryHandle) throw new Error('Workspace not connected');

    try {
      const parts = filePath.split('/');
      const fileName = parts.pop()!;
      let currentDir = this.directoryHandle;

      // Navigate directories
      for (const part of parts) {
        currentDir = await currentDir.getDirectoryHandle(part);
      }

      await currentDir.removeEntry(fileName);
      console.log(`[STORAGE] Deleted file: ${filePath}`);
    } catch (e) {
      console.error(`[STORAGE] Failed to delete file ${filePath}:`, e);
      throw e;
    }
  }

  /**
   * 获取缓存数据
   * @param key 缓存键
   * @returns 缓存数据或null
   */
  async getCache<T>(key: string): Promise<T | null> {
    try {
      const data = await this.getItem(`cache_${key}`);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (e) {
      console.error(`[STORAGE] Failed to get cache ${key}:`, e);
      return null;
    }
  }

  /**
   * 设置缓存数据
   * @param key 缓存键
   * @param value 缓存值
   */
  async setCache<T>(key: string, value: T): Promise<void> {
    try {
      await this.setItem(`cache_${key}`, JSON.stringify(value));
    } catch (e) {
      console.error(`[STORAGE] Failed to set cache ${key}:`, e);
      throw e;
    }
  }

  async getFile(relativePath: string): Promise<File | null> {
    if (!this.directoryHandle || !relativePath) return null;
    try {
      const parts = relativePath.split('/');
      let currentDir = this.directoryHandle;

      // Navigate directories
      for (let i = 0; i < parts.length - 1; i++) {
        currentDir = await currentDir.getDirectoryHandle(parts[i]);
      }

      const fileHandle = await currentDir.getFileHandle(parts[parts.length - 1]);
      return await fileHandle.getFile();
    } catch (e: any) {
      if (e.name === 'NotFoundError' || e.toString().includes('NotFoundError')) {
        console.warn(`[STORAGE] File not found: ${relativePath}`);
      } else {
        console.error('[STORAGE] Error getting file', relativePath, e);
      }
      return null;
    }
  }

  // 音频URL缓存
  private audioUrlCache: Map<string, { url: string; timestamp: number }> = new Map();
  private audioUrlCacheTTL = 10 * 60 * 1000; // 缓存有效期：10分钟

  // 清理过期的音频URL缓存
  private cleanupAudioUrlCache(): void {
    const now = Date.now();
    for (const [key, item] of this.audioUrlCache.entries()) {
      if (now - item.timestamp > this.audioUrlCacheTTL) {
        // 释放ObjectURL以避免内存泄漏
        URL.revokeObjectURL(item.url);
        this.audioUrlCache.delete(key);
      }
    }
  }

  async getAssetUrl(relativePath: string): Promise<string> {
    if (!this.directoryHandle || !relativePath) return '';

    // 清理过期缓存
    this.cleanupAudioUrlCache();

    // 检查缓存
    if (this.audioUrlCache.has(relativePath)) {
      const cached = this.audioUrlCache.get(relativePath);
      if (cached) {
        // console.log('[STORAGE] 从缓存获取音频URL:', relativePath);
        return cached.url;
      }
    }

    try {
      const parts = relativePath.split('/');
      let currentDir = this.directoryHandle;

      // Navigate directories
      for (let i = 0; i < parts.length - 1; i++) {
        currentDir = await currentDir.getDirectoryHandle(parts[i]);
      }

      const fileHandle = await currentDir.getFileHandle(parts[parts.length - 1]);
      const file = await fileHandle.getFile();
      const url = URL.createObjectURL(file);

      // 保存到缓存
      this.audioUrlCache.set(relativePath, {
        url,
        timestamp: Date.now(),
      });

      return url;
    } catch (e: any) {
      // Silently handle NotFoundError as it's common for deleted files
      if (e.name === 'NotFoundError' || e.toString().includes('NotFoundError')) {
        console.warn(`[STORAGE] Asset file not found: ${relativePath}`);
      } else {
        console.error('[STORAGE] Error reading file', relativePath, e);
      }
      return '';
    }
  }

  async isOpfsSupported(): Promise<boolean> {
    return !!(navigator.storage && navigator.storage.getDirectory);
  }

  async switchToSandbox(): Promise<boolean> {
    try {
      console.log('[STORAGE] Switching to Sandbox Mode (OPFS)...');
      const root = await navigator.storage.getDirectory();
      this.directoryHandle = root;
      this.useOpfs = true;
      this.isFsResponsive = true;
      // Do NOT save OPFS handle to IDB as it confuses the autoConnect logic for local folders
      // await this.saveHandleToIDB(root);
      return true;
    } catch (e) {
      console.error('[STORAGE] Sandbox Mode failed:', e);
      return false;
    }
  }

  isOpfs(): boolean {
    return this.useOpfs;
  }

  isResponsive(): boolean {
    return this.isFsResponsive;
  }

  // --- Domain Specifics ---

  async saveSettings(settings: AppSettings): Promise<void> {
    // Save to localStorage too for bootstrap
    try {
      localStorage.setItem('avss_use_sandbox', settings.useSandbox ? 'true' : 'false');
    } catch (e) {}

    // Prune models before saving to keep JSON clean
    const prunedModels = settings.models.map(m => ({
      id: m.id,
      templateId: m.templateId,
      name: m.name,
      provider: m.provider,
      modelId: m.modelId,
      type: m.type,
      apiUrl: m.apiUrl,
      apiKey: m.apiKey,
      isDefault: m.isDefault,
      enabled: m.enabled,
    }));

    const settingsData = { ...settings, models: prunedModels };

    // 写入文件系统
    await this.writeJson('settings.json', settingsData);

    // 更新缓存（同时更新 L1 和 L2）
    await this.cache.set('settings.json', settingsData);

    // 使内存缓存失效
    this.invalidateMemoryCache(this.CACHE_KEY_SETTINGS);

    console.log(`[Storage] Settings saved and cache updated`);
  }

  async loadSettings(): Promise<AppSettings | null> {
    // 优先检查内存缓存
    const cached = this.getMemoryCache<AppSettings>(this.CACHE_KEY_SETTINGS);
    if (cached) {
      return cached;
    }

    // 使用多层缓存
    const settings = await this.cache.get<AppSettings>('settings.json', async () => {
      // L3 加载器：从文件系统读取
      const startTime = Date.now();
      const settings = await this.readJson<AppSettings>('settings.json');
      const loadTime = Date.now() - startTime;

      if (loadTime > 50) {
        console.log(`[Storage] L3 load: settings.json (${loadTime}ms)`);
      }

      if (!settings) {
        // Fallback to sandbox preference from localStorage if file read fails
        try {
          const saved = localStorage.getItem('avss_use_sandbox');
          if (saved === 'true') {
            return { ...DEFAULT_SETTINGS, useSandbox: true };
          }
        } catch (e) {}
        return null;
      }

      // "Rehydrate" models: Merge stored instance data with code-defined ModelConfig
      if (settings.models && Array.isArray(settings.models)) {
        // The AppContext and UI expect full ModelConfig objects at runtime
        (settings as any).models = settings.models.map(instance => {
          // If has templateId, merge with template
          if (instance.templateId) {
            const template = DEFAULT_MODELS.find(dm => dm.id === instance.templateId);
            if (template) {
              return {
                ...template,
                ...instance,
              };
            }
          }

          // Custom model: ensure complete structure
          return {
            ...instance,
            capabilities: { maxBatchSize: 1, supportsReferenceImage: false },
            parameters: instance.type === 'image' ? COMMON_IMAGE_PARAMS : COMMON_VOLC_VIDEO_PARAMS,
          };
        });
      }

      return settings;
    });

    // 设置内存缓存（较长的 TTL，因为 settings 变化不频繁）
    if (settings) {
      this.setMemoryCache(this.CACHE_KEY_SETTINGS, settings, 2 * 60 * 1000);
    }

    return settings;
  }

  async getProjects(): Promise<Project[]> {
    const data = await this.readJson<Project[]>('projects.json');
    return data || [];
  }

  async saveProject(project: Project): Promise<void> {
    return this.lock('projects.json', async () => {
      const projects = await this.getProjects();
      const index = projects.findIndex(p => p.id === project.id);
      if (index >= 0) {
        projects[index] = project;
      } else {
        projects.push(project);
      }
      await this.writeJson('projects.json', projects);
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    return this.lock('projects.json', async () => {
      let projects = await this.getProjects();
      projects = projects.filter(p => p.id !== projectId);
      await this.writeJson('projects.json', projects);
    });
    // Note: In a real app, we should clean up assets too.
  }

  async getAsset(assetId: string, projectId?: string): Promise<Asset | null> {
    if (projectId) {
      const assets = await this.getAssets(projectId);
      return assets.find(a => a.id === assetId) || null;
    }

    // If no projectId, we have to search all assets
    const allAssets = await this.loadAssets();
    return allAssets.find(a => a.id === assetId) || null;
  }

  async getAssets(projectId: string): Promise<Asset[]> {
    const cacheKey = `${this.CACHE_KEY_ASSETS_PREFIX}${projectId}`;
    const cached = this.getMemoryCache<Asset[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await this.readJson<Asset[]>(`assets_${projectId}.json`);
    const result = data || [];
    this.setMemoryCache(cacheKey, result);
    return result;
  }

  async loadAssets(): Promise<Asset[]> {
    if (!this.directoryHandle) return [];

    const assets: Asset[] = [];

    try {
      // @ts-ignore - iterate over directory handle
      for await (const entry of this.directoryHandle.values()) {
        if (
          entry.kind === 'file' &&
          entry.name.endsWith('.json') &&
          entry.name.startsWith('assets_')
        ) {
          const content = await this.readJson<Asset[]>(entry.name);
          if (content && Array.isArray(content)) {
            assets.push(...content);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load assets:', error);
    }

    return assets;
  }

  async updateAsset(
    assetId: string,
    projectId: string,
    updateFn: (asset: Asset) => Asset | Promise<Asset>
  ): Promise<void> {
    const filename = `assets_${projectId}.json`;
    return this.lock(filename, async () => {
      const assets = await this.getAssets(projectId);
      const index = assets.findIndex(a => a.id === assetId);

      if (index === -1) {
        throw new Error(`Asset not found: ${assetId}`);
      }

      // Clone to be safe, though not strictly necessary if we replace the object
      const currentAsset = JSON.parse(JSON.stringify(assets[index]));
      const updatedAsset = await updateFn(currentAsset);

      // Ensure ID matches to prevent accidental swap
      if (updatedAsset.id !== assetId) {
        throw new Error('Asset ID mismatch in update');
      }

      updatedAsset.updatedAt = Date.now();
      assets[index] = updatedAsset;

      await this.writeJson(filename, assets);
      // 使内存缓存失效
      this.invalidateMemoryCache(this.CACHE_KEY_ASSETS_PREFIX);
    });
  }

  async saveAsset(asset: Asset): Promise<void> {
    const filename = `assets_${asset.projectId}.json`;
    const cacheKey = `${this.CACHE_KEY_ASSETS_PREFIX}${asset.projectId}`;
    return this.lock(filename, async () => {
      const assets = await this.getAssets(asset.projectId);
      const index = assets.findIndex(a => a.id === asset.id);

      // Always update the updatedAt timestamp when saving
      asset.updatedAt = Date.now();

      if (index >= 0) {
        assets[index] = asset;
      } else {
        assets.push(asset);
      }
      await this.writeJson(filename, assets);
      // 使内存缓存失效
      this.invalidateMemoryCache(this.CACHE_KEY_ASSETS_PREFIX);
    });
  }

  async deleteAsset(assetId: string, projectId: string): Promise<void> {
    const filename = `assets_${projectId}.json`;
    return this.lock(filename, async () => {
      let assets = await this.getAssets(projectId);
      assets = assets.filter(a => a.id !== assetId);
      await this.writeJson(filename, assets);
      // 使内存缓存失效
      this.invalidateMemoryCache(this.CACHE_KEY_ASSETS_PREFIX);
    });
  }

  async getJobs(): Promise<Job[]> {
    const cached = this.getMemoryCache<Job[]>(this.CACHE_KEY_JOBS);
    if (cached) {
      return cached;
    }

    const jobs = await this.readJson<Job[]>('jobs_queue.json');
    const result = jobs || [];
    // Jobs 数据更新频繁，使用较短的 TTL（5秒）
    this.setMemoryCache(this.CACHE_KEY_JOBS, result, 5000);
    return result;
  }

  async claimJob(jobId: string): Promise<boolean> {
    return this.lock('jobs_queue.json', async () => {
      const jobs = await this.getJobs();
      const job = jobs.find(j => j.id === jobId);
      if (!job) return false;

      // Only claim if it is strictly PENDING
      if (job.status !== JobStatus.PENDING) {
        return false;
      }

      job.status = JobStatus.PROCESSING;
      job.updatedAt = Date.now();

      await this.writeJson('jobs_queue.json', jobs);
      // 使内存缓存失效
      this.invalidateMemoryCache(this.CACHE_KEY_JOBS);
      return true;
    });
  }

  async saveJob(job: Job): Promise<void> {
    if (!this.directoryHandle) return;
    try {
      return this.lock('jobs_queue.json', async () => {
        const jobs = await this.getJobs();
        const index = jobs.findIndex(j => j.id === job.id);
        if (index >= 0) {
          jobs[index] = job;
        } else {
          jobs.push(job);
        }
        await this.writeJson('jobs_queue.json', jobs);
        // 使内存缓存失效
        this.invalidateMemoryCache(this.CACHE_KEY_JOBS);
      });
    } catch (e) {
      console.error('Failed to save job:', e);
      throw e;
    }
  }

  async saveJobs(newJobs: Job[]): Promise<void> {
    if (!this.directoryHandle) return;
    try {
      return this.lock('jobs_queue.json', async () => {
        const jobs = await this.getJobs();
        const jobMap = new Map(jobs.map(j => [j.id, j]));

        for (const job of newJobs) {
          jobMap.set(job.id, job);
        }

        // Convert map back to array and preserve original order + appended new ones?
        // Actually map iteration order is insertion order usually, but let's be safe.
        // We want to keep existing jobs and add new ones.
        // If we just use values(), we might lose order if we are not careful, but Map preserves insertion order.
        // However, we want to update existing jobs in place if they exist?
        // For simplicity:
        const updatedJobs = Array.from(jobMap.values());

        await this.writeJson('jobs_queue.json', updatedJobs);
        // 使内存缓存失效
        this.invalidateMemoryCache(this.CACHE_KEY_JOBS);
      });
    } catch (e) {
      console.error('Failed to save jobs batch:', e);
      throw e;
    }
  }

  // --- Script Management ---

  async getScripts(projectId: string): Promise<Script[]> {
    const cacheKey = `${this.CACHE_KEY_SCRIPTS_PREFIX}${projectId}`;
    const cached = this.getMemoryCache<Script[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const filename = `scripts_${projectId}.json`;
    console.log('[Storage] getScripts called, projectId:', projectId);
    console.log('[Storage] Reading file:', filename);
    const data = await this.readJson<Script[]>(filename);

    // 去重处理：确保每个脚本只有一个实例
    const seen: Record<string, boolean> = {};
    const result: Script[] = [];
    const rawScripts = data || [];
    for (const script of rawScripts) {
      if (!seen[script.id]) {
        seen[script.id] = true;
        result.push(script);
      }
    }

    console.log(
      '[Storage] Read result:',
      data ? `Found ${data.length} scripts, deduplicated to ${result.length}` : 'No data'
    );
    this.setMemoryCache(cacheKey, result);
    return result;
  }

  async getAllScripts(): Promise<Script[]> {
    // Get all script files and merge them
    const files = await this.listFiles();
    const scriptFiles = files.filter(
      f => f.name.startsWith('scripts_') && f.name.endsWith('.json')
    );

    let allScripts: Script[] = [];
    for (const file of scriptFiles) {
      const data = await this.readJson<Script[]>(file.name);
      if (data) {
        allScripts = allScripts.concat(data);
      }
    }
    return allScripts;
  }

  async getScript(scriptId: string, projectId: string): Promise<Script | null> {
    console.log('[Storage] ========== Getting Script ==========');
    console.log('[Storage] Script ID:', scriptId);
    const scripts = await this.getScripts(projectId);
    const script = scripts.find(s => s.id === scriptId) || null;
    console.log('[Storage] Script found:', !!script);
    if (script?.parseState?.qualityReport) {
      console.log('[Storage] Quality Report Score:', script.parseState.qualityReport.score);
    } else {
      console.log('[Storage] No quality report in loaded script');
    }
    console.log('[Storage] ========== Script Loaded ==========');
    return script;
  }

  async saveScript(script: Script): Promise<void> {
    const filename = `scripts_${script.projectId}.json`;
    console.log('[Storage] ========== Saving Script ==========');
    console.log('[Storage] Script ID:', script.id);
    console.log('[Storage] Has parseState:', !!script.parseState);
    console.log('[Storage] Has qualityReport:', !!script.parseState?.qualityReport);
    if (script.parseState?.qualityReport) {
      console.log('[Storage] Quality Report Score:', script.parseState.qualityReport.score);
    }

    return this.lock(filename, async () => {
      const scripts = await this.getScripts(script.projectId);
      const index = scripts.findIndex(s => s.id === script.id);

      script.updatedAt = Date.now();

      if (index >= 0) {
        scripts[index] = script;
        console.log('[Storage] Script updated at index:', index);
      } else {
        scripts.push(script);
        console.log('[Storage] New script added');
      }

      await this.writeJson(filename, scripts);
      console.log('[Storage] ========== Script Saved ==========');
      // 使内存缓存失效
      this.invalidateMemoryCache(this.CACHE_KEY_SCRIPTS_PREFIX);
    });
  }

  async deleteScript(
    scriptId: string,
    projectId: string
  ): Promise<{ characters: number; scenes: number; items: number }> {
    const filename = `scripts_${projectId}.json`;

    // 1. 先获取关联资产统计
    const assets = await this.getAssets(projectId);
    const relatedAssets = assets.filter(a => a.scriptId === scriptId);
    const stats = {
      characters: relatedAssets.filter(a => a.type === AssetType.CHARACTER).length,
      scenes: relatedAssets.filter(a => a.type === AssetType.SCENE).length,
      items: relatedAssets.filter(a => a.type === AssetType.ITEM).length,
    };

    // 2. 删除剧本
    await this.lock(filename, async () => {
      let scripts = await this.getScripts(projectId);
      scripts = scripts.filter(s => s.id !== scriptId);
      await this.writeJson(filename, scripts);
      // 使内存缓存失效
      this.invalidateMemoryCache(this.CACHE_KEY_SCRIPTS_PREFIX);
    });

    // 3. 级联删除关联资产（使用现有的 deleteAsset 方法）
    for (const asset of relatedAssets) {
      await this.deleteAsset(asset.id, projectId);
    }

    return stats;
  }

  async updateScriptParseState(
    scriptId: string,
    projectId: string,
    updateFn: (state: Script['parseState']) => Script['parseState']
  ): Promise<void> {
    const filename = `scripts_${projectId}.json`;
    return this.lock(filename, async () => {
      const scripts = await this.getScripts(projectId);
      const index = scripts.findIndex(s => s.id === scriptId);

      if (index === -1) {
        throw new Error(`Script not found: ${scriptId}`);
      }

      const script = scripts[index];
      script.parseState = updateFn(script.parseState);
      script.updatedAt = Date.now();

      scripts[index] = script;
      await this.writeJson(filename, scripts);
      // 使内存缓存失效
      this.invalidateMemoryCache(this.CACHE_KEY_SCRIPTS_PREFIX);
    });
  }

  // --- Review Management ---

  async saveReviewItem(reviewItem: any): Promise<void> {
    const filename = `reviews_${reviewItem.projectId}.json`;
    return this.lock(filename, async () => {
      const reviews = await this.getReviewItems(reviewItem.projectId);
      const index = reviews.findIndex(r => r.id === reviewItem.id);

      if (index >= 0) {
        reviews[index] = reviewItem;
      } else {
        reviews.push(reviewItem);
      }

      await this.writeJson(filename, reviews);
    });
  }

  async getReviewItems(projectId: string): Promise<any[]> {
    const data = await this.readJson<any[]>(`reviews_${projectId}.json`);
    return data || [];
  }

  async getReviewItem(reviewId: string, projectId: string): Promise<any | null> {
    const reviews = await this.getReviewItems(projectId);
    return reviews.find(r => r.id === reviewId) || null;
  }
}

export const storageService = new StorageService();
