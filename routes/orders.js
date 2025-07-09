const express = require('express');
const { auth } = require('../middleware/auth');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const User = require('../models/User');
const Community = require('../models/Community');
const router = express.Router();

// Create a new order
router.post('/', auth, async (req, res) => {
  try {
    const { shippingAddress, paymentMethod } = req.body;
    
    // Get user's cart
    const cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product');
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }
    
    // Get user for community info
    const user = await User.findById(req.user.id);
    
    // Prepare order items from cart
    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      quantity: item.quantity,
      price: item.product.price * (
        cart.appliedCommunityDiscount 
          ? (1 - (item.product.communityDiscountPercentage / 100)) 
          : 1
      )
    }));
    
    // Calculate carbon footprint saved
    const carbonFootprintSaved = 
      cart.totalCarbonFootprint.individual - 
      cart.totalCarbonFootprint.community;
    
    // Create order
    const newOrder = new Order({
      user: req.user.id,
      community: user.community,
      items: orderItems,
      totalPrice: cart.totalPrice,
      shippingAddress: shippingAddress || user.address,
      paymentMethod,
      isGroupOrder: !!user.community,
      carbonFootprintSaved: user.community ? carbonFootprintSaved : 0
    });
    
    const order = await newOrder.save();
    
    // Update user's carbon footprint saved
    if (user.community) {
      user.carbonFootprintSaved += carbonFootprintSaved;
      await user.save();
      
      // Update community's total carbon footprint saved
      await Community.findByIdAndUpdate(user.community, {
        $inc: { totalCarbonFootprintSaved: carbonFootprintSaved }
      });
    }
    
    // Clear the user's cart
    cart.items = [];
    await cart.save();
    
    res.status(201).json({ 
      message: 'Order created successfully',
      order 
    });
  } catch (error) {
    console.error('Error creating order:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all orders for a user
router.get('/', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate('items.product')
      .sort({ createdAt: -1 });
      
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific order
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product')
      .populate('community');
      
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check if the order belongs to the user
    if (order.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Get orders for a community (community admin only)
router.get('/community/:communityId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Check if user is admin of this community
    if (!user.isCommunityAdmin || 
        user.community.toString() !== req.params.communityId) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    const orders = await Order.find({ 
      community: req.params.communityId,
      orderStatus: { $in: ['processing', 'shipped'] }
    })
      .populate('user', 'name email')
      .populate('items.product')
      .sort({ createdAt: -1 });
      
    res.json(orders);
  } catch (error) {
    console.error('Error fetching community orders:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Community not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Get carbon footprint statistics for user
router.get('/carbon-stats/user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.json({ 
      carbonFootprintSaved: user.carbonFootprintSaved 
    });
  } catch (error) {
    console.error('Error fetching carbon footprint stats:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
