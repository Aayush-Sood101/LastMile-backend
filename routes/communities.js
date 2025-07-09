const express = require('express');
const { auth, walmartAuth, communityAdminAuth } = require('../middleware/auth');
const Community = require('../models/Community');
const User = require('../models/User');
const router = express.Router();

// Get all communities
router.get('/', async (req, res) => {
  try {
    const communities = await Community.find({ isApproved: true })
      .populate('admin', 'name email')
      .select('-membershipRequests');
      
    res.json(communities);
  } catch (error) {
    console.error('Error fetching communities:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get community by ID
router.get('/:id', async (req, res) => {
  try {
    const community = await Community.findById(req.params.id)
      .populate('admin', 'name email')
      .populate('members', 'name email');
      
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }
    
    res.json(community);
  } catch (error) {
    console.error('Error fetching community:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Community not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Create community (requires authenticated user)
router.post('/', auth, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      location
    } = req.body;

    // Create new community
    const newCommunity = new Community({
      name,
      description,
      location,
      admin: req.user.id,
      members: [req.user.id] // Add creator as the first member
    });

    const community = await newCommunity.save();
    
    // Update user to be community admin
    await User.findByIdAndUpdate(
      req.user.id,
      { 
        isCommunityAdmin: true,
        community: community._id 
      }
    );
    
    res.status(201).json({
      message: 'Community created and pending approval from Walmart',
      community
    });
  } catch (error) {
    console.error('Error creating community:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve community (walmart only)
router.put('/:id/approve', walmartAuth, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }
    
    community.isApproved = true;
    await community.save();
    
    res.json({ 
      message: 'Community approved',
      community 
    });
  } catch (error) {
    console.error('Error approving community:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Community not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Request to join community
router.post('/:id/join', auth, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }
    
    // Check if user is already a member
    if (community.members.includes(req.user.id)) {
      return res.status(400).json({ message: 'Already a member of this community' });
    }
    
    // Check if user has already requested to join
    const existingRequest = community.membershipRequests.find(
      request => request.user.toString() === req.user.id
    );
    
    if (existingRequest) {
      return res.status(400).json({ message: 'Join request already submitted' });
    }
    
    // Add membership request
    community.membershipRequests.push({
      user: req.user.id,
      requestDate: Date.now(),
      status: 'pending'
    });
    
    await community.save();
    
    res.status(200).json({ message: 'Join request submitted successfully' });
  } catch (error) {
    console.error('Error requesting to join community:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Community not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve/reject join request (community admin only)
router.put('/:id/requests/:requestId', communityAdminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const community = await Community.findById(req.params.id);
    
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }
    
    // Verify user is admin of this community
    if (community.admin.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Find the membership request
    const requestIndex = community.membershipRequests.findIndex(
      request => request._id.toString() === req.params.requestId
    );
    
    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Membership request not found' });
    }
    
    // Update the request status
    community.membershipRequests[requestIndex].status = status;
    
    // If approved, add user to members list
    if (status === 'approved') {
      const userId = community.membershipRequests[requestIndex].user;
      if (!community.members.includes(userId)) {
        community.members.push(userId);
        
        // Update the user's community reference
        await User.findByIdAndUpdate(userId, { community: community._id });
      }
    }
    
    await community.save();
    
    res.json({ 
      message: `Membership request ${status}`,
      community
    });
  } catch (error) {
    console.error('Error processing membership request:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Community or request not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending community approval requests (walmart only)
router.get('/approval/pending', walmartAuth, async (req, res) => {
  try {
    const pendingCommunities = await Community.find({ isApproved: false })
      .populate('admin', 'name email');
      
    res.json(pendingCommunities);
  } catch (error) {
    console.error('Error fetching pending communities:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get community carbon footprint data
router.get('/:id/carbon-footprint', auth, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }
    
    res.json({ 
      totalCarbonFootprintSaved: community.totalCarbonFootprintSaved 
    });
  } catch (error) {
    console.error('Error fetching community carbon footprint:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Community not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
