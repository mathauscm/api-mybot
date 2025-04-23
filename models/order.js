const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ItemOptionSchema = new Schema({
  name: String,
  price: Number
}, { _id: false });

const OrderItemSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
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

const OrderSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
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

module.exports = mongoose.model('Order', OrderSchema);