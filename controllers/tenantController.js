const crypto = require('crypto');
const Tenant = require('../models/tenant');
const User = require('../models/user');
const logger = require('../utils/logger');
const cacheManager = require('../utils/cacheManager');

// Gerar API key única
const generateUniqueApiKey = async () => {
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  // Verificar se a API key já existe
  const existingTenant = await Tenant.findOne({ apiKey });
  if (existingTenant) {
    // Se já existe, gerar novamente
    return generateUniqueApiKey();
  }
  
  return apiKey;
};

// Obter todos os tenants
exports.getAllTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find()
      .select('name slug active planType contact settings createdAt');
    
    res.json({ tenants });
  } catch (error) {
    logger.error('Erro ao listar tenants:', error);
    res.status(500).json({ error: 'Erro ao buscar tenants' });
  }
};

// Obter tenant específico
exports.getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant não encontrado' });
    }
    
    res.json({ tenant });
  } catch (error) {
    logger.error(`Erro ao buscar tenant ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao buscar tenant' });
  }
};

// Criar novo tenant
exports.createTenant = async (req, res) => {
  try {
    const { name, slug, contact, planType, settings } = req.body;
    
    // Verificar se slug já existe
    const existingTenant = await Tenant.findOne({ slug });
    if (existingTenant) {
      return res.status(400).json({ error: 'Slug já está em uso' });
    }
    
    // Gerar API key
    const apiKey = await generateUniqueApiKey();
    
    // Criar tenant
    const tenant = new Tenant({
      name,
      slug,
      apiKey,
      contact,
      planType,
      settings
    });
    
    await tenant.save();
    
    res.status(201).json({
      message: 'Tenant criado com sucesso',
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        apiKey: tenant.apiKey
      }
    });
  } catch (error) {
    logger.error('Erro ao criar tenant:', error);
    res.status(500).json({ error: 'Erro ao criar tenant' });
  }
};

// Atualizar tenant
exports.updateTenant = async (req, res) => {
  try {
    const { name, contact, planType, settings } = req.body;
    
    const tenant = await Tenant.findById(req.params.id);
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant não encontrado' });
    }
    
    // Atualizar campos
    tenant.name = name || tenant.name;
    
    if (contact) {
      tenant.contact = {
        ...tenant.contact,
        ...contact
      };
    }
    
    if (planType) {
      tenant.planType = planType;
    }
    
    if (settings) {
      tenant.settings = {
        ...tenant.settings,
        ...settings
      };
    }
    
    await tenant.save();
    
    // Limpar cache relacionado ao tenant
    cacheManager.delByPrefix(`tenant_${tenant._id}`);
    
    res.json({
      message: 'Tenant atualizado com sucesso',
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        planType: tenant.planType
      }
    });
  } catch (error) {
    logger.error(`Erro ao atualizar tenant ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao atualizar tenant' });
  }
};

// Ativar/desativar tenant
exports.toggleTenantStatus = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant não encontrado' });
    }
    
    // Inverter status
    tenant.active = !tenant.active;
    
    await tenant.save();
    
    // Se desativado, desativar também todos os usuários do tenant
    if (!tenant.active) {
      await User.updateMany(
        { tenantId: tenant._id },
        { $set: { active: false } }
      );
    }
    
    // Limpar cache relacionado ao tenant
    cacheManager.delByPrefix(`tenant_${tenant._id}`);
    
    res.json({
      message: `Tenant ${tenant.active ? 'ativado' : 'desativado'} com sucesso`,
      status: tenant.active
    });
  } catch (error) {
    logger.error(`Erro ao alterar status do tenant ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao alterar status do tenant' });
  }
};

// Gerar nova API key
exports.generateApiKey = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant não encontrado' });
    }
    
    // Gerar nova API key
    const apiKey = await generateUniqueApiKey();
    
    // Atualizar tenant
    tenant.apiKey = apiKey;
    await tenant.save();
    
    // Limpar cache relacionado ao tenant
    cacheManager.delByPrefix(`tenant_${tenant._id}`);
    
    res.json({
      message: 'Nova API key gerada com sucesso',
      apiKey
    });
  } catch (error) {
    logger.error(`Erro ao gerar API key para tenant ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao gerar nova API key' });
  }
};