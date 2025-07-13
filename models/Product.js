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
  // Volume in cubic meters (m³)
  volume: {
    type: Number,
    default: 0.02, // Default volume in m³
    min: 0
  },
  // Weight in kilograms (kg)
  weight: {
    type: Number,
    default: 1.5, // Default weight in kg
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

// Pre-save hook to calculate discountedPrice based on price and discountPercentage
productSchema.pre('save', function(next) {
  // If discountPercentage is set, calculate and set the discountedPrice
  if (this.discountPercentage > 0) {
    this.discountedPrice = this.price * (1 - this.discountPercentage / 100);
  } else {
    // If no discount, discountedPrice equals the regular price
    this.discountedPrice = this.price;
  }
  next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
