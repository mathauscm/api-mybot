const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductOptionSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
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

module.exports = mongoose.model('ProductOption', ProductOptionSchema);