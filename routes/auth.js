const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate, validators } = require('../utils/validator');
const { authenticateJwt, authorize } = require('../middleware/auth');

// Login de usuário
router.post('/login', validate(validators.login), authController.login);

// Registro de usuário (apenas admin pode criar novos usuários)
router.post('/register', 
  authenticateJwt, 
  authorize('admin', 'super-admin'), 
  validate(validators.user), 
  authController.register
);

// Obter perfil do usuário autenticado
router.get('/me', authenticateJwt, authController.getCurrentUser);

// Atualizar perfil do usuário
router.put('/me', authenticateJwt, authController.updateProfile);

// Alterar senha
router.put('/change-password', authenticateJwt, authController.changePassword);

// Recuperar senha (enviar email com token)
router.post('/forgot-password', authController.forgotPassword);

// Redefinir senha com token
router.post('/reset-password', authController.resetPassword);

// Verificar validade do token JWT
router.get('/verify-token', authenticateJwt, (req, res) => {
  res.status(200).json({ valid: true, user: req.user });
});

module.exports = router;