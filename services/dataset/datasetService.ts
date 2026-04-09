import { getMockViStoryData } from './mockData';
import { convertStory } from './converter';

export function initializeDataset() {
  return Promise.resolve();
}

export function importDataset(maxStories: number = 10) {
  const mockData = getMockViStoryData().slice(0, maxStories);
  const importedStories = [];

  mockData.forEach(function (mockStory) {
    const converted = convertStory(mockStory);
    importedStories.push(converted);
  });

  return Promise.resolve(importedStories);
}

export function getStory(id: string) {
  return undefined;
}

export function getAllStories() {
  return [];
}

export function getDatasetStats() {
  return {
    totalStories: 0,
    totalShots: 0,
    totalDuration: 0,
  };
}

export function clearDatasetCache() {
  return Promise.resolve();
}
