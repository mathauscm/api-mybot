require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  apiUrl: process.env.API_URL || 'http://apimybot.innovv8.tech',
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/apimybot',
    dbName: process.env.DB_NAME || 'apimybot'
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  cache: {
    ttl: parseInt(process.env.CACHE_TTL) || 600 // 10 minutos
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};