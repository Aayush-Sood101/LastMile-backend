// updateProductCosts.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Product = require('./models/Product');

// Load environment variables
console.log('Current directory:', __dirname);
dotenv.config();

// Connect to MongoDB
console.log('MongoDB URI:', process.env.MONGODB_URI);
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected for updating products'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const updateProducts = async () => {
  try {
    // Get all products
    const products = await Product.find({});
    console.log(`Found ${products.length} products to update`);
    
    // Update each product with costPrice, operationalCost, and other required fields
    let updateCount = 0;
    
    for (const product of products) {
      let updated = false;
      
      // Calculate costPrice as 60-80% of price - ALWAYS update to ensure it's less than retail price
      // Random cost between 60-80% of price
      const costFactor = 0.6 + (Math.random() * 0.2);
      product.costPrice = parseFloat((product.price * costFactor).toFixed(2));
      updated = true;
      
      // Set operationalCost to be between 0.15 and 0.3 as requested
      product.operationalCost = 0.15 + (Math.random() * 0.15); // Between 0.15-0.3
      product.operationalCost = parseFloat(product.operationalCost.toFixed(2));
      updated = true;
      
      // Set popularityScore if not already set
      if (!product.popularityScore || product.popularityScore <= 0) {
        product.popularityScore = 1.0 + (Math.random() * 4.0); // Random between 1.0 and 5.0
        updated = true;
      }
      
      // Add default volume if not set
      if (!product.volume || product.volume <= 0) {
        product.volume = 0.01 + (Math.random() * 0.04); // Random between 0.01 and 0.05 cubic meters
        updated = true;
      }
      
      // Add default weight if not set
      if (!product.weight || product.weight <= 0) {
        product.weight = 0.5 + (Math.random() * 2.5); // Random between 0.5 and 3.0 kg
        updated = true;
      }
      
      // Save the updated product
      if (updated) {
        await product.save();
        updateCount++;
        console.log(`Updated product: ${product.name} - Cost: ₹${product.costPrice}, Price: ₹${product.price}, Volume: ${product.volume}m³, Weight: ${product.weight}kg`);
      }
    }
    
    console.log(`Updated ${updateCount} products successfully`);
    
    // Run a test optimization with the algorithm described in Python
    console.log("\n======== Testing Optimization Algorithm ========");
    console.log("This simulates the advanced pattern search algorithm from Python");
    
    // Sample data with realistic product costs
    const retailPrices = [60, 50, 120]; // Original prices
    const supplierCosts = [40, 35, 80]; // Supplier costs - around 70% of retail price
    const operationalCosts = [0.25, 0.20, 0.30];  // Operational costs - between 0.15-0.3 as requested
    const quantities = [1000, 2000, 500]; // More realistic quantities
    const targetMargin = 0.15; // 15% - more realistic target margin
    const maxDiscount = 0.25; // 25% - more realistic maximum discount
    
    // Function to calculate profit margin
    const calculateMargin = (discounts) => {
      let totalProfit = 0;
      let totalRevenue = 0;
      
      for (let i = 0; i < discounts.length; i++) {
        const price = retailPrices[i] * (1 - discounts[i]);
        const profit = (price - supplierCosts[i] - operationalCosts[i]) * quantities[i];
        
        totalProfit += profit;
        totalRevenue += price * quantities[i];
      }
      
      return totalRevenue > 0 ? totalProfit / totalRevenue : -1;
    };
    
    // Function to calculate margin constraint
    const marginConstraint = (discounts) => {
      let sum = 0;
      
      for (let i = 0; i < discounts.length; i++) {
        const term = quantities[i] * ((1 - targetMargin) * retailPrices[i] * (1 - discounts[i]) - 
                                      supplierCosts[i] - operationalCosts[i]);
        sum += term;
      }
      
      return sum;
    };
    
    // Stage 1: Find initial solution with chaotic search
    console.log("Stage 1: Chaotic Initialization");
    let c = 0.7; // Initial chaotic value
    let bestDiscounts = null;
    let bestObjectiveValue = -Infinity;
    
    for (let i = 0; i < 1000; i++) {
      // Logistic map for chaos
      c = 4 * c * (1 - c);
      
      // Uniform discounts for all products
      const discounts = [
        0 + (maxDiscount - 0) * c,
        0 + (maxDiscount - 0) * c,
        0 + (maxDiscount - 0) * c
      ];
      
      // Check if margin constraint is satisfied
      if (marginConstraint(discounts) >= 0) {
        // Calculate objective value (total weighted discount)
        let objValue = 0;
        for (let j = 0; j < discounts.length; j++) {
          objValue += quantities[j] * discounts[j];
        }
        
        if (objValue > bestObjectiveValue) {
          bestObjectiveValue = objValue;
          bestDiscounts = [...discounts];
        }
      }
    }
    
    console.log("Initial solution found:", bestDiscounts ? 
                bestDiscounts.map(d => (d * 100).toFixed(2) + "%") : "No feasible solution");
    
    // Stage 2: Pattern search refinement
    if (bestDiscounts) {
      console.log("\nStage 2: Pattern Search Refinement");
      const optimalDiscounts = [...bestDiscounts]; // Will be modified in-place
      const stepSizes = [0.05, 0.05, 0.05];
      const epsilon = 0.0001;
      const maxIterations = 1000;
      
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        let improved = false;
        const currentDiscounts = [...optimalDiscounts];
        
        for (let i = 0; i < optimalDiscounts.length; i++) {
          // Try increasing discount
          if (optimalDiscounts[i] < maxDiscount) {
            optimalDiscounts[i] += stepSizes[i];
            if (optimalDiscounts[i] > maxDiscount) optimalDiscounts[i] = maxDiscount;
            
            if (marginConstraint(optimalDiscounts) < 0) {
              // Constraint violated, revert
              optimalDiscounts[i] = currentDiscounts[i];
            } else {
              improved = true;
              break;
            }
          }
          
          // Try decreasing discount
          if (optimalDiscounts[i] > 0) {
            optimalDiscounts[i] -= stepSizes[i];
            if (optimalDiscounts[i] < 0) optimalDiscounts[i] = 0;
            
            if (marginConstraint(optimalDiscounts) < 0) {
              // Constraint violated, revert
              optimalDiscounts[i] = currentDiscounts[i];
            } else {
              improved = true;
              break;
            }
          }
        }
        
        if (!improved) {
          // Reduce step sizes
          for (let i = 0; i < stepSizes.length; i++) {
            stepSizes[i] /= 2;
          }
          
          // Check convergence
          if (Math.max(...stepSizes) < epsilon) {
            break;
          }
        }
      }
      
      // Calculate final results
      console.log("\nOptimal solution found:");
      console.log("Discounts:", optimalDiscounts.map(d => (d * 100).toFixed(2) + "%"));
      
      const finalPrices = retailPrices.map((p, i) => p * (1 - optimalDiscounts[i]));
      const finalProfits = finalPrices.map((p, i) => (p - supplierCosts[i] - operationalCosts[i]) * quantities[i]);
      const totalProfit = finalProfits.reduce((sum, p) => sum + p, 0);
      const totalRevenue = finalPrices.reduce((sum, p, i) => sum + p * quantities[i], 0);
      const finalMargin = totalRevenue > 0 ? totalProfit / totalRevenue : 0;
      
      console.log("\n===== Detailed Results =====");
      for (let i = 0; i < optimalDiscounts.length; i++) {
        console.log(`Product ${i+1}:`);
        console.log(`  Discount: ${(optimalDiscounts[i] * 100).toFixed(2)}%`);
        console.log(`  Final Price per unit: ₹${finalPrices[i].toFixed(2)}`);
        console.log(`  Profit per product: ₹${finalProfits[i].toFixed(2)}`);
        console.log(`  Quantity ordered: ${quantities[i]}`);
      }
      console.log(`\nTotal Profit: ₹${totalProfit.toFixed(2)}`);
      console.log(`Total Revenue: ₹${totalRevenue.toFixed(2)}`);
      console.log(`Final Overall Profit Margin: ${(finalMargin * 100).toFixed(2)}%`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating products:', error);
    process.exit(1);
  }
};

// Run the update function
updateProducts();
