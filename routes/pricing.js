const express = require('express');
const router = express.Router();
const { auth, walmartAuth } = require('../middleware/auth');
const Product = require('../models/Product');

/**
 * @route   POST /api/pricing/optimize
 * @desc    Optimize product pricing
 * @access  Private (Walmart admin only)
 */
router.post('/optimize', walmartAuth, async (req, res) => {
  try {
    const { products, targetMargin = 0.2, maxDiscount = 0.5 } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ message: 'Products data is required' });
    }

    console.log(`Optimizing prices for ${products.length} products, target margin: ${targetMargin}, max discount: ${maxDiscount}`);
    
    // Extract data from products
    const supplierCosts = products.map(p => p.costPrice || p.price * 0.7);
    const operationalCosts = products.map(p => p.operationalCost || 5);
    const retailPrices = products.map(p => p.price);
    const quantities = products.map(p => p.quantity || 10);
    const volumePerUnit = products.map(p => p.volume || 0.02);
    const weightPerUnit = products.map(p => p.weight || 1.5);
    
    // Logistic map for chaos
    const logisticMap = (c, mu = 4.0) => {
      return mu * c * (1 - c);
    };

    // Define the margin constraint function
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
      c = logisticMap(c);
      
      // Uniform discounts for all products
      const discounts = Array(products.length).fill(0).map(() => maxDiscount * c);
      
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
    
    // If no feasible solution found, return zero discounts
    if (!bestDiscounts) {
      const zeroDiscounts = Array(products.length).fill(0);
      console.log("No feasible solution found, returning zero discounts");
      
      // Calculate final results with zero discounts
      const optimizedProducts = products.map((product, i) => ({
        ...product,
        discount: 0,
        discountedPrice: product.price,
        profit: (product.price - supplierCosts[i] - operationalCosts[i]) * quantities[i]
      }));
      
      return res.json({
        success: true,
        message: 'No feasible discount solution found within constraints',
        products: optimizedProducts,
        totalProfit: optimizedProducts.reduce((sum, p) => sum + p.profit, 0),
        totalRevenue: optimizedProducts.reduce((sum, p, i) => sum + p.discountedPrice * quantities[i], 0),
        avgDiscount: 0
      });
    }
    
    console.log("Initial solution found:", bestDiscounts.map(d => (d * 100).toFixed(2) + "%"));
    
    // Stage 2: Pattern search refinement
    const optimalDiscounts = [...bestDiscounts];
    const stepSizes = Array(products.length).fill(0.05);
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
    const finalPrices = retailPrices.map((p, i) => p * (1 - optimalDiscounts[i]));
    const finalProfits = finalPrices.map((p, i) => 
      (p - supplierCosts[i] - operationalCosts[i]) * quantities[i]
    );
    const totalProfit = finalProfits.reduce((sum, p) => sum + p, 0);
    const totalRevenue = finalPrices.reduce((sum, p, i) => sum + p * quantities[i], 0);
    const finalMargin = totalRevenue > 0 ? totalProfit / totalRevenue : 0;
    const avgDiscount = optimalDiscounts.reduce((sum, d) => sum + d, 0) / optimalDiscounts.length;
    
    console.log("Optimal solution found:", optimalDiscounts.map(d => (d * 100).toFixed(2) + "%"));
    console.log("Final margin achieved:", (finalMargin * 100).toFixed(2) + "%");
    
    // Map results back to product objects
    const optimizedProducts = products.map((product, i) => ({
      ...product,
      discount: optimalDiscounts[i],
      discountedPrice: finalPrices[i],
      profit: finalProfits[i]
    }));
    
    // Return the optimization results
    const results = {
      success: true,
      message: 'Price optimization completed',
      products: optimizedProducts,
      totalProfit,
      totalRevenue,
      finalMargin,
      avgDiscount
    };
    
    res.json(results);
  } catch (error) {
    console.error('Error in price optimization:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/pricing/save
 * @desc    Save optimized pricing data
 * @access  Private (Walmart admin only)
 */
router.post('/save', walmartAuth, async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ message: 'Product data is required' });
    }
    
    // Update product prices in the database
    const updatePromises = products.map(product => 
      Product.findByIdAndUpdate(
        product._id,
        { 
          discountPercentage: product.discount,
          discountedPrice: product.optimizedPrice,
          lastUpdated: Date.now()
        },
        { new: true }
      )
    );
    
    const updatedProducts = await Promise.all(updatePromises);
    
    res.json({
      success: true,
      message: 'Optimized prices saved successfully',
      products: updatedProducts
    });
  } catch (error) {
    console.error('Error saving optimized prices:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
