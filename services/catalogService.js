const Catalog = require('../models/catalog');
const Category = require('../models/category');
const ProductOption = require('../models/productOption');
const logger = require('../utils/logger');
const cacheManager = require('../utils/cacheManager');

/**
 * Serviço para gerenciamento do catálogo
 */
const catalogService = {
  /**
   * Busca produtos com filtros e opções de ordenação
   * @param {string} tenantId - ID do tenant
   * @param {Object} filters - Filtros a serem aplicados
   * @param {Object} options - Opções de paginação e ordenação
   * @returns {Promise<Object>} Produtos e informações de paginação
   */
  getProducts: async (tenantId, filters = {}, options = {}) => {
    try {
      const query = { tenantId, ...filters };
      
      const page = options.page || 1;
      const limit = options.limit || 10;
      const skip = (page - 1) * limit;
      
      const sort = options.sort || { name: 1 };
      
      // Executar consulta
      const [products, total] = await Promise.all([
        Catalog.find(query)
          .populate('category', 'name slug')
          .sort(sort)
          .skip(skip)
          .limit(limit),
        
        Catalog.countDocuments(query)
      ]);
      
      return {
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Erro ao buscar produtos para tenant ${tenantId}:`, error);
      throw new Error('Erro ao buscar produtos');
    }
  },
  
  /**
   * Busca detalhes de um produto específico
   * @param {string} tenantId - ID do tenant
   * @param {string} productId - ID do produto
   * @param {boolean} includeOptions - Incluir opções do produto
   * @returns {Promise<Object>} Detalhes do produto
   */
  getProductDetails: async (tenantId, productId, includeOptions = false) => {
    try {
      // Tentar obter do cache
      const cacheKey = `tenant_${tenantId}_product_${productId}`;
      const cachedProduct = cacheManager.get(cacheKey);
      
      if (cachedProduct) {
        return cachedProduct;
      }
      
      // Buscar produto
      const product = await Catalog.findOne({
        _id: productId,
        tenantId
      }).populate('category', 'name slug');
      
      if (!product) {
        throw new Error('Produto não encontrado');
      }
      
      let additionalData = {};
      
      // Carregar opções relacionadas se solicitado
      if (includeOptions) {
        if (product.productType === 'pizza') {
          const [sizes, crusts] = await Promise.all([
            ProductOption.find({
              tenantId,
              type: 'pizza-size',
              active: true
            }).sort({ price: 1 }),
            
            ProductOption.find({
              tenantId,
              type: 'pizza-crust',
              active: true
            }).sort({ price: 1 })
          ]);
          
          additionalData = { sizes, crusts };
        } else if (product.productType === 'hamburger') {
          const addons = await ProductOption.find({
            tenantId,
            type: 'burger-addon',
            active: true
          }).sort({ price: 1 });
          
          additionalData = { addons };
        }
      }
      
      // Combinar produto com dados adicionais
      const productWithOptions = {
        ...product.toObject(),
        ...additionalData
      };
      
      // Salvar no cache
      cacheManager.set(cacheKey, productWithOptions);
      
      return productWithOptions;
    } catch (error) {
      logger.error(`Erro ao buscar detalhes do produto ${productId}:`, error);
      throw error;
    }
  },
  
  /**
   * Cria um novo produto
   * @param {string} tenantId - ID do tenant
   * @param {Object} productData - Dados do produto
   * @returns {Promise<Object>} Produto criado
   */
  createProduct: async (tenantId, productData) => {
    try {
      // Verificar se a categoria existe
      const categoryExists = await Category.findOne({
        _id: productData.category,
        tenantId
      });
      
      if (!categoryExists) {
        throw new Error('Categoria não encontrada');
      }
      
      // Criar produto
      const product = new Catalog({
        tenantId,
        ...productData
      });
      
      await product.save();
      
      // Limpar caches relacionados
      cacheManager.delByPrefix(`tenant_${tenantId}_products`);
      cacheManager.delByPrefix(`tenant_${tenantId}_category_${productData.category}`);
      
      return product;
    } catch (error) {
      logger.error(`Erro ao criar produto para tenant ${tenantId}:`, error);
      throw error;
    }
  },
  
  /**
   * Atualiza um produto existente
   * @param {string} tenantId - ID do tenant
   * @param {string} productId - ID do produto
   * @param {Object} productData - Novos dados do produto
   * @returns {Promise<Object>} Produto atualizado
   */
  updateProduct: async (tenantId, productId, productData) => {
    try {
      // Buscar produto existente
      const product = await Catalog.findOne({
        _id: productId,
        tenantId
      });
      
      if (!product) {
        throw new Error('Produto não encontrado');
      }
      
      // Verificar se a categoria existe (se for alterar)
      if (productData.category && productData.category !== product.category.toString()) {
        const categoryExists = await Category.findOne({
          _id: productData.category,
          tenantId
        });
        
        if (!categoryExists) {
          throw new Error('Categoria não encontrada');
        }
      }
      
      // Atualizar campos
      Object.keys(productData).forEach(key => {
        if (productData[key] !== undefined) {
          product[key] = productData[key];
        }
      });
      
      await product.save();
      
      // Limpar caches relacionados
      cacheManager.delByPrefix(`tenant_${tenantId}_products`);
      cacheManager.delByPrefix(`tenant_${tenantId}_category_`);
      cacheManager.delByPrefix(`tenant_${tenantId}_product_${product._id}`);
      
      return product;
    } catch (error) {
      logger.error(`Erro ao atualizar produto ${productId}:`, error);
      throw error;
    }
  }
};

module.exports = catalogService;