const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const tenantRoutes = require('./tenant');
const categoryRoutes = require('./category');
const catalogRoutes = require('./catalog');
const productOptionRoutes = require('./productOption');
const orderRoutes = require('./order');
const conversationRoutes = require('./conversation');

// Mount all routes
router.use('/auth', authRoutes);
router.use('/tenants', tenantRoutes);
router.use('/categories', categoryRoutes);
router.use('/catalog', catalogRoutes);
router.use('/options', productOptionRoutes);
router.use('/orders', orderRoutes);
router.use('/conversations', conversationRoutes);

// API status endpoint
router.get('/status', (req, res) => {
  res.json({
    status: 'online',
    version: require('../package.json').version,
    timestamp: new Date()
  });
});

module.exports = router;