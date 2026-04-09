import { AnnotationData, Story } from './types';
import { getAIGeneratedSamples } from './aiGeneratedSamples';

const STORAGE_KEY = 'nsanimata_annotation_samples';

export interface AnnotationSampleStats {
  totalStories: number;
  totalShots: number;
  totalCharacters: number;
  totalScenes: number;
  averageQualityScore: number;
}

export class AnnotationSampleService {
  private data: AnnotationData;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.data = this.loadFromStorage();
  }

  private loadFromStorage(): AnnotationData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          stories: parsed.stories.map((story: any) => ({
            ...story,
            createdAt: story.createdAt ? new Date(story.createdAt) : new Date(),
            updatedAt: story.updatedAt ? new Date(story.updatedAt) : new Date(),
          })),
        };
      }
    } catch (e) {
      console.error('[AnnotationSampleService] Failed to load from storage:', e);
    }
    return getAIGeneratedSamples();
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.notifyListeners();
    } catch (e) {
      console.error('[AnnotationSampleService] Failed to save to storage:', e);
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  getAllStories(): Story[] {
    return [...this.data.stories];
  }

  getStoryById(id: string): Story | undefined {
    return this.data.stories.find(story => story.id === id);
  }

  addStory(story: Omit<Story, 'id' | 'createdAt' | 'updatedAt'>): Story {
    const newStory: Story = {
      ...story,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.data.stories.push(newStory);
    this.saveToStorage();
    return newStory;
  }

  updateStory(
    id: string,
    updates: Partial<Omit<Story, 'id' | 'createdAt' | 'updatedAt'>>
  ): Story | undefined {
    const index = this.data.stories.findIndex(story => story.id === id);
    if (index === -1) return undefined;

    this.data.stories[index] = {
      ...this.data.stories[index],
      ...updates,
      updatedAt: new Date(),
    };
    this.saveToStorage();
    return this.data.stories[index];
  }

  deleteStory(id: string): boolean {
    const initialLength = this.data.stories.length;
    this.data.stories = this.data.stories.filter(story => story.id !== id);
    if (this.data.stories.length !== initialLength) {
      this.saveToStorage();
      return true;
    }
    return false;
  }

  deleteMultipleStories(ids: string[]): number {
    const initialLength = this.data.stories.length;
    this.data.stories = this.data.stories.filter(story => !ids.includes(story.id));
    const deletedCount = initialLength - this.data.stories.length;
    if (deletedCount > 0) {
      this.saveToStorage();
    }
    return deletedCount;
  }

  exportToJSON(): string {
    return JSON.stringify(this.data, null, 2);
  }

  importFromJSON(jsonString: string): boolean {
    try {
      const imported = JSON.parse(jsonString);
      if (!imported.stories || !Array.isArray(imported.stories)) {
        throw new Error('Invalid format: stories array required');
      }

      const validatedStories: Story[] = imported.stories.map((story: any) => ({
        ...story,
        id: story.id || crypto.randomUUID(),
        createdAt: story.createdAt ? new Date(story.createdAt) : new Date(),
        updatedAt: story.updatedAt ? new Date(story.updatedAt) : new Date(),
      }));

      this.data.stories = validatedStories;
      this.saveToStorage();
      return true;
    } catch (e) {
      console.error('[AnnotationSampleService] Failed to import JSON:', e);
      return false;
    }
  }

  resetToDefaults(): void {
    this.data = getAIGeneratedSamples();
    this.saveToStorage();
  }

  getStats(): AnnotationSampleStats {
    let totalShots = 0;
    let totalCharacters = 0;
    let totalScenes = 0;

    this.data.stories.forEach(story => {
      totalShots += story.shots?.length || 0;
      totalCharacters += story.characters?.length || 0;
      totalScenes += story.scenes?.length || 0;
    });

    return {
      totalStories: this.data.stories.length,
      totalShots,
      totalCharacters,
      totalScenes,
      averageQualityScore: 85,
    };
  }

  searchStories(query: string): Story[] {
    const lowerQuery = query.toLowerCase();
    return this.data.stories.filter(
      story =>
        story.title.toLowerCase().includes(lowerQuery) ||
        story.synopsis.toLowerCase().includes(lowerQuery) ||
        story.characters?.some(char => char.name.toLowerCase().includes(lowerQuery))
    );
  }

  duplicateStory(id: string): Story | undefined {
    const original = this.getStoryById(id);
    if (!original) return undefined;

    const duplicated: Story = {
      ...original,
      id: crypto.randomUUID(),
      title: `${original.title} (副本)`,
      createdAt: new Date(),
      updatedAt: new Date(),
      characters: original.characters?.map(char => ({
        ...char,
        id: crypto.randomUUID(),
      })),
      scenes: original.scenes?.map(scene => ({
        ...scene,
        id: crypto.randomUUID(),
      })),
      shots: original.shots?.map(shot => ({
        ...shot,
        id: crypto.randomUUID(),
      })),
    };

    this.data.stories.push(duplicated);
    this.saveToStorage();
    return duplicated;
  }
}

export const annotationSampleService = new AnnotationSampleService();
