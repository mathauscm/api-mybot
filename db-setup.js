/**
 * db-setup.js - Script para definir todos os schemas e modelos do MongoDB
 * Execute este script uma vez para configurar o banco de dados:
 * node db-setup.js
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Configuração da conexão
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/apimybot', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB conectado com sucesso!');
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    process.exit(1);
  }
};

// ==== DEFINIÇÃO DOS SCHEMAS ====

// 1. TENANT (Cliente/Inquilino)
const TenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  apiKey: {
    type: String,
    required: true,
    unique: true
  },
  active: {
    type: Boolean,
    default: true
  },
  planType: {
    type: String,
    enum: ['free', 'basic', 'premium', 'enterprise'],
    default: 'basic'
  },
  contact: {
    email: {
      type: String,
      required: true
    },
    phone: String,
    address: String
  },
  settings: {
    theme: String,
    logo: String,
    primaryColor: String,
    features: {
      whatsappIntegration: {
        type: Boolean,
        default: true
      },
      customDomain: {
        type: Boolean,
        default: false
      }
    }
  }
}, {
  timestamps: true
});

// Método para verificar chave de API
TenantSchema.statics.findByApiKey = function(apiKey) {
  return this.findOne({ apiKey, active: true });
};

// 2. CATEGORY (Categorias)
const CategorySchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  order: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índices para melhorar consultas
CategorySchema.index({ tenantId: 1 });
CategorySchema.index({ tenantId: 1, slug: 1 });
CategorySchema.index({ tenantId: 1, order: 1 });

// 3. PRODUCT OPTION (Opções de produtos)
const ProductOptionSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  type: {
    type: String,
    enum: ['pizza-size', 'pizza-crust', 'burger-addon'],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    default: 0
  },
  maxQuantity: {
    type: Number,
    default: 15
  },
  slices: {
    type: Number
  },
  order: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índices para melhorar consultas
ProductOptionSchema.index({ tenantId: 1 });
ProductOptionSchema.index({ tenantId: 1, type: 1 });
ProductOptionSchema.index({ tenantId: 1, type: 1, order: 1 });

// 4. CATALOG (Produtos)
const SizesPriceSchema = new mongoose.Schema({
  sizeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductOption'
  },
  sizeName: String,
  price: Number
}, { _id: false });

const CatalogSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    default: 0
  },
  image: String,
  available: {
    type: Boolean,
    default: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  productType: {
    type: String,
    enum: ['standard', 'pizza', 'hamburger'],
    default: 'standard'
  },
  sizesPrices: [SizesPriceSchema]
}, {
  timestamps: true
});

// Índices para melhorar consultas
CatalogSchema.index({ tenantId: 1 });
CatalogSchema.index({ tenantId: 1, category: 1 });
CatalogSchema.index({ tenantId: 1, productType: 1 });
CatalogSchema.index({ tenantId: 1, available: 1 });

// 5. USER (Usuários)
const UserSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'staff', 'super-admin'],
    default: 'staff'
  },
  lastLogin: {
    type: Date
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Método pré-save para hash de senha
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar senha
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Índices para melhorar consultas
UserSchema.index({ email: 1 });
UserSchema.index({ tenantId: 1, role: 1 });

// 6. CONVERSATION (Conversas)
const MessageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  isFromBot: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const ConversationSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  messages: [MessageSchema]
}, {
  timestamps: true
});

// Índices para melhorar consultas
ConversationSchema.index({ tenantId: 1 });
ConversationSchema.index({ tenantId: 1, phone: 1 });
ConversationSchema.index({ tenantId: 1, updatedAt: -1 });

// 7. ORDER (Pedidos)
const ItemOptionSchema = new mongoose.Schema({
  name: String,
  price: Number
}, { _id: false });

const OrderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Catalog'
  },
  name: String,
  flavor: String,
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true
  },
  options: [ItemOptionSchema]
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  orderNumber: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'delivering', 'completed', 'cancelled'],
    default: 'pending'
  },
  customer: {
    name: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    address: String
  },
  items: [OrderItemSchema],
  paymentMethod: {
    type: String,
    enum: ['pix', 'credit-card', 'cash'],
    required: true
  },
  changeFor: Number,
  deliveryFee: {
    type: Number,
    default: 0
  },
  subtotal: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  notes: String
}, {
  timestamps: true
});

// Índices para melhorar consultas
OrderSchema.index({ tenantId: 1 });
OrderSchema.index({ tenantId: 1, status: 1 });
OrderSchema.index({ tenantId: 1, 'customer.phone': 1 });
OrderSchema.index({ tenantId: 1, createdAt: -1 });
OrderSchema.index({ orderNumber: 1 });

// Método para gerar número de pedido
OrderSchema.statics.generateOrderNumber = async function(tenantId) {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  
  // Encontra último pedido do dia
  const lastOrder = await this.findOne(
    { tenantId, orderNumber: new RegExp(`^ORD-${dateStr}-`) },
    { orderNumber: 1 },
    { sort: { orderNumber: -1 } }
  );
  
  let sequence = 1;
  
  if (lastOrder) {
    const parts = lastOrder.orderNumber.split('-');
    sequence = parseInt(parts[2]) + 1;
  }
  
  return `ORD-${dateStr}-${sequence.toString().padStart(3, '0')}`;
};

// 8. REPORTS (Relatórios/Cache de Estatísticas)
const ReportSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  reportType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: true
  },
  period: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    }
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  }
}, {
  timestamps: true
});

// Índices para melhorar consultas
ReportSchema.index({ tenantId: 1, reportType: 1 });
ReportSchema.index({ tenantId: 1, 'period.start': 1, 'period.end': 1 });

// ==== CRIAÇÃO DOS MODELOS ====
const Tenant = mongoose.model('Tenant', TenantSchema);
const Category = mongoose.model('Category', CategorySchema);
const ProductOption = mongoose.model('ProductOption', ProductOptionSchema);
const Catalog = mongoose.model('Catalog', CatalogSchema);
const User = mongoose.model('User', UserSchema);
const Conversation = mongoose.model('Conversation', ConversationSchema);
const Order = mongoose.model('Order', OrderSchema);
const Report = mongoose.model('Report', ReportSchema);

// ==== FUNÇÃO PARA CRIAR TENANT E USUÁRIO ADMIN INICIAL ====
const setupInitialData = async () => {
  try {
    // Verificar se já existe algum tenant
    const tenantsCount = await Tenant.countDocuments();
    
    if (tenantsCount === 0) {
      console.log('Criando tenant inicial...');
      
      // Gerar API key
      const apiKey = crypto.randomBytes(32).toString('hex');
      
      // Criar tenant inicial
      const tenant = await Tenant.create({
        name: 'Empresa Demo',
        slug: 'empresa-demo',
        apiKey,
        contact: {
          email: 'admin@empresademo.com',
          phone: '5511999999999'
        },
        planType: 'premium',
        settings: {
          theme: 'default',
          logo: 'https://via.placeholder.com/200x80?text=Logo',
          primaryColor: '#3498db',
          features: {
            whatsappIntegration: true,
            customDomain: false
          }
        }
      });
      
      console.log('Tenant inicial criado com sucesso!');
      console.log('API Key:', apiKey);
      
      // Criar usuário admin para o tenant
      await User.create({
        tenantId: tenant._id,
        name: 'Administrador',
        email: 'admin@empresademo.com',
        password: 'admin123',
        role: 'admin',
        active: true
      });
      
      console.log('Usuário admin criado com sucesso!');
      
      // Criar super admin (sem tenant)
      await User.create({
        tenantId: tenant._id, // Aqui poderia ser null para super-admin global
        name: 'Super Administrador',
        email: 'super@apimybot.com',
        password: 'super123',
        role: 'super-admin',
        active: true
      });
      
      console.log('Usuário super-admin criado com sucesso!');
      
      // Criar algumas categorias
      const categories = [
        {
          tenantId: tenant._id,
          name: 'Pizzas',
          slug: 'pizzas',
          description: 'Nossas melhores pizzas',
          order: 1,
          active: true
        },
        {
          tenantId: tenant._id,
          name: 'Hambúrgueres',
          slug: 'hamburgueres',
          description: 'Hambúrgueres artesanais',
          order: 2,
          active: true
        },
        {
          tenantId: tenant._id,
          name: 'Bebidas',
          slug: 'bebidas',
          description: 'Refrigerantes, sucos e cervejas',
          order: 3,
          active: true
        }
      ];
      
      await Category.insertMany(categories);
      console.log('Categorias iniciais criadas com sucesso!');
      
      // Criar opções de produtos
      const options = [
        {
          tenantId: tenant._id,
          type: 'pizza-size',
          name: 'Pequena',
          description: '4 fatias',
          price: 30.00,
          slices: 4,
          order: 1,
          active: true
        },
        {
          tenantId: tenant._id,
          type: 'pizza-size',
          name: 'Média',
          description: '6 fatias',
          price: 40.00,
          slices: 6,
          order: 2,
          active: true
        },
        {
          tenantId: tenant._id,
          type: 'pizza-size',
          name: 'Grande',
          description: '8 fatias',
          price: 50.00,
          slices: 8,
          order: 3,
          active: true
        },
        {
          tenantId: tenant._id,
          type: 'pizza-crust',
          name: 'Tradicional',
          price: 0.00,
          order: 1,
          active: true
        },
        {
          tenantId: tenant._id,
          type: 'pizza-crust',
          name: 'Borda Recheada',
          description: 'Borda recheada com catupiry',
          price: 5.00,
          order: 2,
          active: true
        }
      ];
      
      const savedOptions = await ProductOption.insertMany(options);
      console.log('Opções de produtos criadas com sucesso!');
      
      // Referência para as categorias criadas
      const pizzaCategory = categories[0];
      
      // Criar produtos iniciais
      const products = [
        {
          tenantId: tenant._id,
          name: 'Pizza Margherita',
          description: 'Molho de tomate, mussarela, tomate e manjericão',
          image: 'https://via.placeholder.com/300x200?text=Pizza',
          available: true,
          category: pizzaCategory._id,
          productType: 'pizza',
          sizesPrices: [
            {
              sizeId: savedOptions[0]._id,
              sizeName: 'Pequena',
              price: 30.00
            },
            {
              sizeId: savedOptions[1]._id,
              sizeName: 'Média',
              price: 40.00
            },
            {
              sizeId: savedOptions[2]._id,
              sizeName: 'Grande',
              price: 50.00
            }
          ]
        }
      ];
      
      await Catalog.insertMany(products);
      console.log('Produtos iniciais criados com sucesso!');
      
    } else {
      console.log('Banco de dados já possui dados. Pulando criação de dados iniciais.');
    }
    
  } catch (error) {
    console.error('Erro ao criar dados iniciais:', error);
  }
};

// ==== EXECUTAR SCRIPT ====
const initDatabase = async () => {
  try {
    // Conectar ao MongoDB
    await connectDB();
    
    // Configurar dados iniciais
    await setupInitialData();
    
    console.log('Configuração do banco de dados concluída com sucesso!');
  } catch (error) {
    console.error('Erro durante a configuração do banco de dados:', error);
  } finally {
    // Fechar conexão
    mongoose.connection.close();
    console.log('Conexão com o MongoDB fechada');
  }
};

// Executar a inicialização
initDatabase();

module.exports = {
  Tenant,
  Category,
  ProductOption,
  Catalog,
  User,
  Conversation,
  Order,
  Report
};