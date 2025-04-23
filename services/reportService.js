const Order = require('../models/order');
const Catalog = require('../models/catalog');
const Category = require('../models/category');
const Conversation = require('../models/conversation');
const logger = require('../utils/logger');

/**
 * Serviço para geração de relatórios
 */
const reportService = {
  /**
   * Gera relatório de vendas
   * @param {string} tenantId - ID do tenant
   * @param {Date} startDate - Data inicial
   * @param {Date} endDate - Data final
   * @returns {Promise<Object>} Relatório de vendas
   */
  generateSalesReport: async (tenantId, startDate, endDate) => {
    try {
      // Filtro de período
      const dateFilter = {
        tenantId,
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      };
      
      // Total de vendas por dia
      const dailySales = await Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 },
            total: { $sum: '$total' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);
      
      // Formatando resultado diário
      const salesByDay = dailySales.map(item => {
        const date = new Date(item._id.year, item._id.month - 1, item._id.day);
        return {
          date: date.toISOString().split('T')[0],
          count: item.count,
          total: item.total
        };
      });
      
      // Total por método de pagamento
      const salesByPaymentMethod = await Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$paymentMethod',
            count: { $sum: 1 },
            total: { $sum: '$total' }
          }
        },
        { $sort: { total: -1 } }
      ]);
      
      // Total por categoria de produto
      const categorySales = await Order.aggregate([
        { $match: dateFilter },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'catalogs',
            localField: 'items.productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'categories',
            localField: 'product.category',
            foreignField: '_id',
            as: 'category'
          }
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: {
              categoryId: '$category._id',
              categoryName: '$category.name'
            },
            count: { $sum: '$items.quantity' },
            total: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } }
          }
        },
        { $sort: { total: -1 } }
      ]);
      
      // Formatando resultado de categorias
      const salesByCategory = categorySales.map(item => ({
        categoryId: item._id.categoryId || 'sem-categoria',
        categoryName: item._id.categoryName || 'Sem Categoria',
        count: item.count,
        total: item.total
      }));
      
      // Estatísticas gerais
      const overallStats = await Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalSales: { $sum: '$total' },
            averageTicket: { $avg: '$total' },
            minTicket: { $min: '$total' },
            maxTicket: { $max: '$total' }
          }
        }
      ]);
      
      const stats = overallStats.length > 0 ? overallStats[0] : {
        totalOrders: 0,
        totalSales: 0,
        averageTicket: 0,
        minTicket: 0,
        maxTicket: 0
      };
      
      // Remover _id do resultado final
      delete stats._id;
      
      return {
        period: {
          start: startDate,
          end: endDate
        },
        stats,
        salesByDay,
        salesByPaymentMethod,
        salesByCategory
      };
    } catch (error) {
      logger.error(`Erro ao gerar relatório de vendas para tenant ${tenantId}:`, error);
      throw new Error('Erro ao gerar relatório de vendas');
    }
  },
  
  /**
   * Gera relatório de produtos
   * @param {string} tenantId - ID do tenant
   * @param {Date} startDate - Data inicial
   * @param {Date} endDate - Data final
   * @returns {Promise<Object>} Relatório de produtos
   */
  generateProductsReport: async (tenantId, startDate, endDate) => {
    try {
      // Filtro de período
      const dateFilter = {
        tenantId,
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      };
      
      // Produtos mais vendidos
      const topProducts = await Order.aggregate([
        { $match: dateFilter },
        { $unwind: '$items' },
        {
          $group: {
            _id: {
              productId: '$items.productId',
              productName: '$items.name'
            },
            quantity: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } }
          }
        },
        { $sort: { quantity: -1 } },
        { $limit: 20 }
      ]);
      
      // Formatando resultado
      const productRanking = topProducts.map(item => ({
        productId: item._id.productId || 'custom',
        productName: item._id.productName,
        quantity: item.quantity,
        revenue: item.revenue
      }));
      
      // Categorias mais vendidas
      const topCategories = await Order.aggregate([
        { $match: dateFilter },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'catalogs',
            localField: 'items.productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'categories',
            localField: 'product.category',
            foreignField: '_id',
            as: 'category'
          }
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: {
              categoryId: '$category._id',
              categoryName: '$category.name'
            },
            quantity: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } }
          }
        },
        { $sort: { quantity: -1 } }
      ]);
      
      // Formatando resultado
      const categoryRanking = topCategories.map(item => ({
        categoryId: item._id.categoryId || 'sem-categoria',
        categoryName: item._id.categoryName || 'Sem Categoria',
        quantity: item.quantity,
        revenue: item.revenue
      }));
      
      // Opções mais escolhidas (para pizzas e hambúrgueres)
      const topOptions = await Order.aggregate([
        { $match: dateFilter },
        { $unwind: '$items' },
        { $unwind: { path: '$items.options', preserveNullAndEmptyArrays: true } },
        { $match: { 'items.options': { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$items.options.name',
            quantity: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.quantity', '$items.options.price'] } }
          }
        },
        { $sort: { quantity: -1 } },
        { $limit: 10 }
      ]);
      
      // Formatando resultado
      const optionRanking = topOptions.map(item => ({
        optionName: item._id,
        quantity: item.quantity,
        revenue: item.revenue
      }));
      
      // Produtos disponíveis vs. produtos vendidos
      const totalProducts = await Catalog.countDocuments({
        tenantId,
        available: true
      });
      
      const productsSold = new Set(productRanking.map(p => p.productId)).size;
      
      return {
        period: {
          start: startDate,
          end: endDate
        },
        summary: {
          totalProducts,
          productsSold,
          notSoldPercentage: totalProducts > 0 
            ? ((totalProducts - productsSold) / totalProducts * 100).toFixed(2) 
            : 0
        },
        productRanking,
        categoryRanking,
        optionRanking
      };
    } catch (error) {
      logger.error(`Erro ao gerar relatório de produtos para tenant ${tenantId}:`, error);
      throw new Error('Erro ao gerar relatório de produtos');
    }
  },
  
  /**
   * Gera relatório de clientes
   * @param {string} tenantId - ID do tenant
   * @param {Date} startDate - Data inicial
   * @param {Date} endDate - Data final
   * @returns {Promise<Object>} Relatório de clientes
   */
  generateCustomersReport: async (tenantId, startDate, endDate) => {
    try {
      // Filtro de período
      const dateFilter = {
        tenantId,
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      };
      
      // Clientes mais frequentes
      const topCustomers = await Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              phone: '$customer.phone',
              name: '$customer.name'
            },
            orderCount: { $sum: 1 },
            totalSpent: { $sum: '$total' },
            lastOrder: { $max: '$createdAt' }
          }
        },
        { $sort: { orderCount: -1 } },
        { $limit: 20 }
      ]);
      
      // Formatando resultado
      const customerRanking = topCustomers.map(item => ({
        phone: item._id.phone,
        name: item._id.name,
        orderCount: item.orderCount,
        totalSpent: item.totalSpent,
        averageTicket: item.totalSpent / item.orderCount,
        lastOrder: item.lastOrder
      }));
      
      // Total de clientes únicos
      const uniqueCustomers = await Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$customer.phone',
            name: { $first: '$customer.name' },
            firstOrder: { $min: '$createdAt' }
          }
        },
        { $count: 'total' }
      ]);
      
      const totalUniqueCustomers = uniqueCustomers.length > 0 ? uniqueCustomers[0].total : 0;
      
      // Distribuição por número de pedidos
      const orderFrequency = await Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$customer.phone',
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$count',
            customers: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      
      // Formatando resultado
      const frequencyDistribution = orderFrequency.map(item => ({
        orderCount: item._id,
        customerCount: item.customers
      }));
      
      // Clientes com interações no bot
      const customersWithChat = await Conversation.aggregate([
        { 
          $match: { 
            tenantId,
            updatedAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$phone',
            messageCount: { $sum: { $size: '$messages' } },
            lastInteraction: { $max: '$updatedAt' }
          }
        },
        { $sort: { messageCount: -1 } },
        { $limit: 20 }
      ]);
      
      // Cruzar dados de chat com pedidos
      const customerEngagement = await Promise.all(
        customersWithChat.map(async (customer) => {
          const orders = await Order.find({
            tenantId,
            'customer.phone': customer._id,
            createdAt: { $gte: startDate, $lte: endDate }
          }).select('orderNumber total createdAt');
          
          return {
            phone: customer._id,
            messageCount: customer.messageCount,
            orderCount: orders.length,
            totalSpent: orders.reduce((sum, order) => sum + order.total, 0),
            lastInteraction: customer.lastInteraction
          };
        })
      );
      
      return {
        period: {
          start: startDate,
          end: endDate
        },
        summary: {
          uniqueCustomers: totalUniqueCustomers
        },
        customerRanking,
        frequencyDistribution,
        customerEngagement
      };
    } catch (error) {
      logger.error(`Erro ao gerar relatório de clientes para tenant ${tenantId}:`, error);
      throw new Error('Erro ao gerar relatório de clientes');
    }
  }
};

module.exports = reportService;