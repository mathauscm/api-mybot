const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TenantSchema = new Schema({
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

module.exports = mongoose.model('Tenant', TenantSchema);