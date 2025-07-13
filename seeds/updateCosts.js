// updateCosts.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Product = require('../models/Product');

// Load environment variables
console.log('Current directory:', __dirname);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Connect to MongoDB
console.log('MongoDB URI:', process.env.MONGODB_URI);
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected for updating products'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const updateProductCosts = async () => {
  try {
    // Get all products
    const products = await Product.find({});
    console.log(`Found ${products.length} products to update`);
    
    // Update each product with costPrice and operationalCost
    let updateCount = 0;
    
    for (const product of products) {
      // Calculate costPrice as 60-80% of price
      const costFactor = 0.6 + (Math.random() * 0.2);
      product.costPrice = parseFloat((product.price * costFactor).toFixed(2));
      
      // Set operationalCost to be between 0.15 and 0.3
      product.operationalCost = 0.15 + (Math.random() * 0.15);
      product.operationalCost = parseFloat(product.operationalCost.toFixed(2));
      
      // Save the updated product
      await product.save();
      updateCount++;
      console.log(`Updated product: ${product.name} - Cost: ₹${product.costPrice}, Op Cost: ₹${product.operationalCost}, Price: ₹${product.price}`);
    }
    
    console.log(`Updated ${updateCount} products successfully`);
    process.exit(0);
  } catch (error) {
    console.error('Error updating products:', error);
    process.exit(1);
  }
};

// Run the update function
updateProductCosts();
