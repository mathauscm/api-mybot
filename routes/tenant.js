const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const { authenticateJwt, authorize } = require('../middleware/auth');
const { validate, validators } = require('../utils/validator');

// Rotas protegidas por JWT - apenas super-admin pode gerenciar tenants
router.use(authenticateJwt);
router.use(authorize('super-admin'));

// Obter todos os tenants
router.get('/', tenantController.getAllTenants);

// Obter tenant específico
router.get('/:id', tenantController.getTenantById);

// Criar novo tenant
router.post('/', validate(validators.tenant), tenantController.createTenant);

// Atualizar tenant
router.put('/:id', validate(validators.tenant), tenantController.updateTenant);

// Ativar/desativar tenant
router.patch('/:id/toggle-status', tenantController.toggleTenantStatus);

// Gerar nova API key
router.post('/:id/generate-api-key', tenantController.generateApiKey);

module.exports = router;