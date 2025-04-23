const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateJwt, authenticateApiKey, authorize } = require('../middleware/auth');
const tenantResolver = require('../middleware/tenantResolver');
const { validate, validators } = require('../utils/validator');

// Rotas públicas (com autenticação de API key)
router.post('/:tenantId', 
  authenticateApiKey,
  tenantResolver,
  validate(validators.order),
  orderController.createOrder
);

router.get('/:tenantId/status/:orderNumber', 
  authenticateApiKey,
  tenantResolver,
  orderController.getOrderStatus
);

router.post('/:tenantId/rate/:orderNumber', 
  authenticateApiKey,
  tenantResolver,
  orderController.rateOrder
);

// Rotas administrativas (com autenticação JWT)
router.use(authenticateJwt);
router.use(authorize('admin', 'staff', 'super-admin'));

// Obter todos os pedidos
router.get('/', orderController.getAllOrders);

// Obter pedido por ID
router.get('/:id', orderController.getOrderById);

// Atualizar status do pedido
router.patch('/:id/status', 
  validate(validators.orderStatus),
  orderController.updateOrderStatus
);

// Adicionar observação ao pedido
router.patch('/:id/notes', orderController.addOrderNote);

// Obter estatísticas de pedidos
router.get('/stats/overview', orderController.getOrderStats);

module.exports = router;