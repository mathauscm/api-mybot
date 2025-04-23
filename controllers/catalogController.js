const Catalog = require('../models/catalog');
const Category = require('../models/category');
const ProductOption = require('../models/productOption');
const logger = require('../utils/logger');
const cacheManager = require('../utils/cacheManager');

// Obter todos os produtos (para clientes do bot)
exports.getProducts = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    
    // Tentar obter do cache
    const cacheKey = `tenant_${tenantId}_products`;
    const cachedProducts = cacheManager.get(cacheKey);
    
    if (cachedProducts) {
      return res.json({ products: cachedProducts });
    }
    
    // Buscar do banco de dados
    const products = await Catalog.find({
      tenantId,
      available: true
    })
    .populate('category', 'name slug')
    .sort({ 'category.order': 1, name: 1 });
    
    // Salvar no cache
    cacheManager.set(cacheKey, products);
    
    res.json({ products });
  } catch (error) {
    logger.error(`Erro ao buscar produtos para tenant ${req.tenant._id}:`, error);
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
};

// Obter produtos por categoria
exports.getProductsByCategory = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const categoryId = req.params.categoryId;
    
    // Tentar obter do cache
    const cacheKey = `tenant_${tenantId}_category_${categoryId}_products`;
    const cachedProducts = cacheManager.get(cacheKey);
    
    if (cachedProducts) {
      return res.json({ products: cachedProducts });
    }
    
    // Verificar se a categoria existe
    const category = await Category.findOne({
      _id: categoryId,
      tenantId,
      active: true
    });
    
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    
    // Buscar produtos
    const products = await Catalog.find({
      tenantId,
      category: categoryId,
      available: true
    })
    .populate('category', 'name slug')
    .sort({ name: 1 });
    
    // Salvar no cache
    cacheManager.set(cacheKey, products);
    
    res.json({ 
      category: {
        id: category._id,
        name: category.name,
        slug: category.slug
      },
      products 
    });
  } catch (error) {
    logger.error(`Erro ao buscar produtos da categoria ${req.params.categoryId}:`, error);
    res.status(500).json({ error: 'Erro ao buscar produtos da categoria' });
  }
};

// Obter produto por ID
exports.getProductById = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const productId = req.params.productId;
    
    // Tentar obter do cache
    const cacheKey = `tenant_${tenantId}_product_${productId}`;
    const cachedProduct = cacheManager.get(cacheKey);
    
    if (cachedProduct) {
      return res.json({ product: cachedProduct });
    }
    
    // Buscar produto
    const product = await Catalog.findOne({
      _id: productId,
      tenantId,
      available: true
    })
    .populate('category', 'name slug');
    
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    
    // Se for pizza, carregar opções de massa
    let additionalData = {};
    
    if (product.productType === 'pizza') {
      // Buscar tamanhos e massas de pizza
      const [crusts] = await Promise.all([
        ProductOption.find({
          tenantId,
          type: 'pizza-crust',
          active: true
        }).sort({ price: 1, name: 1 })
      ]);
      
      additionalData = { crusts };
    } else if (product.productType === 'hamburger') {
      // Buscar adicionais de hambúrguer
      const addons = await ProductOption.find({
        tenantId,
        type: 'burger-addon',
        active: true
      }).sort({ price: 1, name: 1 });
      
      additionalData = { addons };
    }
    
    // Combinar produto com dados adicionais
    const productWithOptions = {
      ...product.toObject(),
      ...additionalData
    };
    
    // Salvar no cache
    cacheManager.set(cacheKey, productWithOptions);
    
    res.json({ product: productWithOptions });
  } catch (error) {
    logger.error(`Erro ao buscar produto ${req.params.productId}:`, error);
    res.status(500).json({ error: 'Erro ao buscar produto' });
  }
};

// ==== ROTAS ADMINISTRATIVAS ====

// Obter produtos para administração
exports.getAdminProducts = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    // Opções de filtro
    const filter = { tenantId };
    
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    if (req.query.available === 'true') {
      filter.available = true;
    } else if (req.query.available === 'false') {
      filter.available = false;
    }
    
    if (req.query.productType) {
      filter.productType = req.query.productType;
    }
    
    // Paginação
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Ordenação
    const sort = {};
    if (req.query.sort) {
      const [field, order] = req.query.sort.split(':');
      sort[field] = order === 'desc' ? -1 : 1;
    } else {
      sort.name = 1;
    }
    
    // Executar consulta
    const [products, total] = await Promise.all([
      Catalog.find(filter)
        .populate('category', 'name slug')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      
      Catalog.countDocuments(filter)
    ]);
    
    res.json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error(`Erro ao buscar produtos admin para tenant ${req.user.tenantId}:`, error);
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
};

// Obter produto por ID para administração
exports.getAdminProductById = async (req, res) => {
  try {
    const product = await Catalog.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    })
    .populate('category', 'name slug');
    
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    
    // Carregar opções relacionadas
    let additionalData = {};
    
    if (product.productType === 'pizza') {
      const sizes = await ProductOption.find({
        tenantId: req.user.tenantId,
        type: 'pizza-size',
        active: true
      }).sort({ price: 1 });
      
      additionalData.availableSizes = sizes;
    }
    
    res.json({ 
      product,
      ...additionalData
    });
  } catch (error) {
    logger.error(`Erro ao buscar produto admin ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao buscar produto' });
  }
};

// Criar produto
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      image,
      available,
      category,
      productType,
      sizesPrices
    } = req.body;
    
    const tenantId = req.user.tenantId;
    
    // Verificar se a categoria existe
    const categoryExists = await Category.findOne({
      _id: category,
      tenantId
    });
    
    if (!categoryExists) {
      return res.status(400).json({ error: 'Categoria não encontrada' });
    }
    
    // Para pizzas, verificar se os tamanhos existem
    if (productType === 'pizza' && sizesPrices && sizesPrices.length > 0) {
      const sizeIds = sizesPrices.map(s => s.sizeId);
      
      const sizesCount = await ProductOption.countDocuments({
        _id: { $in: sizeIds },
        tenantId,
        type: 'pizza-size'
      });
      
      if (sizesCount !== sizeIds.length) {
        return res.status(400).json({ error: 'Um ou mais tamanhos selecionados são inválidos' });
      }
    }
    
    // Criar produto
    const product = new Catalog({
      tenantId,
      name,
      description,
      price,
      image,
      available: available !== undefined ? available : true,
      category,
      productType,
      sizesPrices
    });
    
    await product.save();
    
    // Limpar caches relacionados
    cacheManager.delByPrefix(`tenant_${tenantId}_products`);
    cacheManager.delByPrefix(`tenant_${tenantId}_category_${category}`);
    
    res.status(201).json({
      message: 'Produto criado com sucesso',
      product
    });
  } catch (error) {
    logger.error(`Erro ao criar produto para tenant ${req.user.tenantId}:`, error);
    res.status(500).json({ error: 'Erro ao criar produto' });
  }
};

// Atualizar produto
exports.updateProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      image,
      available,
      category,
      productType,
      sizesPrices
    } = req.body;
    
    const tenantId = req.user.tenantId;
    
    // Buscar produto existente
    const product = await Catalog.findOne({
      _id: req.params.id,
      tenantId
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    
    // Verificar se a categoria existe
    if (category) {
      const categoryExists = await Category.findOne({
        _id: category,
        tenantId
      });
      
      if (!categoryExists) {
        return res.status(400).json({ error: 'Categoria não encontrada' });
      }
    }
    
    // Para pizzas, verificar se os tamanhos existem
    if (productType === 'pizza' && sizesPrices && sizesPrices.length > 0) {
      const sizeIds = sizesPrices.map(s => s.sizeId);
      
      const sizesCount = await ProductOption.countDocuments({
        _id: { $in: sizeIds },
        tenantId,
        type: 'pizza-size'
      });
      
      if (sizesCount !== sizeIds.length) {
        return res.status(400).json({ error: 'Um ou mais tamanhos selecionados são inválidos' });
      }
    }
    
    // Atualizar campos
    if (name) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = price;
    if (image !== undefined) product.image = image;
    if (available !== undefined) product.available = available;
    if (category) product.category = category;
    if (productType) product.productType = productType;
    if (sizesPrices) product.sizesPrices = sizesPrices;
    
    await product.save();
    
    // Limpar caches relacionados
    cacheManager.delByPrefix(`tenant_${tenantId}_products`);
    cacheManager.delByPrefix(`tenant_${tenantId}_category_`);
    cacheManager.delByPrefix(`tenant_${tenantId}_product_${product._id}`);
    
    res.json({
      message: 'Produto atualizado com sucesso',
      product
    });
  } catch (error) {
    logger.error(`Erro ao atualizar produto ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
};

// Ativar/desativar produto
exports.toggleProductStatus = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    // Buscar produto
    const product = await Catalog.findOne({
      _id: req.params.id,
      tenantId
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    
    // Inverter disponibilidade
    product.available = !product.available;
    
    await product.save();
    
    // Limpar caches relacionados
    cacheManager.delByPrefix(`tenant_${tenantId}_products`);
    cacheManager.delByPrefix(`tenant_${tenantId}_category_${product.category}`);
    cacheManager.delByPrefix(`tenant_${tenantId}_product_${product._id}`);
    
    res.json({
      message: `Produto ${product.available ? 'ativado' : 'desativado'} com sucesso`,
      available: product.available
    });
  } catch (error) {
    logger.error(`Erro ao alterar status do produto ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao alterar status do produto' });
  }
};

// Excluir produto
exports.deleteProduct = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    // Buscar produto
    const product = await Catalog.findOne({
      _id: req.params.id,
      tenantId
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    
    // Excluir produto
    await product.remove();
    
    // Limpar caches relacionados
    cacheManager.delByPrefix(`tenant_${tenantId}_products`);
    cacheManager.delByPrefix(`tenant_${tenantId}_category_${product.category}`);
    cacheManager.delByPrefix(`tenant_${tenantId}_product_${product._id}`);
    
    res.json({
      message: 'Produto excluído com sucesso'
    });
  } catch (error) {
    logger.error(`Erro ao excluir produto ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao excluir produto' });
  }
};