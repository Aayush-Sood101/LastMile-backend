const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
    }
  }],
  appliedCommunityDiscount: {
    type: Boolean,
    default: false
  },
  totalPrice: {
    type: Number,
    default: 0
  },
  totalCarbonFootprint: {
    individual: {
      type: Number,
      default: 0
    },
    community: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate total price and carbon footprint
cartSchema.pre('save', async function(next) {
  const cart = this;
  let totalPrice = 0;
  let individualFootprint = 0;
  let communityFootprint = 0;
  
  // Populate products to get current prices and carbon footprint data
  await cart.populate('items.product');
  
  cart.items.forEach(item => {
    // Calculate price
    const itemPrice = item.product.price * item.quantity;
    totalPrice += itemPrice;
    
    // Calculate carbon footprint
    individualFootprint += item.product.carbonFootprint.individual * item.quantity;
    communityFootprint += item.product.carbonFootprint.community * item.quantity;
  });
  
  // Apply community discount if applicable
  if (cart.appliedCommunityDiscount) {
    // Assuming all items have the same discount percentage (using the first one)
    if (cart.items.length > 0 && cart.items[0].product) {
      const discountPercentage = cart.items[0].product.communityDiscountPercentage;
      totalPrice = totalPrice * (1 - (discountPercentage / 100));
    }
  }
  
  cart.totalPrice = totalPrice;
  cart.totalCarbonFootprint.individual = individualFootprint;
  cart.totalCarbonFootprint.community = communityFootprint;
  
  next();
});

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
