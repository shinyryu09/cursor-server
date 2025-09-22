import winston from 'winston';
import chalk from 'chalk';
import config from '../config/config.js';

// 로그 포맷터
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let colorizedLevel = level;
    switch (level) {
      case 'error':
        colorizedLevel = chalk.red(level);
        break;
      case 'warn':
        colorizedLevel = chalk.yellow(level);
        break;
      case 'info':
        colorizedLevel = chalk.blue(level);
        break;
      case 'debug':
        colorizedLevel = chalk.gray(level);
        break;
    }

    let logMessage = `${chalk.gray(timestamp)} [${colorizedLevel}] ${message}`;
    
    if (stack) {
      logMessage += `\n${chalk.red(stack)}`;
    }
    
    if (Object.keys(meta).length > 0) {
      logMessage += `\n${chalk.gray(JSON.stringify(meta, null, 2))}`;
    }
    
    return logMessage;
  })
);

// 로거 생성
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: logFormat
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// 개발 환경에서는 디버그 로그도 출력
if (config.server.environment === 'development') {
  logger.add(new winston.transports.Console({
    level: 'debug',
    format: logFormat
  }));
}

export default logger;
