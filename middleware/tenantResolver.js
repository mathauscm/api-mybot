const Tenant = require('../models/tenant');
const logger = require('../utils/logger');

// Middleware para resolver o tenant pelo id ou slug
const tenantResolver = async (req, res, next) => {
  try {
    const tenantId = req.params.tenantId || req.body.tenantId;
    
    // Se não há tenant ID, continua
    if (!tenantId) return next();
    
    // Verifica se o tenantId é válido
    const tenant = await Tenant.findOne({
      $or: [
        { _id: tenantId },
        { slug: tenantId }
      ],
      active: true
    });
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant não encontrado' });
    }
    
    // Adiciona o tenant ao request
    req.tenant = tenant;
    req.tenantId = tenant._id;
    
    next();
  } catch (error) {
    logger.error('Erro ao resolver tenant:', error);
    return res.status(500).json({ error: 'Erro ao processar tenant' });
  }
};

module.exports = tenantResolver;