const jwt = require('jsonwebtoken');
const Tenant = require('../models/tenant');
const User = require('../models/user');
const config = require('../config/config');
const logger = require('../utils/logger');

// Middleware para autenticar chave de API (para clientes da API)
exports.authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key não fornecida' });
    }
    
    const tenant = await Tenant.findByApiKey(apiKey);
    
    if (!tenant) {
      return res.status(401).json({ error: 'API key inválida' });
    }
    
    // Adiciona o tenant ao request
    req.tenant = tenant;
    next();
  } catch (error) {
    logger.error('Erro na autenticação por API key:', error);
    return res.status(500).json({ error: 'Erro na autenticação' });
  }
};

// Middleware para autenticar JWT (para usuários administrativos)
exports.authenticateJwt = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    const decoded = jwt.verify(token, config.jwt.secret);
    
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuário não autorizado' });
    }
    
    // Adiciona o usuário e o tenant ao request
    req.user = user;
    req.tenantId = user.tenantId;
    
    next();
  } catch (error) {
    logger.error('Erro na autenticação JWT:', error);
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

// Middleware para verificar roles de usuário
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    next();
  };
};