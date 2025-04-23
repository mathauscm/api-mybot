const express = require('express');
const router = express.Router();
const productOptionController = require('../controllers/productOptionController');
const { authenticateJwt, authenticateApiKey, authorize } = require('../middleware/auth');
const tenantResolver = require('../middleware/tenantResolver');
const { validate, validators } = require('../utils/validator');

// Rotas públicas (com autenticação de API key)
router.get('/:tenantId/:type', 
  authenticateApiKey,
  tenantResolver,
  productOptionController.getOptionsByType
);

// Rotas administrativas (com autenticação JWT)
router.use(authenticateJwt);
router.use(authorize('admin', 'super-admin'));

// Obter todos as opções
router.get('/', productOptionController.getAllOptions);

// Obter opções por tipo
router.get('/type/:type', productOptionController.getAdminOptionsByType);

// Obter opção por ID
router.get('/:id', productOptionController.getOptionById);

// Criar nova opção
router.post('/', 
  validate(validators.productOption),
  productOptionController.createOption
);

// Atualizar opção
router.put('/:id', 
  validate(validators.productOption),
  productOptionController.updateOption
);

// Ativar/desativar opção
router.patch('/:id/toggle-status', productOptionController.toggleOptionStatus);

// Reordenar opções
router.put('/reorder', productOptionController.reorderOptions);

// Excluir opção
router.delete('/:id', productOptionController.deleteOption);

module.exports = router;