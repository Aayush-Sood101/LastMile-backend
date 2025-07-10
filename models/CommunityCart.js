const mongoose = require('mongoose');

const communityCartSchema = new mongoose.Schema({
  community: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  deliveryCycle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryCycle'
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  totalPrice: {
    type: Number,
    default: 0
  },
  totalCarbonFootprint: {
    community: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate total price and carbon footprint
communityCartSchema.pre('save', async function(next) {
  const cart = this;
  let totalPrice = 0;
  let communityFootprint = 0;
  
  // Populate products to get current prices and carbon footprint data
  await cart.populate('items.product');
  
  cart.items.forEach(item => {
    // Calculate price with community discount
    const itemPrice = item.product.price * item.quantity;
    const discountPrice = itemPrice * (1 - (item.product.communityDiscountPercentage / 100));
    totalPrice += discountPrice;
    
    // Calculate carbon footprint
    communityFootprint += item.product.carbonFootprint.community * item.quantity;
  });
  
  cart.totalPrice = totalPrice;
  cart.totalCarbonFootprint.community = communityFootprint;
  
  next();
});

const CommunityCart = mongoose.model('CommunityCart', communityCartSchema);

module.exports = CommunityCart;
