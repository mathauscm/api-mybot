const Conversation = require('../models/conversation');
const Tenant = require('../models/tenant');
const logger = require('../utils/logger');
const axios = require('axios'); // Você precisará adicionar esta dependência

/**
 * Serviço para gerenciamento do bot
 */
const botService = {
  /**
   * Processa mensagem do cliente
   * @param {string} tenantId - ID do tenant
   * @param {string} phone - Número de telefone do cliente
   * @param {string} message - Mensagem recebida
   * @returns {Promise<string>} Resposta do bot
   */
  processMessage: async (tenantId, phone, message) => {
    try {
      logger.info(`Processando mensagem para tenant ${tenantId}, telefone ${phone}`);
      
      // Aqui você implementaria a lógica de processamento da mensagem
      // Poderia ser integração com ChatGPT, DialogFlow, ou outro serviço
      
      // Exemplo simples com respostas pré-definidas
      let response = '';
      
      const lowerMessage = message.toLowerCase();
      
      if (lowerMessage.includes('cardápio') || lowerMessage.includes('menu')) {
        response = 'Você pode ver nosso cardápio completo em nosso site ou digitar a categoria: Pizza, Hambúrguer, Bebidas';
      } else if (lowerMessage.includes('horário') || lowerMessage.includes('funcionamento')) {
        response = 'Estamos abertos de terça a domingo, das 18h às 23h.';
      } else if (lowerMessage.includes('entrega') || lowerMessage.includes('delivery')) {
        response = 'Fazemos entregas em até 45 minutos para a região central. Taxa de entrega a partir de R$ 5,00.';
      } else if (lowerMessage.includes('olá') || lowerMessage.includes('oi') || lowerMessage.includes('bom dia') || lowerMessage.includes('boa tarde') || lowerMessage.includes('boa noite')) {
        response = `Olá! Bem-vindo ao nosso atendimento. Como posso ajudar?`;
      } else {
        response = 'Não entendi sua mensagem. Por favor, tente novamente ou escolha uma das opções: Cardápio, Horários, Entrega ou Pedido.';
      }
      
      return response;
    } catch (error) {
      logger.error(`Erro ao processar mensagem para tenant ${tenantId}:`, error);
      return 'Desculpe, houve um erro no processamento da sua mensagem. Por favor, tente novamente mais tarde.';
    }
  },
  
  /**
   * Envia mensagem para o cliente
   * @param {string} tenantId - ID do tenant
   * @param {string} phone - Número de telefone do cliente
   * @param {string} message - Mensagem a ser enviada
   * @returns {Promise<boolean>} Status do envio
   */
  sendMessage: async (tenantId, phone, message) => {
    try {
      logger.info(`Enviando mensagem para tenant ${tenantId}, telefone ${phone}`);
      
      // Buscar tenant para obter configurações específicas
      const tenant = await Tenant.findById(tenantId);
      
      if (!tenant) {
        logger.error(`Tenant ${tenantId} não encontrado ao enviar mensagem`);
        return false;
      }
      
      // Aqui você implementaria a integração com WhatsApp, Telegram, ou outro serviço
      // usando as configurações específicas do tenant
      
      // Exemplo de integração com API de terceiros
      // As configurações poderiam vir do tenant.settings.whatsappIntegration
      
      // Simulando envio
      // Em produção, você faria uma chamada para um serviço real
      // const response = await axios.post('https://api.whatsapp.com/send', {
      //   phone,
      //   message,
      //   apiKey: tenant.settings.whatsappApiKey // Configuração específica do tenant
      // });
      
      // return response.status === 200;
      
      // Por enquanto, apenas simulamos que o envio foi bem-sucedido
      return true;
    } catch (error) {
      logger.error(`Erro ao enviar mensagem para ${phone} (tenant ${tenantId}):`, error);
      return false;
    }
  },
  
  /**
   * Notifica o proprietário sobre um novo pedido
   * @param {string} tenantId - ID do tenant
   * @param {Object} order - Pedido criado
   * @returns {Promise<boolean>} Status da notificação
   */
  notifyNewOrder: async (tenantId, order) => {
    try {
      // Buscar o tenant para obter o número de contato do admin
      const tenant = await Tenant.findById(tenantId);
      
      if (!tenant) {
        logger.error(`Tenant ${tenantId} não encontrado ao notificar novo pedido`);
        return false;
      }
      
      // Usar o número de contato do tenant ou configuração específica
      const adminPhone = tenant.contact.phone;
      
      // Verificar se existe um número de contato válido
      if (!adminPhone) {
        logger.error(`Tenant ${tenantId} não possui número de contato para notificações`);
        return false;
      }
      
      const message = `🔔 NOVO PEDIDO 🔔
Número: ${order.orderNumber}
Cliente: ${order.customer.name}
Valor: R$ ${order.total.toFixed(2)}
Status: Pendente

Digite "ver ${order.orderNumber}" para detalhes`;
      
      return await botService.sendMessage(tenantId, adminPhone, message);
    } catch (error) {
      logger.error(`Erro ao notificar novo pedido para tenant ${tenantId}:`, error);
      return false;
    }
  },
  
  /**
   * Notifica o cliente sobre uma mudança de status no pedido
   * @param {string} tenantId - ID do tenant
   * @param {Object} order - Pedido atualizado
   * @returns {Promise<boolean>} Status da notificação
   */
  notifyStatusChange: async (tenantId, order) => {
    try {
      // Buscar o tenant para verificar configurações específicas
      const tenant = await Tenant.findById(tenantId);
      
      if (!tenant) {
        logger.error(`Tenant ${tenantId} não encontrado ao notificar mudança de status`);
        return false;
      }
      
      // As mensagens de status também poderiam ser personalizadas por tenant
      // Aqui usamos mensagens padrão para simplificar
      const statusMessages = {
        'confirmed': 'Seu pedido foi confirmado e está sendo preparado.',
        'preparing': 'Seu pedido está sendo preparado na cozinha.',
        'delivering': 'Seu pedido saiu para entrega! Chega em breve.',
        'completed': 'Seu pedido foi entregue. Bom apetite! Agradecemos a preferência.',
        'cancelled': 'Seu pedido foi cancelado. Entre em contato para mais informações.'
      };
      
      const message = `🔔 ATUALIZAÇÃO DE PEDIDO 🔔
Número: ${order.orderNumber}
Status: ${order.status}

${statusMessages[order.status] || ''}`;
      
      return await botService.sendMessage(tenantId, order.customer.phone, message);
    } catch (error) {
      logger.error(`Erro ao notificar mudança de status para pedido ${order.orderNumber}:`, error);
      return false;
    }
  }
};

module.exports = botService;