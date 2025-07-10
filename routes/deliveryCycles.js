const express = require('express');
const { auth, walmartAuth } = require('../middleware/auth');
const DeliveryCycle = require('../models/DeliveryCycle');
const Community = require('../models/Community');
const CommunityCart = require('../models/CommunityCart');
const router = express.Router();

// Get all delivery cycles (walmart only)
router.get('/', walmartAuth, async (req, res) => {
  try {
    const deliveryCycles = await DeliveryCycle.find()
      .populate('community', 'name location')
      .sort({ scheduledDate: 1 });
      
    res.json(deliveryCycles);
  } catch (error) {
    console.error('Error fetching delivery cycles:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get upcoming delivery cycles (walmart only)
router.get('/upcoming', walmartAuth, async (req, res) => {
  try {
    const today = new Date();
    const deliveryCycles = await DeliveryCycle.find({
      scheduledDate: { $gte: today },
      status: { $in: ['scheduled', 'in-progress'] }
    })
      .populate('community', 'name location')
      .sort({ scheduledDate: 1 });
      
    res.json(deliveryCycles);
  } catch (error) {
    console.error('Error fetching upcoming delivery cycles:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get delivery cycles for a community
router.get('/community/:communityId', auth, async (req, res) => {
  try {
    const deliveryCycles = await DeliveryCycle.find({
      community: req.params.communityId
    })
      .sort({ scheduledDate: 1 });
      
    res.json(deliveryCycles);
  } catch (error) {
    console.error('Error fetching community delivery cycles:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get delivery cycle by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const deliveryCycle = await DeliveryCycle.findById(req.params.id)
      .populate('community', 'name location')
      .populate('orders');
      
    if (!deliveryCycle) {
      return res.status(404).json({ message: 'Delivery cycle not found' });
    }
    
    res.json(deliveryCycle);
  } catch (error) {
    console.error('Error fetching delivery cycle:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Delivery cycle not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Create delivery cycle (walmart only)
router.post('/', walmartAuth, async (req, res) => {
  try {
    const { communityId, scheduledDate } = req.body;

    // Check if community exists
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    // Create new delivery cycle
    const newDeliveryCycle = new DeliveryCycle({
      community: communityId,
      scheduledDate: new Date(scheduledDate),
      createdBy: req.user.id
    });

    const deliveryCycle = await newDeliveryCycle.save();
    
    // Create or update community cart for this delivery cycle
    let communityCart = await CommunityCart.findOne({ community: communityId, deliveryCycle: null });
    
    if (communityCart) {
      communityCart.deliveryCycle = deliveryCycle._id;
      await communityCart.save();
    } else {
      communityCart = new CommunityCart({
        community: communityId,
        deliveryCycle: deliveryCycle._id,
        items: []
      });
      await communityCart.save();
    }
    
    res.status(201).json({
      message: 'Delivery cycle created successfully',
      deliveryCycle
    });
  } catch (error) {
    console.error('Error creating delivery cycle:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update delivery cycle status (walmart only)
router.put('/:id/status', walmartAuth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['scheduled', 'in-progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const deliveryCycle = await DeliveryCycle.findById(req.params.id);
    
    if (!deliveryCycle) {
      return res.status(404).json({ message: 'Delivery cycle not found' });
    }
    
    deliveryCycle.status = status;
    await deliveryCycle.save();
    
    res.json({
      message: `Delivery cycle status updated to ${status}`,
      deliveryCycle
    });
  } catch (error) {
    console.error('Error updating delivery cycle status:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Delivery cycle not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Get product requirements for upcoming delivery cycle (walmart only)
router.get('/:id/requirements', walmartAuth, async (req, res) => {
  try {
    const deliveryCycle = await DeliveryCycle.findById(req.params.id);
    
    if (!deliveryCycle) {
      return res.status(404).json({ message: 'Delivery cycle not found' });
    }
    
    const communityCart = await CommunityCart.findOne({ 
      deliveryCycle: deliveryCycle._id 
    }).populate('items.product');
    
    if (!communityCart) {
      return res.status(404).json({ message: 'Community cart not found for this delivery cycle' });
    }
    
    // Aggregate product requirements
    const productRequirements = [];
    const productMap = new Map();
    
    communityCart.items.forEach(item => {
      const productId = item.product._id.toString();
      
      if (productMap.has(productId)) {
        const existingItem = productMap.get(productId);
        existingItem.quantity += item.quantity;
      } else {
        productMap.set(productId, {
          product: {
            _id: item.product._id,
            name: item.product.name,
            price: item.product.price,
            category: item.product.category
          },
          quantity: item.quantity,
          totalPrice: item.quantity * item.product.price
        });
      }
    });
    
    productMap.forEach(item => {
      productRequirements.push(item);
    });
    
    res.json({
      deliveryCycle,
      productRequirements
    });
  } catch (error) {
    console.error('Error fetching delivery cycle requirements:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Delivery cycle not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
