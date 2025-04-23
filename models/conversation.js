const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
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

const ConversationSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
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

module.exports = mongoose.model('Conversation', ConversationSchema);