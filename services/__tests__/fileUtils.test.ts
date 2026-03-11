import { describe, it, expect } from 'vitest';
import { isImageFile, isVideoFile, getFileExtension, getMimeType } from '../fileUtils';

describe('fileUtils', () => {
  describe('isImageFile', () => {
    it('should return true for image files', () => {
      expect(isImageFile('photo.jpg')).toBe(true);
      expect(isImageFile('photo.jpeg')).toBe(true);
      expect(isImageFile('photo.png')).toBe(true);
      expect(isImageFile('photo.gif')).toBe(true);
      expect(isImageFile('photo.webp')).toBe(true);
    });

    it('should return false for non-image files', () => {
      expect(isImageFile('document.pdf')).toBe(false);
      expect(isImageFile('video.mp4')).toBe(false);
      expect(isImageFile('audio.mp3')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isImageFile('photo.JPG')).toBe(true);
      expect(isImageFile('photo.PNG')).toBe(true);
    });
  });

  describe('isVideoFile', () => {
    it('should return true for video files', () => {
      expect(isVideoFile('video.mp4')).toBe(true);
      expect(isVideoFile('video.avi')).toBe(true);
      expect(isVideoFile('video.mov')).toBe(true);
      expect(isVideoFile('video.webm')).toBe(true);
    });

    it('should return false for non-video files', () => {
      expect(isVideoFile('photo.jpg')).toBe(false);
      expect(isVideoFile('document.pdf')).toBe(false);
    });
  });

  describe('getFileExtension', () => {
    it('should return correct extension', () => {
      expect(getFileExtension('photo.jpg')).toBe('jpg');
      expect(getFileExtension('document.pdf')).toBe('pdf');
      expect(getFileExtension('archive.tar.gz')).toBe('gz');
    });

    it('should return empty string for files without extension', () => {
      expect(getFileExtension('README')).toBe('');
      expect(getFileExtension('Makefile')).toBe('');
    });

    it('should handle paths correctly', () => {
      expect(getFileExtension('/path/to/photo.jpg')).toBe('jpg');
      expect(getFileExtension('C:\\Users\\file.txt')).toBe('txt');
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME type for images', () => {
      expect(getMimeType('photo.jpg')).toBe('image/jpeg');
      expect(getMimeType('photo.png')).toBe('image/png');
      expect(getMimeType('photo.gif')).toBe('image/gif');
    });

    it('should return correct MIME type for videos', () => {
      expect(getMimeType('video.mp4')).toBe('video/mp4');
      expect(getMimeType('video.webm')).toBe('video/webm');
    });

    it('should return application/octet-stream for unknown types', () => {
      expect(getMimeType('file.xyz')).toBe('application/octet-stream');
    });
  });
});
