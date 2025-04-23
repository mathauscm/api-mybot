const NodeCache = require('node-cache');
const config = require('../config/config');
const logger = require('./logger');

// Cria cache com tempo de vida padrão
const cache = new NodeCache({ 
  stdTTL: config.cache.ttl,
  checkperiod: config.cache.ttl * 0.2 
});

const cacheManager = {
  // Obter do cache
  get: function(key) {
    return cache.get(key);
  },
  
  // Definir no cache
  set: function(key, value, ttl = config.cache.ttl) {
    return cache.set(key, value, ttl);
  },
  
  // Remover do cache
  del: function(key) {
    return cache.del(key);
  },
  
  // Limpar cache por prefixo
  delByPrefix: function(prefix) {
    const keys = cache.keys();
    const delKeys = keys.filter(key => key.startsWith(prefix));
    
    if (delKeys.length > 0) {
      cache.del(delKeys);
      logger.debug(`Cache limpo para prefixo: ${prefix}, ${delKeys.length} chaves removidas`);
    }
    
    return delKeys.length;
  },
  
  // Limpar todo o cache
  flush: function() {
    return cache.flushAll();
  }
};

module.exports = cacheManager;