const Joi = require('joi');

// Validadores para diferentes entidades
const validators = {
  // Tenant
  tenant: Joi.object({
    name: Joi.string().required().trim(),
    slug: Joi.string().required().trim().lowercase(),
    contact: Joi.object({
      email: Joi.string().email().required(),
      phone: Joi.string(),
      address: Joi.string()
    }),
    planType: Joi.string().valid('free', 'basic', 'premium', 'enterprise'),
    settings: Joi.object({
      theme: Joi.string(),
      logo: Joi.string().uri(),
      primaryColor: Joi.string(),
      features: Joi.object({
        whatsappIntegration: Joi.boolean(),
        customDomain: Joi.boolean()
      })
    })
  }),
  
  // User
  user: Joi.object({
    tenantId: Joi.string().required(),
    name: Joi.string().required().trim(),
    email: Joi.string().email().required().trim().lowercase(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('admin', 'staff', 'super-admin')
  }),
  
  // Login
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),
  
  // Category
  category: Joi.object({
    name: Joi.string().required().trim(),
    slug: Joi.string().required().trim(),
    description: Joi.string().allow('', null),
    order: Joi.number().default(0),
    active: Joi.boolean().default(true)
  }),
  
  // Product
  product: Joi.object({
    name: Joi.string().required().trim(),
    description: Joi.string().allow('', null),
    price: Joi.number().when('productType', {
      is: Joi.string().valid('standard', 'hamburger'),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    image: Joi.string().uri().allow('', null),
    available: Joi.boolean().default(true),
    category: Joi.string().required(),
    productType: Joi.string().valid('standard', 'pizza', 'hamburger').default('standard'),
    sizesPrices: Joi.when('productType', {
      is: 'pizza',
      then: Joi.array().items(
        Joi.object({
          sizeId: Joi.string().required(),
          sizeName: Joi.string().required(),
          price: Joi.number().required()
        })
      ).min(1).required(),
      otherwise: Joi.array().optional()
    })
  }),
  
  // Product Option
  productOption: Joi.object({
    type: Joi.string().valid('pizza-size', 'pizza-crust', 'burger-addon').required(),
    name: Joi.string().required().trim(),
    description: Joi.string().allow('', null),
    price: Joi.number().default(0),
    maxQuantity: Joi.number().default(15),
    slices: Joi.when('type', {
      is: 'pizza-size',
      then: Joi.number().required(),
      otherwise: Joi.forbidden()
    }),
    order: Joi.number().default(0),
    active: Joi.boolean().default(true)
  }),
  
  // Order
  order: Joi.object({
    customer: Joi.object({
      name: Joi.string().required(),
      phone: Joi.string().required(),
      address: Joi.string().required()
    }).required(),
    items: Joi.array().items(
      Joi.object({
        productId: Joi.string(),
        name: Joi.string(),
        flavor: Joi.string(),
        quantity: Joi.number().integer().min(1).required(),
        unitPrice: Joi.number().required(),
        options: Joi.array().items(
          Joi.object({
            name: Joi.string().required(),
            price: Joi.number().required()
          })
        )
      })
    ).min(1).required(),
    paymentMethod: Joi.string().valid('pix', 'credit-card', 'cash').required(),
    changeFor: Joi.when('paymentMethod', {
      is: 'cash',
      then: Joi.number().optional(),
      otherwise: Joi.forbidden()
    }),
    deliveryFee: Joi.number().default(0),
    notes: Joi.string().allow('', null)
  }),
  
  // Order Status Update
  orderStatus: Joi.object({
    status: Joi.string().valid('pending', 'confirmed', 'preparing', 'delivering', 'completed', 'cancelled').required()
  }),
  
  // Message
  message: Joi.object({
    phone: Joi.string().required(),
    message: Joi.string().required()
  })
};

// Middleware de validação
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        error: 'Erro de validação',
        details: error.details.map(detail => detail.message)
      });
    }
    
    next();
  };
};

module.exports = {
  validators,
  validate
};