const logger = require('../utils/logger');

// Middleware de tratamento de erros
const errorHandler = (err, req, res, next) => {
  logger.error(`Erro: ${err.message}`, { stack: err.stack, url: req.originalUrl });
  
  // Erro de validação do Mongoose
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({ 
      error: 'Erro de validação', 
      details: messages 
    });
  }
  
  // Erro de dados duplicados
  if (err.code === 11000) {
    return res.status(400).json({ 
      error: 'Erro de dados duplicados', 
      details: err.keyValue 
    });
  }
  
  // Erro do JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Token inválido' });
  }
  
  // Erro de expiração do JWT
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expirado' });
  }
  
  // Erro de Joi validação
  if (err.name === 'ValidationError' && err.isJoi) {
    return res.status(400).json({ 
      error: 'Erro de validação', 
      details: err.details.map(detail => detail.message) 
    });
  }
  
  // Erro genérico
  const statusCode = err.statusCode || 500;
  const message = err.statusCode ? err.message : 'Erro interno do servidor';
  
  return res.status(statusCode).json({ 
    error: message,
    // Em desenvolvimento, incluir stack trace
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;