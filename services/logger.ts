const isDevelopment = import.meta.env.DEV || false;

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface Logger {
  log: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

const noop = () => {};

const createLogger = (): Logger => {
  if (isDevelopment) {
    return {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    };
  }

  return {
    log: noop,
    info: noop,
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: noop,
  };
};

export const logger = createLogger();

export default logger;
