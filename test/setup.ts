import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Mock storage service
vi.mock('../services/storage', () => ({
  storageService: {
    updateScriptParseState: vi.fn(),
    getScript: vi.fn(),
  },
}));

// Mock console methods to reduce noise in tests
console.log = vi.fn();
console.warn = vi.fn();
console.error = vi.fn();
