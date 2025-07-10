const express = require('express');
const { auth, communityAdminAuth } = require('../middleware/auth');
const CommunityCart = require('../models/CommunityCart');
const Community = require('../models/Community');
const Product = require('../models/Product');
const router = express.Router();

// Get community cart for user's community
router.get('/my-community', auth, async (req, res) => {
  try {
    // Check if user is in a community
    if (!req.user.community) {
      return res.status(400).json({ message: 'You are not part of any community' });
    }
    
    // Get active community cart
    const communityCart = await CommunityCart.findOne({ 
      community: req.user.community,
      isLocked: false
    }).populate('items.product').populate('items.addedBy', 'name');
    
    if (!communityCart) {
      // Create a new community cart if none exists
      const newCommunityCart = new CommunityCart({
        community: req.user.community,
        items: []
      });
      
      await newCommunityCart.save();
      return res.json(newCommunityCart);
    }
    
    res.json(communityCart);
  } catch (error) {
    console.error('Error fetching community cart:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get community cart by community ID
router.get('/community/:communityId', auth, async (req, res) => {
  try {
    const communityCart = await CommunityCart.findOne({ 
      community: req.params.communityId,
      isLocked: false
    }).populate('items.product').populate('items.addedBy', 'name');
    
    if (!communityCart) {
      return res.status(404).json({ message: 'Community cart not found' });
    }
    
    res.json(communityCart);
  } catch (error) {
    console.error('Error fetching community cart:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Community cart not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Add item to community cart
router.post('/add-item', auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    // Check if user is in a community
    if (!req.user.community) {
      return res.status(400).json({ message: 'You are not part of any community' });
    }
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Get or create community cart
    let communityCart = await CommunityCart.findOne({ 
      community: req.user.community,
      isLocked: false
    });
    
    if (!communityCart) {
      communityCart = new CommunityCart({
        community: req.user.community,
        items: []
      });
    }
    
    // Check if product already in cart
    const itemIndex = communityCart.items.findIndex(
      item => item.product.toString() === productId
    );
    
    if (itemIndex > -1) {
      // Update quantity if product exists
      communityCart.items[itemIndex].quantity += quantity;
    } else {
      // Add new item
      communityCart.items.push({
        product: productId,
        quantity,
        addedBy: req.user.id
      });
    }
    
    await communityCart.save();
    await communityCart.populate('items.product');
    await communityCart.populate('items.addedBy', 'name');
    
    res.json({
      message: 'Item added to community cart',
      communityCart
    });
  } catch (error) {
    console.error('Error adding item to community cart:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update item in community cart
router.put('/update-item', auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    // Check if user is in a community
    if (!req.user.community) {
      return res.status(400).json({ message: 'You are not part of any community' });
    }
    
    // Get community cart
    const communityCart = await CommunityCart.findOne({ 
      community: req.user.community,
      isLocked: false
    });
    
    if (!communityCart) {
      return res.status(404).json({ message: 'Community cart not found' });
    }
    
    // Find item
    const itemIndex = communityCart.items.findIndex(
      item => item.product.toString() === productId
    );
    
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in community cart' });
    }
    
    // Update quantity
    communityCart.items[itemIndex].quantity = quantity;
    
    // Remove item if quantity is 0
    if (quantity <= 0) {
      communityCart.items.splice(itemIndex, 1);
    }
    
    await communityCart.save();
    await communityCart.populate('items.product');
    await communityCart.populate('items.addedBy', 'name');
    
    res.json({
      message: 'Item updated in community cart',
      communityCart
    });
  } catch (error) {
    console.error('Error updating item in community cart:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove item from community cart
router.delete('/remove-item/:productId', auth, async (req, res) => {
  try {
    // Check if user is in a community
    if (!req.user.community) {
      return res.status(400).json({ message: 'You are not part of any community' });
    }
    
    // Get community cart
    const communityCart = await CommunityCart.findOne({ 
      community: req.user.community,
      isLocked: false
    });
    
    if (!communityCart) {
      return res.status(404).json({ message: 'Community cart not found' });
    }
    
    // Remove item
    communityCart.items = communityCart.items.filter(
      item => item.product.toString() !== req.params.productId
    );
    
    await communityCart.save();
    
    res.json({
      message: 'Item removed from community cart',
      communityCart
    });
  } catch (error) {
    console.error('Error removing item from community cart:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Lock community cart (community admin only)
router.put('/lock/:communityId', communityAdminAuth, async (req, res) => {
  try {
    // Verify user is admin of this community
    if (req.user.community.toString() !== req.params.communityId) {
      return res.status(403).json({ message: 'You are not the admin of this community' });
    }
    
    // Get community cart
    const communityCart = await CommunityCart.findOne({ 
      community: req.params.communityId,
      isLocked: false
    });
    
    if (!communityCart) {
      return res.status(404).json({ message: 'Community cart not found' });
    }
    
    // Lock the cart
    communityCart.isLocked = true;
    await communityCart.save();
    
    res.json({
      message: 'Community cart has been locked for processing',
      communityCart
    });
  } catch (error) {
    console.error('Error locking community cart:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
