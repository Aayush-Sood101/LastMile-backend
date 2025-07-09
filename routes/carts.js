const express = require('express');
const { auth } = require('../middleware/auth');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const router = express.Router();

// Get user's cart
router.get('/', auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product');
    
    if (!cart) {
      cart = new Cart({ user: req.user.id, items: [] });
      await cart.save();
    }
    
    res.json(cart);
  } catch (error) {
    console.error('Error fetching cart:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add item to cart
router.post('/add-item', auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Get user's cart or create new one
    let cart = await Cart.findOne({ user: req.user.id });
    
    if (!cart) {
      cart = new Cart({ user: req.user.id, items: [] });
    }
    
    // Check if item already in cart
    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );
    
    if (itemIndex > -1) {
      // Update quantity if item exists
      cart.items[itemIndex].quantity += quantity;
    } else {
      // Add new item
      cart.items.push({ product: productId, quantity });
    }
    
    // Update cart's community discount if user is part of a community
    const user = await User.findById(req.user.id);
    if (user.community) {
      cart.appliedCommunityDiscount = true;
    }
    
    await cart.save();
    
    // Populate product details before returning
    await cart.populate('items.product');
    
    res.json(cart);
  } catch (error) {
    console.error('Error adding item to cart:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update item quantity
router.put('/update-item', auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    // Validate quantity
    if (quantity < 1) {
      return res.status(400).json({ message: 'Quantity must be at least 1' });
    }
    
    // Get user's cart
    const cart = await Cart.findOne({ user: req.user.id });
    
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    
    // Find the item
    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );
    
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }
    
    // Update quantity
    cart.items[itemIndex].quantity = quantity;
    
    await cart.save();
    
    // Populate product details before returning
    await cart.populate('items.product');
    
    res.json(cart);
  } catch (error) {
    console.error('Error updating cart item:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove item from cart
router.delete('/remove-item/:productId', auth, async (req, res) => {
  try {
    const productId = req.params.productId;
    
    // Get user's cart
    const cart = await Cart.findOne({ user: req.user.id });
    
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    
    // Remove the item
    cart.items = cart.items.filter(
      item => item.product.toString() !== productId
    );
    
    await cart.save();
    
    // Populate product details before returning
    await cart.populate('items.product');
    
    res.json(cart);
  } catch (error) {
    console.error('Error removing item from cart:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Clear cart
router.delete('/clear', auth, async (req, res) => {
  try {
    // Get user's cart
    const cart = await Cart.findOne({ user: req.user.id });
    
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    
    // Clear items
    cart.items = [];
    await cart.save();
    
    res.json({ message: 'Cart cleared', cart });
  } catch (error) {
    console.error('Error clearing cart:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get carbon footprint comparison
router.get('/carbon-footprint', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product');
    
    if (!cart || cart.items.length === 0) {
      return res.json({ 
        individual: 0, 
        community: 0, 
        saved: 0,
        savingPercentage: 0
      });
    }
    
    const individual = cart.totalCarbonFootprint.individual;
    const community = cart.totalCarbonFootprint.community;
    const saved = individual - community;
    const savingPercentage = ((saved / individual) * 100).toFixed(1);
    
    res.json({
      individual,
      community,
      saved,
      savingPercentage
    });
  } catch (error) {
    console.error('Error calculating carbon footprint:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
