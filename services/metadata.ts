
import { storageService } from './storage';
import { isVideoFile, isImageFile } from './fileUtils';

export interface MediaMetadata {
    width?: number;
    height?: number;
    duration?: number;
    size?: number;
    fps?: number;
    fileType?: string;
}

/**
 * Extract FPS from an MP4 blob by parsing atoms
 * @param blob The video blob
 * @returns FPS number or undefined
 */
export const extractMp4Fps = async (blob: Blob): Promise<number | undefined> => {
    try {
        // More robust but still simple MP4 parser
    // Read first 256KB to increase chance of finding moov atom (sometimes it's further down)
    const buffer = await blob.slice(0, 256 * 1024).arrayBuffer();
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    console.log(`[Metadata] Extracting FPS from ${blob.size} bytes blob...`);

    // Find 'mdhd' (Media Header) to get timescale
    // Find 'stts' (Time to Sample) to get sample delta
    
    let timescale: number | undefined;
    let sampleDelta: number | undefined;

    // Helper to read atom size
    const getAtomSize = (offset: number) => {
        if (offset + 4 > bytes.length) return 0;
        return view.getUint32(offset);
    };

    // Helper to read atom type
    const getAtomType = (offset: number) => {
        if (offset + 8 > bytes.length) return '';
        return String.fromCharCode(bytes[offset+4], bytes[offset+5], bytes[offset+6], bytes[offset+7]);
    };

    // Recursive search for atoms
    // We only need to search inside 'moov' -> 'trak' -> 'mdia' -> 'minf' -> 'stbl'
    // But a linear scan is often enough if the atom is near the start. 
    // However, some MP4s have 'moov' at the END. If so, we can't find it in the first 128KB.
    // Let's try to be smarter: Scan top-level atoms.

    let offset = 0;
    while (offset < bytes.length - 8) {
        // Simple linear scan for signatures because structure parsing requires reading the whole file which is slow for large files
        // and 'moov' might be at the end.
        // But if 'moov' is at the end, our slice(0, 128k) won't find it anyway.
        // If linear scan fails, it might be because the atoms are further in the file.
        
        // Let's just improve the linear scanner first.
        
        // Check for 'mdhd'
        if (!timescale && bytes[offset] === 0x6d && bytes[offset+1] === 0x64 && bytes[offset+2] === 0x68 && bytes[offset+3] === 0x64) {
             const version = view.getUint8(offset + 4);
             // timescale is at offset 16 (v0) or 24 (v1) relative to 'mdhd' tag start
             timescale = view.getUint32(offset + (version === 0 ? 16 : 24));
             console.log(`[Metadata] Found mdhd atom at ${offset}. Version: ${version}, Timescale: ${timescale}`);
        }
        
        // Check for 'stts'
        if (!sampleDelta && bytes[offset] === 0x73 && bytes[offset+1] === 0x74 && bytes[offset+2] === 0x74 && bytes[offset+3] === 0x73) {
            const entryCount = view.getUint32(offset + 8);
            if (entryCount > 0) {
                sampleDelta = view.getUint32(offset + 16);
                console.log(`[Metadata] Found stts atom at ${offset}. First sample delta: ${sampleDelta}`);
            }
        }
        
        if (timescale && sampleDelta) break;
        offset++;
    }

    if (timescale && sampleDelta && sampleDelta > 0) {
        const fps = Math.round(timescale / sampleDelta);
        console.log(`[Metadata] Calculated FPS: ${fps}`);
        return fps;
    }
    
    // If not found in first chunk, it might be at the end of the file (moov atom at end).
    // Try reading the last 128KB?
    if (!timescale || !sampleDelta) {
        console.log("[Metadata] Atoms not found in header. Checking footer...");
        const fileSize = blob.size;
        // If file is small, we already checked it.
        if (fileSize > 256 * 1024) {
             const footerBuffer = await blob.slice(fileSize - 256 * 1024, fileSize).arrayBuffer();
             const footerView = new DataView(footerBuffer);
             const footerBytes = new Uint8Array(footerBuffer);
             
             for (let i = 0; i < footerBytes.length - 8; i++) {
                // Check for 'mdhd'
                if (!timescale && footerBytes[i] === 0x6d && footerBytes[i+1] === 0x64 && footerBytes[i+2] === 0x68 && footerBytes[i+3] === 0x64) {
                    const version = footerView.getUint8(i + 4);
                    timescale = footerView.getUint32(i + (version === 0 ? 16 : 24));
                    console.log(`[Metadata] Found mdhd atom in footer at ${i}. Version: ${version}, Timescale: ${timescale}`);
                }
                // Check for 'stts'
                if (!sampleDelta && footerBytes[i] === 0x73 && footerBytes[i+1] === 0x74 && footerBytes[i+2] === 0x74 && footerBytes[i+3] === 0x73) {
                    const entryCount = footerView.getUint32(i + 8);
                    if (entryCount > 0) {
                        sampleDelta = footerView.getUint32(i + 16);
                        console.log(`[Metadata] Found stts atom in footer at ${i}. First sample delta: ${sampleDelta}`);
                    }
                }
                if (timescale && sampleDelta) break;
             }
        }
    }

    if (timescale && sampleDelta && sampleDelta > 0) {
        const fps = Math.round(timescale / sampleDelta);
        console.log(`[Metadata] Calculated FPS (from footer): ${fps}`);
        return fps;
    }

    console.warn("[Metadata] Failed to find timescale or sampleDelta");
    return undefined;
    } catch (e) {
        console.error("[Metadata] Error parsing MP4 atoms:", e);
        return undefined;
    }
};

/**
 * Get metadata for a video file
 * @param url The video URL (blob: or http/https)
 * @param size Optional file size in bytes
 * @param sourceBlob Optional source blob (required for FPS extraction from MP4)
 */
export const getVideoMetadata = (url: string, size?: number, sourceBlob?: Blob): Promise<MediaMetadata> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        
        video.onloadedmetadata = async () => {
            let fps: number | undefined = undefined;

            // Try to extract FPS from MP4 if possible
            if (sourceBlob && sourceBlob.type === 'video/mp4') {
                try {
                    fps = await extractMp4Fps(sourceBlob);
                } catch (e) {
                    console.warn("Failed to extract MP4 FPS:", e);
                }
            }

            resolve({ 
                width: video.videoWidth, 
                height: video.videoHeight, 
                duration: video.duration,
                size: size || undefined,
                fps: fps
            });
        };
        video.onerror = reject;
        video.src = url;
    });
};

/**
 * Get metadata for an image file
 * @param url The image URL
 * @param size Optional file size in bytes
 */
export const getImageMetadata = (url: string, size?: number): Promise<MediaMetadata> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight, size: size || undefined });
        };
        img.onerror = reject;
        img.src = url;
    });
};

/**
 * Main entry point to get metadata from various sources
 * @param source Blob, File, or string path/URL
 */
export const getMediaMetadata = async (source: string | Blob | File): Promise<MediaMetadata> => {
    let url = '';
    let shouldRevoke = false;
    let size = 0;
    let sourceBlob: Blob | undefined = undefined;

    if (source instanceof Blob) {
        url = URL.createObjectURL(source);
        shouldRevoke = true;
        size = source.size;
        sourceBlob = source;
    } else if (typeof source === 'string') {
        if (source.startsWith('http') || source.startsWith('blob:')) {
            url = source;
        } else {
            // Assume relative path in storage, try to resolve
            try {
                url = await storageService.getAssetUrl(source);
                // Try to get size via head request? Or just ignore size for now if difficult
            } catch (e) {
                console.warn("Failed to resolve url for metadata:", source);
                return {};
            }
        }
    }

    if (!url) return { size: size || undefined };

    try {
        // Simple heuristic: check extension if string
        if (typeof source === 'string') {
            if (isVideoFile(source)) {
                // If we have a blob: URL (likely from storageService), try to get the blob for FPS extraction
                // This is needed because getVideoMetadata needs the Blob to parse MP4 atoms
                if (!sourceBlob && url.startsWith('blob:')) {
                    try {
                        const res = await fetch(url);
                        sourceBlob = await res.blob();
                    } catch (e) {
                        console.warn("Failed to fetch blob from url for metadata", e);
                    }
                }
                return await getVideoMetadata(url, size, sourceBlob);
            } else {
                return await getImageMetadata(url, size);
            }
        } else {
            // For Blob, try Image first then Video based on type
            if (source.type.startsWith('video')) {
                return await getVideoMetadata(url, size, sourceBlob);
            } else {
                return await getImageMetadata(url, size);
            }
        }
    } catch (e) {
        // Fallback or retry?
        // If image failed, maybe it's video (if we guessed wrong)
        try {
            return await getVideoMetadata(url, size, sourceBlob);
        } catch (e2) {
             console.warn("Failed to extract metadata", e);
             return { size: size || undefined };
        }
    } finally {
        if (shouldRevoke) {
            URL.revokeObjectURL(url);
        }
    }
};
