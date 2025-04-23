const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SizesPriceSchema = new Schema({
  sizeId: {
    type: Schema.Types.ObjectId,
    ref: 'ProductOption'
  },
  sizeName: String,
  price: Number
}, { _id: false });

const CatalogSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
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
    type: Schema.Types.ObjectId,
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

module.exports = mongoose.model('Catalog', CatalogSchema);