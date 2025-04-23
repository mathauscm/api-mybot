const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticateJwt, authenticateApiKey, authorize } = require('../middleware/auth');
const tenantResolver = require('../middleware/tenantResolver');
const { validate, validators } = require('../utils/validator');

// Rotas públicas (com autenticação de API key)
router.get('/:tenantId', 
  authenticateApiKey,
  tenantResolver,
  categoryController.getCategories
);

// Rotas administrativas (com autenticação JWT)
router.use(authenticateJwt);
router.use(authorize('admin', 'super-admin'));

// Criar categoria
router.post('/', 
  validate(validators.category),
  categoryController.createCategory
);

// Obter categoria por ID
router.get('/detail/:id', categoryController.getCategoryById);

// Atualizar categoria
router.put('/:id', 
  validate(validators.category),
  categoryController.updateCategory
);

// Ativar/desativar categoria
router.patch('/:id/toggle-status', categoryController.toggleCategoryStatus);

// Reordenar categorias
router.put('/reorder', categoryController.reorderCategories);

// Excluir categoria
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;