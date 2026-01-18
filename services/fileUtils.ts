
export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v', '3gp'];
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg', 'ico'];

/**
 * Check if the file path represents a video based on extension
 */
export const isVideoFile = (path?: string): boolean => {
  if (!path) return false;
  // Remove query params or hash if any
  const cleanPath = path.split(/[?#]/)[0];
  return new RegExp(`\\.(${VIDEO_EXTENSIONS.join('|')})$`, 'i').test(cleanPath);
};

/**
 * Check if the file path represents an image based on extension
 */
export const isImageFile = (path?: string): boolean => {
  if (!path) return false;
  const cleanPath = path.split(/[?#]/)[0];
  return new RegExp(`\\.(${IMAGE_EXTENSIONS.join('|')})$`, 'i').test(cleanPath);
};

/**
 * Get file type based on extension
 */
export const getFileType = (path?: string): 'video' | 'image' | 'unknown' => {
  if (isVideoFile(path)) return 'video';
  if (isImageFile(path)) return 'image';
  return 'unknown';
};

/**
 * Get MIME type based on file extension
 */
export const getMimeType = (path?: string): string => {
  if (!path) return 'application/octet-stream';
  const cleanPath = path.split(/[?#]/)[0];
  const ext = cleanPath.split('.').pop()?.toLowerCase();

  if (!ext) return 'application/octet-stream';

  switch (ext) {
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    case 'ogg': return 'video/ogg';
    case 'mov': return 'video/quicktime';
    case 'avi': return 'video/x-msvideo';
    case 'mkv': return 'video/x-matroska';
    case 'flv': return 'video/x-flv';
    case 'wmv': return 'video/x-ms-wmv';
    case 'm4v': return 'video/x-m4v';
    case '3gp': return 'video/3gpp';
    
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'bmp': return 'image/bmp';
    case 'tiff': return 'image/tiff';
    case 'svg': return 'image/svg+xml';
    case 'ico': return 'image/x-icon';
    
    default: return 'application/octet-stream';
  }
};
