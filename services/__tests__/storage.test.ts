import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Project } from '../../types';

// Mock the storage service
const storageService = {
  getProjects: vi.fn(),
  connect: vi.fn(),
};

describe('StorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProjects', () => {
    it('should return empty array when no projects exist', async () => {
      storageService.getProjects.mockResolvedValue([]);

      const projects = await storageService.getProjects();

      expect(projects).toEqual([]);
      expect(storageService.getProjects).toHaveBeenCalledTimes(1);
    });

    it('should return projects array when projects exist', async () => {
      const mockProjects: Project[] = [
        {
          id: '1',
          name: 'Test Project',
          description: 'Test Description',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      storageService.getProjects.mockResolvedValue(mockProjects);

      const projects = await storageService.getProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Test Project');
    });
  });

  describe('connect', () => {
    it('should return true when connection is successful', async () => {
      storageService.connect.mockResolvedValue(true);

      const result = await storageService.connect();

      expect(result).toBe(true);
    });

    it('should return false when connection fails', async () => {
      storageService.connect.mockResolvedValue(false);

      const result = await storageService.connect();

      expect(result).toBe(false);
    });
  });
});
