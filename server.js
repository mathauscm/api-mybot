const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Load environment variables
dotenv.config();

// Import configurations and utilities
const config = require('./config/config');
const connectDB = require('./config/database');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Create Express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware
if (config.env === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Muitas requisições, tente novamente mais tarde.' }
});

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tenants', require('./routes/tenant'));
app.use('/api/categories', require('./routes/category'));
app.use('/api/catalog', require('./routes/catalog'));
app.use('/api/options', require('./routes/productOption'));
app.use('/api/orders', require('./routes/order'));
app.use('/api/conversations', require('./routes/conversation'));

// Base route for API status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    version: require('./package.json').version,
    environment: config.env
  });
});

// Error handler
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, config.host, () => {
  logger.info(`Servidor rodando em ${config.env} na porta ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  // Close server & exit process
  // process.exit(1);
});

module.exports = app; // For testing