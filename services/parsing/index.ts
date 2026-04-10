/**
 * Parsing Services Index
 *
 * 导出所有解析相关的服务
 *
 * @module services/parsing
 */

// Progress Tracking
export {
  ProgressTracker,
  createProgressTracker,
  type StageState,
  type SubTaskState,
  type ProgressDetails,
} from './ProgressTracker';

export {
  type ProgressTrackerConfig,
  type SubTaskWeights,
  DEFAULT_STAGE_WEIGHTS,
  SHORT_TEXT_STAGE_WEIGHTS,
  LONG_TEXT_STAGE_WEIGHTS,
  DEFAULT_PROGRESS_TRACKER_CONFIG,
  METADATA_SUBTASK_WEIGHTS,
  getAdaptiveStageWeights,
  validateStageWeights,
  normalizeStageWeights,
} from './ProgressTrackerConfig';

export {
  SmoothProgressAnimator,
  createSmoothProgressAnimator,
  type SmoothProgressAnimatorConfig,
  DEFAULT_ANIMATOR_CONFIG,
} from './SmoothProgressAnimator';

export {
  TimeEstimator,
  createTimeEstimator,
  type StageDurationRecord,
  type TimeEstimate,
  type TimeEstimatorConfig,
  DEFAULT_TIME_ESTIMATOR_CONFIG,
} from './TimeEstimator';

// Re-export other parsing services
export { PerformanceMonitor } from './PerformanceMonitor';
export { QualityAnalyzer } from './QualityAnalyzer';
export { default as BudgetPlanner } from './BudgetPlanner';
export { SemanticChunker } from './SemanticChunker';
export { SceneContextExtractor } from './SceneContextExtractor';
export { GlobalContextExtractor } from './GlobalContextExtractor';
export { MultiLevelCache, type CacheStats } from './MultiLevelCache';
export { DynamicBatchSizer } from './DynamicBatchSizer';
export { DynamicTimeoutCalculator } from './DynamicTimeoutCalculator';
export { CircuitBreaker, type CircuitState } from './CircuitBreaker';
export { TokenBudgetMonitor } from './TokenBudgetMonitor';
export { TokenOptimizer } from './TokenOptimizer';
export { EmbeddingService } from './EmbeddingService';

// Prompt Generation
export { PromptGeneratorService, type PromptGeneratorOptions } from './PromptGeneratorService';
