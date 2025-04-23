const Category = require('../models/category');
const Catalog = require('../models/catalog');
const logger = require('../utils/logger');
const cacheManager = require('../utils/cacheManager');

// Gera um slug a partir do nome
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');
};

// Obter todas as categorias (para clientes do bot)
exports.getCategories = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    
    // Tentar obter do cache
    const cacheKey = `tenant_${tenantId}_categories`;
    const cachedCategories = cacheManager.get(cacheKey);
    
    if (cachedCategories) {
      return res.json({ categories: cachedCategories });
    }
    
    // Buscar do banco de dados
    const categories = await Category.find({
      tenantId,
      active: true
    }).sort({ order: 1 });
    
    // Salvar no cache
    cacheManager.set(cacheKey, categories);
    
    res.json({ categories });
  } catch (error) {
    logger.error(`Erro ao buscar categorias para tenant ${req.tenant._id}:`, error);
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
};

// Criar categoria
exports.createCategory = async (req, res) => {
  try {
    const { name, description, order, active } = req.body;
    const tenantId = req.user.tenantId;
    
    // Gerar slug
    const slug = generateSlug(name);
    
    // Verificar se já existe categoria com esse slug
    const existingCategory = await Category.findOne({ tenantId, slug });
    if (existingCategory) {
      return res.status(400).json({ error: 'Já existe uma categoria com esse nome' });
    }
    
    // Criar categoria
    const category = new Category({
      tenantId,
      name,
      slug,
      description,
      order: order || 0,
      active: active !== undefined ? active : true
    });
    
    await category.save();
    
    // Limpar cache
    cacheManager.delByPrefix(`tenant_${tenantId}_categories`);
    
    res.status(201).json({
      message: 'Categoria criada com sucesso',
      category
    });
  } catch (error) {
    logger.error(`Erro ao criar categoria para tenant ${req.user.tenantId}:`, error);
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
};

// Obter categoria por ID
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    });
    
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    
    res.json({ category });
  } catch (error) {
    logger.error(`Erro ao buscar categoria ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao buscar categoria' });
  }
};

// Atualizar categoria
exports.updateCategory = async (req, res) => {
  try {
    const { name, description, order, active } = req.body;
    const tenantId = req.user.tenantId;
    
    // Buscar categoria
    const category = await Category.findOne({
      _id: req.params.id,
      tenantId
    });
    
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    
    // Gerar novo slug se o nome mudou
    if (name && name !== category.name) {
      const slug = generateSlug(name);
      
      // Verificar se já existe outra categoria com esse slug
      const existingCategory = await Category.findOne({
        tenantId,
        slug,
        _id: { $ne: category._id }
      });
      
      if (existingCategory) {
        return res.status(400).json({ error: 'Já existe uma categoria com esse nome' });
      }
      
      category.slug = slug;
    }
    
    // Atualizar campos
    category.name = name || category.name;
    category.description = description !== undefined ? description : category.description;
    
    if (order !== undefined) {
      category.order = order;
    }
    
    if (active !== undefined) {
      category.active = active;
    }
    
    await category.save();
    
    // Limpar cache
    cacheManager.delByPrefix(`tenant_${tenantId}_categories`);
    
    res.json({
      message: 'Categoria atualizada com sucesso',
      category
    });
  } catch (error) {
    logger.error(`Erro ao atualizar categoria ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
};

// Ativar/desativar categoria
exports.toggleCategoryStatus = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    // Buscar categoria
    const category = await Category.findOne({
      _id: req.params.id,
      tenantId
    });
    
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    
    // Inverter status
    category.active = !category.active;
    
    await category.save();
    
    // Limpar cache
    cacheManager.delByPrefix(`tenant_${tenantId}_categories`);
    
    res.json({
      message: `Categoria ${category.active ? 'ativada' : 'desativada'} com sucesso`,
      active: category.active
    });
  } catch (error) {
    logger.error(`Erro ao alterar status da categoria ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao alterar status da categoria' });
  }
};

// Reordenar categorias
exports.reorderCategories = async (req, res) => {
  try {
    const { categories } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json({ error: 'Lista de categorias inválida' });
    }
    
    // Atualizar ordem de cada categoria
    const updatePromises = categories.map((item, index) => {
      return Category.updateOne(
        { _id: item.id, tenantId },
        { $set: { order: index } }
      );
    });
    
    await Promise.all(updatePromises);
    
    // Limpar cache
    cacheManager.delByPrefix(`tenant_${tenantId}_categories`);
    
    res.json({
      message: 'Categorias reordenadas com sucesso'
    });
  } catch (error) {
    logger.error(`Erro ao reordenar categorias para tenant ${req.user.tenantId}:`, error);
    res.status(500).json({ error: 'Erro ao reordenar categorias' });
  }
};

// Excluir categoria
exports.deleteCategory = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    // Verificar se há produtos usando esta categoria
    const productsCount = await Catalog.countDocuments({
      tenantId,
      category: req.params.id
    });
    
    if (productsCount > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir esta categoria pois existem produtos associados a ela',
        count: productsCount
      });
    }
    
    // Excluir categoria
    const result = await Category.deleteOne({
      _id: req.params.id,
      tenantId
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    
    // Limpar cache
    cacheManager.delByPrefix(`tenant_${tenantId}_categories`);
    
    res.json({
      message: 'Categoria excluída com sucesso'
    });
  } catch (error) {
    logger.error(`Erro ao excluir categoria ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao excluir categoria' });
  }
};