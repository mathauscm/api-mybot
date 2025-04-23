const jwt = require('jsonwebtoken');
const User = require('../models/user');
const config = require('../config/config');
const logger = require('../utils/logger');

// Login de usuário
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Verificar se o usuário existe
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    // Verificar se o usuário está ativo
    if (!user.active) {
      return res.status(401).json({ error: 'Conta desativada. Entre em contato com o administrador.' });
    }
    
    // Verificar senha
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    // Criar token JWT
    const token = jwt.sign(
      { id: user._id, role: user.role, tenantId: user.tenantId },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    // Atualizar último login
    user.lastLogin = Date.now();
    await user.save();
    
    // Responder com usuário e token
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId
      }
    });
  } catch (error) {
    logger.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro ao processar login' });
  }
};

// Registro de usuário (admin only)
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    // Verificar se usuário já existe
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'Email já está em uso' });
    }
    
    // Verificar permissões para criação de super-admin
    if (role === 'super-admin' && req.user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Sem permissão para criar super-admin' });
    }
    
    // Criar novo usuário
    const user = new User({
      name,
      email,
      password,
      role: role || 'staff',
      tenantId: req.tenantId
    });
    
    await user.save();
    
    res.status(201).json({
      message: 'Usuário criado com sucesso',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro ao registrar usuário' });
  }
};

// Obter usuário atual
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json({ user });
  } catch (error) {
    logger.error('Erro ao obter perfil:', error);
    res.status(500).json({ error: 'Erro ao buscar informações do usuário' });
  }
};

// Atualizar perfil
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // Verificar se email já está em uso por outro usuário
    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (existingUser) {
        return res.status(400).json({ error: 'Email já está em uso' });
      }
    }
    
    // Atualizar usuário
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { name, email } },
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json({
      message: 'Perfil atualizado com sucesso',
      user: updatedUser
    });
  } catch (error) {
    logger.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
};

// Alterar senha
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }
    
    const user = await User.findById(req.user.id);
    
    // Verificar senha atual
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }
    
    // Atualizar senha
    user.password = newPassword;
    await user.save();
    
    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    logger.error('Erro ao alterar senha:', error);
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
};

// Recuperar senha (enviar email com token)
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
      // Por segurança, não informamos que o usuário não existe
      return res.json({ message: 'Se um usuário com esse email existir, um link para redefinição de senha será enviado.' });
    }
    
    // TODO: Implementar envio de email com token
    // Por enquanto, apenas simula o processo
    
    res.json({ message: 'Se um usuário com esse email existir, um link para redefinição de senha será enviado.' });
  } catch (error) {
    logger.error('Erro no processo de recuperação de senha:', error);
    res.status(500).json({ error: 'Erro ao processar solicitação de recuperação de senha' });
  }
};

// Redefinir senha com token
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
    }
    
    // TODO: Implementar verificação de token e redefinição de senha
    // Por enquanto, apenas simula o processo
    
    res.json({ message: 'Senha redefinida com sucesso' });
  } catch (error) {
    logger.error('Erro ao redefinir senha:', error);
    res.status(500).json({ error: 'Erro ao redefinir senha' });
  }
};