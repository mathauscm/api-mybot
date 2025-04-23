const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/catalogController');
const { authenticateJwt, authenticateApiKey, authorize } = require('../middleware/auth');
const tenantResolver = require('../middleware/tenantResolver');
const { validate, validators } = require('../utils/validator');

// Rotas públicas (com autenticação de API key)
router.get('/:tenantId', 
  authenticateApiKey,
  tenantResolver,
  catalogController.getProducts
);

router.get('/:tenantId/category/:categoryId', 
  authenticateApiKey,
  tenantResolver,
  catalogController.getProductsByCategory
);

router.get('/:tenantId/product/:productId', 
  authenticateApiKey,
  tenantResolver,
  catalogController.getProductById
);

// Rotas administrativas (com autenticação JWT)
router.use(authenticateJwt);
router.use(authorize('admin', 'super-admin'));

// Criar produto
router.post('/', 
  validate(validators.product),
  catalogController.createProduct
);

// Obter produtos para administração
router.get('/', catalogController.getAdminProducts);

// Obter produto por ID para administração
router.get('/detail/:id', catalogController.getAdminProductById);

// Atualizar produto
router.put('/:id', 
  validate(validators.product),
  catalogController.updateProduct
);

// Ativar/desativar produto
router.patch('/:id/toggle-status', catalogController.toggleProductStatus);

// Excluir produto
router.delete('/:id', catalogController.deleteProduct);

module.exports = router;