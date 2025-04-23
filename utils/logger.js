const winston = require('winston');
const path = require('path');
const config = require('../config/config');

// Define níveis de log
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

// Define configuração baseada no ambiente
const level = () => {
  return config.logging.level || 'info';
};

// Define cores para cada nível
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
}

winston.addColors(colors);

// Formato para logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define onde serão armazenados os logs
const transports = [
  // Sempre loga no console
  new winston.transports.Console(),
  
  // Loga erros em um arquivo
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/error.log'),
    level: 'error',
  }),
  
  // Loga todas as mensagens em um arquivo
  new winston.transports.File({ 
    filename: path.join(__dirname, '../logs/all.log') 
  }),
];

// Cria o logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

module.exports = logger;