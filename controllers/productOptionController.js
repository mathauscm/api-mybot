const ProductOption = require('../models/productOption');
const Catalog = require('../models/catalog');
const logger = require('../utils/logger');
const cacheManager = require('../utils/cacheManager');

// Obter opções por tipo (para clientes do bot)
exports.getOptionsByType = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const type = req.params.type;
    
    // Validar tipo
    if (!['pizza-size', 'pizza-crust', 'burger-addon'].includes(type)) {
      return res.status(400).json({ error: 'Tipo de opção inválido' });
    }
    
    // Tentar obter do cache
    const cacheKey = `tenant_${tenantId}_options_${type}`;
    const cachedOptions = cacheManager.get(cacheKey);
    
    if (cachedOptions) {
      return res.json({ options: cachedOptions });
    }
    
    // Buscar do banco de dados
    const options = await ProductOption.find({
      tenantId,
      type,
      active: true
    }).sort({ order: 1, price: 1 });
    
    // Salvar no cache
    cacheManager.set(cacheKey, options);
    
    res.json({ options });
  } catch (error) {
    logger.error(`Erro ao buscar opções do tipo ${req.params.type} para tenant ${req.tenant._id}:`, error);
    res.status(500).json({ error: 'Erro ao buscar opções' });
  }
};

// ==== ROTAS ADMINISTRATIVAS ====

// Obter todas as opções
exports.getAllOptions = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    const options = await ProductOption.find({ tenantId })
      .sort({ type: 1, order: 1, name: 1 });
    
    res.json({ options });
  } catch (error) {
    logger.error(`Erro ao buscar todas as opções para tenant ${req.user.tenantId}:`, error);
    res.status(500).json({ error: 'Erro ao buscar opções' });
  }
};

// Obter opções por tipo (admin)
exports.getAdminOptionsByType = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const type = req.params.type;
    
    // Validar tipo
    if (!['pizza-size', 'pizza-crust', 'burger-addon'].includes(type)) {
      return res.status(400).json({ error: 'Tipo de opção inválido' });
    }
    
    const options = await ProductOption.find({
      tenantId,
      type
    }).sort({ order: 1, name: 1 });
    
    res.json({ options });
  } catch (error) {
    logger.error(`Erro ao buscar opções admin do tipo ${req.params.type}:`, error);
    res.status(500).json({ error: 'Erro ao buscar opções' });
  }
};

// Obter opção por ID
exports.getOptionById = async (req, res) => {
  try {
    const option = await ProductOption.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    });
    
    if (!option) {
      return res.status(404).json({ error: 'Opção não encontrada' });
    }
    
    res.json({ option });
  } catch (error) {
    logger.error(`Erro ao buscar opção ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao buscar opção' });
  }
};

// Criar opção
exports.createOption = async (req, res) => {
  try {
    const {
      type,
      name,
      description,
      price,
      maxQuantity,
      slices,
      order,
      active
    } = req.body;
    
    const tenantId = req.user.tenantId;
    
    // Criar opção
    const option = new ProductOption({
      tenantId,
      type,
      name,
      description,
      price,
      maxQuantity,
      slices,
      order: order || 0,
      active: active !== undefined ? active : true
    });
    
    await option.save();
    
    // Limpar cache
    cacheManager.delByPrefix(`tenant_${tenantId}_options_${type}`);
    
    res.status(201).json({
      message: 'Opção criada com sucesso',
      option
    });
  } catch (error) {
    logger.error(`Erro ao criar opção para tenant ${req.user.tenantId}:`, error);
    res.status(500).json({ error: 'Erro ao criar opção' });
  }
};

// Atualizar opção
exports.updateOption = async (req, res) => {
  try {
    const {
      type,
      name,
      description,
      price,
      maxQuantity,
      slices,
      order,
      active
    } = req.body;
    
    const tenantId = req.user.tenantId;
    
    // Buscar opção
    const option = await ProductOption.findOne({
      _id: req.params.id,
      tenantId
    });
    
    if (!option) {
      return res.status(404).json({ error: 'Opção não encontrada' });
    }
    
    // Se alterar o tipo, verificar se não afeta produtos
    if (type && type !== option.type) {
      // Para tamanhos de pizza, verificar se está em uso
      if (option.type === 'pizza-size') {
        const productsUsingSize = await Catalog.countDocuments({
          tenantId,
          'sizesPrices.sizeId': option._id
        });
        
        if (productsUsingSize > 0) {
          return res.status(400).json({
            error: 'Não é possível alterar o tipo desta opção pois ela está sendo usada em produtos'
          });
        }
      }
    }
    
    // Atualizar campos
    option.type = type || option.type;
    option.name = name || option.name;
    option.description = description !== undefined ? description : option.description;
    
    if (price !== undefined) {
      option.price = price;
    }
    
    if (maxQuantity !== undefined) {
      option.maxQuantity = maxQuantity;
    }
    
    // Slices só para pizza-size
    if (option.type === 'pizza-size' && slices !== undefined) {
      option.slices = slices;
    }
    
    if (order !== undefined) {
      option.order = order;
    }
    
    if (active !== undefined) {
      option.active = active;
    }
    
    await option.save();
    
    // Se alterou tipo, limpar cache dos dois tipos
    if (type && type !== option.type) {
      cacheManager.delByPrefix(`tenant_${tenantId}_options_${option.type}`);
      cacheManager.delByPrefix(`tenant_${tenantId}_options_${type}`);
    } else {
      // Limpar cache apenas do tipo atual
      cacheManager.delByPrefix(`tenant_${tenantId}_options_${option.type}`);
    }
    
    res.json({
      message: 'Opção atualizada com sucesso',
      option
    });
  } catch (error) {
    logger.error(`Erro ao atualizar opção ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao atualizar opção' });
  }
};

// Ativar/desativar opção
exports.toggleOptionStatus = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    // Buscar opção
    const option = await ProductOption.findOne({
      _id: req.params.id,
      tenantId
    });
    
    if (!option) {
      return res.status(404).json({ error: 'Opção não encontrada' });
    }
    
    // Inverter status
    option.active = !option.active;
    
    await option.save();
    
    // Limpar cache
    cacheManager.delByPrefix(`tenant_${tenantId}_options_${option.type}`);
    
    res.json({
      message: `Opção ${option.active ? 'ativada' : 'desativada'} com sucesso`,
      active: option.active
    });
  } catch (error) {
    logger.error(`Erro ao alterar status da opção ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao alterar status da opção' });
  }
};

// Reordenar opções
exports.reorderOptions = async (req, res) => {
  try {
    const { options } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!options || !Array.isArray(options)) {
      return res.status(400).json({ error: 'Lista de opções inválida' });
    }
    
    // Verificar se são do mesmo tipo
    const firstOption = await ProductOption.findOne({
      _id: options[0].id,
      tenantId
    });
    
    if (!firstOption) {
      return res.status(404).json({ error: 'Opção não encontrada' });
    }
    
    const type = firstOption.type;
    
    // Atualizar ordem de cada opção
    const updatePromises = options.map((item, index) => {
      return ProductOption.updateOne(
        { _id: item.id, tenantId, type },
        { $set: { order: index } }
      );
    });
    
    await Promise.all(updatePromises);
    
    // Limpar cache
    cacheManager.delByPrefix(`tenant_${tenantId}_options_${type}`);
    
    res.json({
      message: 'Opções reordenadas com sucesso'
    });
  } catch (error) {
    logger.error(`Erro ao reordenar opções para tenant ${req.user.tenantId}:`, error);
    res.status(500).json({ error: 'Erro ao reordenar opções' });
  }
};

// Excluir opção
exports.deleteOption = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    // Buscar opção
    const option = await ProductOption.findOne({
      _id: req.params.id,
      tenantId
    });
    
    if (!option) {
      return res.status(404).json({ error: 'Opção não encontrada' });
    }
    
    // Verificar se está em uso
    if (option.type === 'pizza-size') {
      const productsUsingSize = await Catalog.countDocuments({
        tenantId,
        'sizesPrices.sizeId': option._id
      });
      
      if (productsUsingSize > 0) {
        return res.status(400).json({
          error: 'Não é possível excluir esta opção pois ela está sendo usada em produtos',
          count: productsUsingSize
        });
      }
    }
    
    // Excluir opção
    await option.remove();
    
    // Limpar cache
    cacheManager.delByPrefix(`tenant_${tenantId}_options_${option.type}`);
    
    res.json({
      message: 'Opção excluída com sucesso'
    });
  } catch (error) {
    logger.error(`Erro ao excluir opção ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao excluir opção' });
  }
};