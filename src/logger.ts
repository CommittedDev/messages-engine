class Logger {
  error(message: string) {
    console.error(message);
  }
  warn(message: string) {
    console.warn(message);
  }
  info(message: string) {
    console.info(message);
  }
  debug(message: string) {
    console.debug(message);
  }
}

export const logger = new Logger();