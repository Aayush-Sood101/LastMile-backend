const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  costPrice: {
    type: Number,
    min: 0
  },
  operationalCost: {
    type: Number,
    default: 5,
    min: 0
  },
  discountPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 50
  },
  discountedPrice: {
    type: Number,
    min: 0
  },
  communityDiscountPercentage: {
    type: Number,
    default: 5,
    min: 0,
    max: 50
  },
  popularityScore: {
    type: Number,
    default: 1.0,
    min: 0
  },
  category: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String
  },
  inStock: {
    type: Boolean,
    default: true
  },
  carbonFootprint: {
    individual: {
      type: Number,
      default: 1.5 // kg CO2 for individual delivery
    },
    community: {
      type: Number,
      default: 0.5 // kg CO2 for community delivery
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
