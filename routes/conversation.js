const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const { authenticateJwt, authenticateApiKey, authorize } = require('../middleware/auth');
const tenantResolver = require('../middleware/tenantResolver');
const { validate, validators } = require('../utils/validator');

// Rotas públicas (com autenticação de API key)
router.post('/:tenantId/message', 
  authenticateApiKey,
  tenantResolver,
  validate(validators.message),
  conversationController.processMessage
);

// Rotas administrativas (com autenticação JWT)
router.use(authenticateJwt);
router.use(authorize('admin', 'staff', 'super-admin'));

// Obter todas as conversas
router.get('/', conversationController.getAllConversations);

// Obter conversa por telefone
router.get('/phone/:phone', conversationController.getConversationByPhone);

// Obter estatísticas de conversas
router.get('/stats', conversationController.getConversationStats);

// Enviar mensagem para cliente
router.post('/send/:phone', 
  validate(validators.message),
  conversationController.sendMessageToPhone
);

module.exports = router;