const Order = require('../models/order');
const orderService = require('../services/orderService');
const botService = require('../services/botService');
const logger = require('../utils/logger');

// Criar novo pedido (cliente)
exports.createOrder = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const orderData = req.body;
    
    // Usar service para criar o pedido (validação e processamento)
    const order = await orderService.createOrder(tenantId, orderData);
    
    // Notificar proprietário sobre novo pedido
    await botService.notifyNewOrder(tenantId, order);
    
    res.status(201).json({
      message: 'Pedido criado com sucesso',
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total
      }
    });
  } catch (error) {
    logger.error(`Erro ao criar pedido para tenant ${req.tenant._id}:`, error);
    
    // Erros específicos do serviço
    if (error.type === 'validation') {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    res.status(500).json({ error: 'Erro ao processar pedido' });
  }
};

// Consultar status do pedido
exports.getOrderStatus = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const orderNumber = req.params.orderNumber;
    
    const order = await Order.findOne({
      tenantId,
      orderNumber
    }).select('orderNumber status customer.name createdAt updatedAt');
    
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    
    res.json({ order });
  } catch (error) {
    logger.error(`Erro ao buscar status do pedido ${req.params.orderNumber}:`, error);
    res.status(500).json({ error: 'Erro ao buscar status do pedido' });
  }
};

// Avaliar pedido
exports.rateOrder = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const orderNumber = req.params.orderNumber;
    const { rating, comment } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Avaliação deve ser um número entre 1 e 5' });
    }
    
    const order = await Order.findOne({
      tenantId,
      orderNumber
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    
    // Verificar se pedido pode ser avaliado
    if (order.status !== 'completed') {
      return res.status(400).json({ error: 'Apenas pedidos entregues podem ser avaliados' });
    }
    
    // Atualizar avaliação
    order.rating = rating;
    
    // Adicionar comentário nas observações, se fornecido
    if (comment) {
      const noteText = `Avaliação do cliente: ${comment}`;
      order.notes = order.notes 
        ? `${order.notes}\n${noteText}` 
        : noteText;
    }
    
    await order.save();
    
    res.json({
      message: 'Pedido avaliado com sucesso',
      rating: order.rating
    });
  } catch (error) {
    logger.error(`Erro ao avaliar pedido ${req.params.orderNumber}:`, error);
    res.status(500).json({ error: 'Erro ao registrar avaliação' });
  }
};

// ==== ROTAS ADMINISTRATIVAS ====

// Obter todos os pedidos
exports.getAllOrders = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    // Opções de filtro
    const filter = { tenantId };
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.phone) {
      filter['customer.phone'] = req.query.phone;
    }
    
    if (req.query.dateFrom) {
      filter.createdAt = { $gte: new Date(req.query.dateFrom) };
    }
    
    if (req.query.dateTo) {
      if (filter.createdAt) {
        filter.createdAt.$lte = new Date(req.query.dateTo);
      } else {
        filter.createdAt = { $lte: new Date(req.query.dateTo) };
      }
    }
    
    // Paginação
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Ordenação
    const sort = { createdAt: -1 }; // Por padrão, mais recentes primeiro
    
    // Executar consulta
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit),
      
      Order.countDocuments(filter)
    ]);
    
    res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error(`Erro ao listar pedidos para tenant ${req.user.tenantId}:`, error);
    res.status(500).json({ error: 'Erro ao buscar pedidos' });
  }
};

// Obter pedido por ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    
    res.json({ order });
  } catch (error) {
    logger.error(`Erro ao buscar pedido ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao buscar pedido' });
  }
};

// Atualizar status do pedido
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const tenantId = req.user.tenantId;
    
    const order = await Order.findOne({
      _id: req.params.id,
      tenantId
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
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
      return res.status(400).json({ 
        error: `Não é possível alterar o status de '${order.status}' para '${status}'`
      });
    }
    
    // Atualizar status
    order.status = status;
    await order.save();
    
    // Notificar cliente sobre mudança de status
    await botService.notifyStatusChange(tenantId, order);
    
    res.json({
      message: 'Status do pedido atualizado com sucesso',
      status: order.status
    });
  } catch (error) {
    logger.error(`Erro ao atualizar status do pedido ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao atualizar status do pedido' });
  }
};

// Adicionar observação ao pedido
exports.addOrderNote = async (req, res) => {
  try {
    const { note } = req.body;
    
    if (!note) {
      return res.status(400).json({ error: 'Observação não pode ser vazia' });
    }
    
    const order = await Order.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    
    // Adicionar observação
    const timestamp = new Date().toISOString();
    const noteWithTimestamp = `[${timestamp}] ${req.user.name}: ${note}`;
    
    if (order.notes) {
      order.notes = `${order.notes}\n${noteWithTimestamp}`;
    } else {
      order.notes = noteWithTimestamp;
    }
    
    await order.save();
    
    res.json({
      message: 'Observação adicionada com sucesso',
      notes: order.notes
    });
  } catch (error) {
    logger.error(`Erro ao adicionar observação ao pedido ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao adicionar observação' });
  }
};

// Obter estatísticas de pedidos
exports.getOrderStats = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    // Período: hoje, semana, mês ou personalizado
    const period = req.query.period || 'today';
    let startDate, endDate = new Date();
    
    switch (period) {
      case 'today':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'custom':
        if (req.query.startDate) {
          startDate = new Date(req.query.startDate);
        } else {
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
        }
        
        if (req.query.endDate) {
          endDate = new Date(req.query.endDate);
        }
        break;
      default:
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
    }
    
    // Estatísticas gerais
    const stats = await orderService.getOrderStatistics(tenantId, startDate, endDate);
    
    res.json({ stats });
  } catch (error) {
    logger.error(`Erro ao obter estatísticas para tenant ${req.user.tenantId}:`, error);
    res.status(500).json({ error: 'Erro ao gerar estatísticas' });
  }
};