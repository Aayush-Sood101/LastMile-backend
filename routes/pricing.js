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
    const { products, targetMargin, maxDiscount } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ message: 'Products data is required' });
    }
    
    // Return the optimization results
    // This is a placeholder - in a real implementation, you would use the
    // optimization algorithm provided by the client to calculate these values
    const results = {
      success: true,
      message: 'Price optimization completed',
      // Add optimization results here
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
