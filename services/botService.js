const Conversation = require('../models/conversation');
const botService = require('../services/botService');
const logger = require('../utils/logger');

// Processar mensagem de cliente (API pública)
exports.processMessage = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const { phone, message } = req.body;
    
    // Primeiro, armazenar a mensagem na conversa
    let conversation = await Conversation.findOne({ tenantId, phone });
    
    if (!conversation) {
      // Criar nova conversa se não existir
      conversation = new Conversation({
        tenantId,
        phone,
        messages: []
      });
    }
    
    // Adicionar mensagem do cliente
    conversation.messages.push({
      content: message,
      isFromBot: false
    });
    
    await conversation.save();
    
    // Processar mensagem com o serviço de bot
    const botResponse = await botService.processMessage(tenantId, phone, message);
    
    if (botResponse) {
      // Armazenar resposta do bot na conversa
      conversation.messages.push({
        content: botResponse,
        isFromBot: true
      });
      
      await conversation.save();
    }
    
    res.json({
      success: true,
      response: botResponse
    });
  } catch (error) {
    logger.error(`Erro ao processar mensagem para tenant ${req.tenant._id}:`, error);
    res.status(500).json({ error: 'Erro ao processar mensagem' });
  }
};

// ==== ROTAS ADMINISTRATIVAS ====

// Obter todas as conversas
exports.getAllConversations = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    // Paginação
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Ordenação: conversas mais recentes primeiro
    const sort = { updatedAt: -1 };
    
    // Executar consulta
    const [conversations, total] = await Promise.all([
      Conversation.find({ tenantId })
        .select('phone updatedAt messages')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      
      Conversation.countDocuments({ tenantId })
    ]);
    
    // Para cada conversa, pegar apenas as últimas 3 mensagens
    const conversationsWithLimitedMessages = conversations.map(conv => {
      const conversation = conv.toObject();
      
      // Limitar mensagens para preview
      if (conversation.messages.length > 3) {
        conversation.messages = conversation.messages.slice(-3);
        conversation.hasMoreMessages = true;
      } else {
        conversation.hasMoreMessages = false;
      }
      
      return conversation;
    });
    
    res.json({
      conversations: conversationsWithLimitedMessages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error(`Erro ao listar conversas para tenant ${req.user.tenantId}:`, error);
    res.status(500).json({ error: 'Erro ao buscar conversas' });
  }
};

// Obter conversa por telefone
exports.getConversationByPhone = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const phone = req.params.phone;
    
    const conversation = await Conversation.findOne({ tenantId, phone });
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }
    
    res.json({ conversation });
  } catch (error) {
    logger.error(`Erro ao buscar conversa do telefone ${req.params.phone}:`, error);
    res.status(500).json({ error: 'Erro ao buscar conversa' });
  }
};

// Obter estatísticas de conversas
exports.getConversationStats = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    // Período: hoje, semana, mês
    const period = req.query.period || 'week';
    let startDate = new Date();
    
    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
    
    // Total de conversas
    const totalConversations = await Conversation.countDocuments({ tenantId });
    
    // Conversas no período
    const conversationsInPeriod = await Conversation.countDocuments({
      tenantId,
      updatedAt: { $gte: startDate }
    });
    
    // Total de mensagens
    const conversations = await Conversation.find({ tenantId });
    let totalMessages = 0;
    let botMessages = 0;
    let userMessages = 0;
    
    conversations.forEach(conv => {
      totalMessages += conv.messages.length;
      
      conv.messages.forEach(msg => {
        if (msg.isFromBot) {
          botMessages++;
        } else {
          userMessages++;
        }
      });
    });
    
    // Responder com estatísticas
    res.json({
      stats: {
        totalConversations,
        conversationsInPeriod,
        totalMessages,
        botMessages,
        userMessages,
        avgMessagesPerConversation: totalConversations > 0 
          ? (totalMessages / totalConversations).toFixed(2) 
          : 0
      }
    });
  } catch (error) {
    logger.error(`Erro ao obter estatísticas de conversas para tenant ${req.user.tenantId}:`, error);
    res.status(500).json({ error: 'Erro ao gerar estatísticas de conversas' });
  }
};

// Enviar mensagem para telefone
exports.sendMessageToPhone = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const phone = req.params.phone;
    const { message } = req.body;
    
    // Verificar se conversa existe
    let conversation = await Conversation.findOne({ tenantId, phone });
    
    if (!conversation) {
      // Criar nova conversa
      conversation = new Conversation({
        tenantId,
        phone,
        messages: []
      });
    }
    
    // Adicionar mensagem do admin
    const adminMessage = {
      content: `[ADMIN: ${req.user.name}] ${message}`,
      isFromBot: true
    };
    
    conversation.messages.push(adminMessage);
    await conversation.save();
    
    // Enviar mensagem via serviço de bot
    const sent = await botService.sendMessage(tenantId, phone, message);
    
    res.json({
      success: sent,
      message: sent ? 'Mensagem enviada com sucesso' : 'Mensagem armazenada, mas falha ao enviar'
    });
  } catch (error) {
    logger.error(`Erro ao enviar mensagem para ${req.params.phone}:`, error);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
};