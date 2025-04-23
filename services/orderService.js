const Order = require('../models/order');
const Catalog = require('../models/catalog');
const ProductOption = require('../models/productOption');
const logger = require('../utils/logger');

/**
 * Serviço para gerenciamento de pedidos
 */
const orderService = {
  /**
   * Cria um novo pedido
   * @param {string} tenantId - ID do tenant
   * @param {Object} orderData - Dados do pedido
   * @returns {Promise<Object>} Pedido criado
   */
  createOrder: async (tenantId, orderData) => {
    try {
      // Validação de dados
      if (!orderData.items || orderData.items.length === 0) {
        throw { 
          type: 'validation', 
          message: 'Pedido deve conter pelo menos um item',
          details: ['items']
        };
      }
      
      if (!orderData.customer || !orderData.customer.name || !orderData.customer.phone) {
        throw { 
          type: 'validation', 
          message: 'Dados do cliente incompletos',
          details: ['customer']
        };
      }
      
      // Verificar e calcular valores dos itens
      let subtotal = 0;
      
      // Processar cada item do pedido
      for (let item of orderData.items) {
        // Se tiver productId, verificar se o produto existe e está disponível
        if (item.productId) {
          const product = await Catalog.findOne({
            _id: item.productId,
            tenantId,
            available: true
          });
          
          if (!product) {
            throw { 
              type: 'validation', 
              message: `Produto ${item.name} não encontrado ou indisponível`,
              details: ['items']
            };
          }
          
          // Se for pizza com tamanho específico
          if (product.productType === 'pizza' && item.options && item.options.length > 0) {
            const sizeOption = item.options.find(opt => 
              opt.name.toLowerCase().includes('tamanho') || 
              opt.name.toLowerCase().includes('tam') || 
              opt.name.toLowerCase().includes('size')
            );
            
            if (sizeOption) {
              // Verificar se o tamanho existe nas opções do produto
              const sizeExists = product.sizesPrices.some(sp => 
                sp.sizeName.toLowerCase() === sizeOption.name.toLowerCase()
              );
              
              if (!sizeExists) {
                throw { 
                  type: 'validation', 
                  message: `Tamanho de pizza inválido: ${sizeOption.name}`,
                  details: ['items.options']
                };
              }
            }
          }
        }
        
        // Calcular subtotal do item
        const itemTotal = item.quantity * item.unitPrice;
        
        // Adicionar extras/opções
        let optionsTotal = 0;
        if (item.options && item.options.length > 0) {
          optionsTotal = item.options.reduce((sum, opt) => sum + (opt.price || 0), 0) * item.quantity;
        }
        
        subtotal += itemTotal + optionsTotal;
      }
      
      // Calcular total
      const deliveryFee = orderData.deliveryFee || 0;
      const total = subtotal + deliveryFee;
      
      // Gerar número de pedido
      const orderNumber = await Order.generateOrderNumber(tenantId);
      
      // Criar o pedido
      const order = new Order({
        tenantId,
        orderNumber,
        status: 'pending',
        customer: orderData.customer,
        items: orderData.items,
        paymentMethod: orderData.paymentMethod,
        changeFor: orderData.changeFor,
        deliveryFee,
        subtotal,
        total,
        notes: orderData.notes
      });
      
      await order.save();
      
      return order;
    } catch (error) {
      logger.error(`Erro ao criar pedido para tenant ${tenantId}:`, error);
      throw error;
    }
  },
  
  /**
   * Atualiza o status de um pedido
   * @param {string} tenantId - ID do tenant
   * @param {string} orderId - ID do pedido
   * @param {string} status - Novo status
   * @returns {Promise<Object>} Pedido atualizado
   */
  updateOrderStatus: async (tenantId, orderId, status) => {
    try {
      const order = await Order.findOne({
        _id: orderId,
        tenantId
      });
      
      if (!order) {
        throw new Error('Pedido não encontrado');
      }
      
      // Validar transição de status
      const validTransitions = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['preparing', 'cancelled'],
        'preparing': ['delivering', 'completed', 'cancelled'],
        'delivering': ['completed', 'cancelled'],
        'completed': [],
        'cancelled': []
      };
      
      if (!validTransitions[order.status].includes(status)) {
        throw new Error(`Não é possível alterar o status de '${order.status}' para '${status}'`);
      }
      
      // Atualizar status
      order.status = status;
      await order.save();
      
      return order;
    } catch (error) {
      logger.error(`Erro ao atualizar status do pedido ${orderId}:`, error);
      throw error;
    }
  },
  
  /**
   * Obtém estatísticas de pedidos
   * @param {string} tenantId - ID do tenant
   * @param {Date} startDate - Data inicial
   * @param {Date} endDate - Data final
   * @returns {Promise<Object>} Estatísticas de pedidos
   */
  getOrderStatistics: async (tenantId, startDate, endDate) => {
    try {
      // Filtro de período
      const dateFilter = {
        tenantId,
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      };
      
      // Total de pedidos
      const totalOrders = await Order.countDocuments(dateFilter);
      
      // Pedidos por status
      const ordersByStatus = await Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            total: { $sum: '$total' }
          }
        }
      ]);
      
      // Formatar resultado
      const statusStats = {};
      ordersByStatus.forEach(item => {
        statusStats[item._id] = {
          count: item.count,
          total: item.total
        };
      });
      
      // Valor médio dos pedidos
      const averageTicket = await Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            average: { $avg: '$total' }
          }
        }
      ]);
      
      // Total de vendas
      const totalSales = await Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            total: { $sum: '$total' }
          }
        }
      ]);
      
      return {
        period: {
          start: startDate,
          end: endDate
        },
        totalOrders,
        byStatus: statusStats,
        averageTicket: averageTicket.length > 0 ? averageTicket[0].average : 0,
        totalSales: totalSales.length > 0 ? totalSales[0].total : 0
      };
    } catch (error) {
      logger.error(`Erro ao gerar estatísticas para tenant ${tenantId}:`, error);
      throw error;
    }
  }
};

module.exports = orderService;