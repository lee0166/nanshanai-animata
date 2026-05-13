/**
 * Smart Chunker for Long Text Processing
 *
 * Implements intelligent text chunking strategy to prevent content loss
 * when processing long scripts/novels. Features:
 * - Scene-aware boundary splitting
 * - Overlap regions to preserve cross-chunk context
 * - Climax section protection (last 30% of content)
 * - Adaptive chunk sizing based on content structure
 *
 * @module services/parsing/SmartChunker
 */

export interface SmartChunk {
  id: string;
  content: string;
  startPosition: number;
  endPosition: number;
  overlapStart: number;
  overlapEnd: number;
  sceneNames: string[];
  isClimaxSection: boolean;
}

export interface SmartChunkerOptions {
  chunkSize?: number;
  overlapSize?: number;
  climaxRatio?: number;
}

export class SmartChunker {
  private options: Required<SmartChunkerOptions>;

  constructor(options: SmartChunkerOptions = {}) {
    this.options = {
      chunkSize: 8000,
      overlapSize: 2000,
      climaxRatio: 0.3,
      ...options,
    };
  }

  chunk(content: string, scenePositions?: Array<{name: string, position: number}>): SmartChunk[] {
    const chunks: SmartChunk[] = [];
    const totalLength = content.length;
    const climaxStart = Math.floor(totalLength * (1 - this.options.climaxRatio));

    if (scenePositions && scenePositions.length > 0) {
      return this.chunkByScenes(content, scenePositions, climaxStart);
    }

    let currentPosition = 0;
    let chunkIndex = 0;

    while (currentPosition < totalLength) {
      const isClimaxSection = currentPosition >= climaxStart;
      const remainingLength = totalLength - currentPosition;

      let endPosition = Math.min(
        currentPosition + this.options.chunkSize,
        totalLength
      );

      if (isClimaxSection && remainingLength > this.options.chunkSize) {
        endPosition = Math.min(
          currentPosition + Math.max(this.options.chunkSize, 12000),
          totalLength
        );
      }

      const overlapStart = chunkIndex > 0
        ? currentPosition - this.options.overlapSize
        : 0;
      const overlapEnd = endPosition < totalLength
        ? endPosition + this.options.overlapSize
        : totalLength;

      chunks.push({
        id: `chunk_${chunkIndex}`,
        content: content.substring(currentPosition, endPosition),
        startPosition: currentPosition,
        endPosition,
        overlapStart,
        overlapEnd,
        sceneNames: [],
        isClimaxSection,
      });

      currentPosition = endPosition - (endPosition < totalLength ? this.options.overlapSize : 0);
      chunkIndex++;
    }

    return chunks;
  }

  private chunkByScenes(
    content: string,
    scenePositions: Array<{name: string, position: number}>,
    climaxStart: number
  ): SmartChunk[] {
    const scenesPerChunk = 3;
    const chunks: SmartChunk[] = [];

    for (let i = 0; i < scenePositions.length; i += scenesPerChunk) {
      const sceneGroup = scenePositions.slice(i, i + scenesPerChunk);
      const startPosition = sceneGroup[0].position;
      const endPosition = i + scenesPerChunk < scenePositions.length
        ? scenePositions[i + scenesPerChunk].position + this.options.overlapSize
        : content.length;

      chunks.push({
        id: `chunk_${chunks.length}`,
        content: content.substring(startPosition, endPosition),
        startPosition,
        endPosition,
        overlapStart: i > 0 ? startPosition - this.options.overlapSize : 0,
        overlapEnd: endPosition,
        sceneNames: sceneGroup.map(s => s.name),
        isClimaxSection: startPosition >= climaxStart,
      });
    }

    return chunks;
  }
}
