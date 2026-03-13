/**
 * Logger Utility
 *
 * 提供分级日志控制，支持开发/生产环境区分
 *
 * @module services/logger
 * @author Nanshan AI Team
 * @version 1.0.0
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  enabled: boolean;
}

const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

const defaultConfig: LoggerConfig = {
  level: isDevelopment ? 'debug' : 'warn',
  prefix: '[APP]',
  enabled: true,
};

const logLevelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class LoggerService {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return logLevelPriority[level] >= logLevelPriority[this.config.level];
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): any[] {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = this.config.prefix || '[APP]';
    const formattedMessage = `${timestamp} ${prefix} [${level.toUpperCase()}] ${message}`;
    return [formattedMessage, ...args];
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(...this.formatMessage('debug', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(...this.formatMessage('info', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(...this.formatMessage('warn', message, ...args));
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(...this.formatMessage('error', message, ...args));
    }
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  setPrefix(prefix: string): void {
    this.config.prefix = prefix;
  }
}

// 创建默认 logger 实例
export const logger = new LoggerService();

// 创建带前缀的 logger 工厂函数
export const createLogger = (prefix: string, level?: LogLevel): LoggerService => {
  return new LoggerService({ prefix, level });
};

// 导出预设的模块 logger
export const scriptParserLogger = createLogger('[ScriptParser]', isDevelopment ? 'debug' : 'warn');
export const storageLogger = createLogger('[Storage]', isDevelopment ? 'debug' : 'warn');
export const llmLogger = createLogger('[LLM]', isDevelopment ? 'debug' : 'warn');
