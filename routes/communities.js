const express = require('express');
const { auth, walmartAuth, communityAdminAuth } = require('../middleware/auth');
const Community = require('../models/Community');
const User = require('\../models/User');
const Notification = require('../models/Notification');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Custom middleware to verify that the user is the admin of the specific community
const specificCommunityAdminAuth = async (req, res, next) => {
  try {
    // First do regular auth
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    req.token = token;
    req.user = user;
    
    // Then check if the user is the admin of the community
    const communityId = req.params.id;
    const community = await Community.findById(communityId);
    
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }
    
    // Check if the current user is the admin - two ways to verify:
    // 1. Check if user is listed as community's admin
    // 2. Check if user has isCommunityAdmin flag AND their community ID matches
    const isCommAdmin = community.admin.toString() === user._id.toString();
    const hasCommAdminFlag = user.isCommunityAdmin && user.community && user.community.toString() === community._id.toString();
    
    if (!isCommAdmin && !hasCommAdminFlag) {
      console.log('Auth failed:', {
        userId: user._id.toString(), 
        communityAdminId: community.admin.toString(),
        userIsCommunityAdmin: user.isCommunityAdmin,
        userCommunity: user.community ? user.community.toString() : null,
        communityId: community._id.toString()
      });
      return res.status(403).json({ message: 'You are not the admin of this community' });
    }
    
    // If admin status mismatch, update the user record to be consistent
    if (isCommAdmin && !user.isCommunityAdmin) {
      console.log(`Updating user ${user._id} to set isCommunityAdmin to true`);
      await User.findByIdAndUpdate(user._id, { isCommunityAdmin: true });
    }
    
    // Add community to req for convenience
    req.community = community;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ message: 'Not authorized' });
  }
};

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
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { 
        isCommunityAdmin: true,
        community: community._id 
      },
      { new: true }
    );
    
    console.log(`User ${req.user.id} has been set as community admin for new community ${community._id}. isCommunityAdmin=${updatedUser.isCommunityAdmin}`);
    
    // Create notifications for all Walmart admins
    const Notification = require('../models/Notification');
    const walmartAdmins = await User.find({ role: 'walmart' });
    
    if (walmartAdmins.length > 0) {
      // Create a notification for each Walmart admin
      const notificationPromises = walmartAdmins.map(admin => {
        return Notification.create({
          recipient: admin._id,
          type: 'new_community',
          title: 'New Community Approval Required',
          message: `A new community "${name}" has been created and requires your approval.`,
          relatedId: community._id,
          onModel: 'Community'
        });
      });
      
      await Promise.all(notificationPromises);
    }
    
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
    community.status = 'approved';
    await community.save();
    
    // Make sure the admin user has isCommunityAdmin set to true
    await User.findByIdAndUpdate(
      community.admin,
      { isCommunityAdmin: true },
      { new: true }
    );
    
    console.log(`User ${community.admin} has been set as community admin for ${community.name}`);
    
    // Create notification for the community admin
    const Notification = require('../models/Notification');
    
    await Notification.create({
      recipient: community.admin,
      type: 'community_approved',
      title: 'Community Approved',
      message: `Your community "${community.name}" has been approved by Walmart. You can now invite members and manage your community.`,
      relatedId: community._id,
      onModel: 'Community'
    });
    
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
    
    // Check if already a member
    if (community.members.includes(req.user.id)) {
      return res.status(400).json({ message: 'You are already a member of this community' });
    }
    
    // Check if already requested
    const existingRequest = community.membershipRequests.find(
      request => request.user.toString() === req.user.id
    );
    
    if (existingRequest) {
      return res.status(400).json({ 
        message: `You have already requested to join this community. Status: ${existingRequest.status}` 
      });
    }
    
    // Get the reason from request body
    const { reason } = req.body;
    
    // Add membership request with reason
    community.membershipRequests.push({
      user: req.user.id,
      reason: reason || '',
      status: 'pending'
    });
    
    await community.save();
    
    // Create notification for the community admin
    const Notification = require('../models/Notification');
    const User = require('../models/User');
    
    // Get the user making the request to include their name
    const requestingUser = await User.findById(req.user.id).select('name email');
    
    // Create a notification for the community admin
    await Notification.create({
      recipient: community.admin,
      type: 'new_membership_request',
      title: 'New Join Request',
      message: `${requestingUser.name} (${requestingUser.email}) has requested to join your community ${community.name}.`,
      relatedId: community._id,
      onModel: 'Community'
    });
    
    res.json({ 
      message: 'Membership request submitted successfully' 
    });
  } catch (error) {
    console.error('Error requesting community membership:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Community not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve/reject join request (community admin only)
router.put('/:id/requests/:requestId', specificCommunityAdminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // Log who's making this request for debugging purposes
    console.log(`Processing membership request by admin ${req.user._id}, isCommunityAdmin=${req.user.isCommunityAdmin}`);
    
    // We already have the community in req.community from the middleware
    const community = req.community;
    
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
        console.log(`User ${userId} has been added to community ${community._id}`);
      }
    }
    
    await community.save();
    
    // Create notification for the user
    try {
      const userId = community.membershipRequests[requestIndex].user;
      await Notification.create({
        recipient: userId,
        type: status === 'approved' ? 'request_approved' : 'request_rejected',
        title: status === 'approved' ? 'Join Request Approved' : 'Join Request Rejected',
        message: status === 'approved' 
          ? `Your request to join ${community.name} has been approved!` 
          : `Your request to join ${community.name} has been rejected.`,
        relatedId: community._id,
        onModel: 'Community'
      });
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
      // Don't fail the request if notification fails
    }
    
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

// Get membership requests (community admin only)
router.get('/:id/membership-requests', specificCommunityAdminAuth, async (req, res) => {
  try {
    console.log(`Fetching membership requests for community: ${req.params.id}`);
    console.log(`Requesting user ID: ${req.user.id}`);
    
    // Ensure we're properly populating the user field with all required information
    const community = await Community.findById(req.params.id)
      .populate({
        path: 'membershipRequests.user',
        select: 'name email _id'
      });
    
    if (!community) {
      console.log('Community not found');
      return res.status(404).json({ message: 'Community not found' });
    }
    
    // Verify user is admin of this community
    if (community.admin.toString() !== req.user.id) {
      console.log(`User ${req.user.id} is not the admin of community ${req.params.id}`);
      console.log(`Community admin is: ${community.admin}`);
      return res.status(403).json({ message: 'You are not the admin of this community' });
    }
    
    // Check if there are any membership requests at all
    if (!community.membershipRequests || community.membershipRequests.length === 0) {
      console.log('No membership requests found in this community');
      return res.json([]);
    }
    
    // Filter to only pending requests
    const pendingRequests = community.membershipRequests.filter(request => request.status === 'pending');
    console.log(`Found ${pendingRequests.length} pending membership requests out of ${community.membershipRequests.length} total`);
    
    // Make sure each request has a properly populated user
    pendingRequests.forEach((request, index) => {
      console.log(`Request ${index + 1}:`, {
        id: request._id,
        userId: request.user?._id || 'Missing user ID',
        userName: request.user?.name || 'Missing user name',
        status: request.status,
        reason: request.reason
      });
    });
    
    res.json(pendingRequests);
  } catch (error) {
    console.error('Error fetching membership requests:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Community not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Handle membership request (community admin only)
router.put('/:id/membership-requests/:userId', specificCommunityAdminAuth, async (req, res) => {
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
      return res.status(403).json({ message: 'You are not the admin of this community' });
    }
    
    // Find the request
    const requestIndex = community.membershipRequests.findIndex(
      request => request.user.toString() === req.params.userId
    );
    
    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Membership request not found' });
    }
    
    // Update request status
    community.membershipRequests[requestIndex].status = status;
    
    // If approved, add user to members
    if (status === 'approved') {
      community.members.push(req.params.userId);
      
      // Update user's community
      await User.findByIdAndUpdate(
        req.params.userId,
        { community: community._id }
      );
    }
    
    await community.save();
    
    // Send notification to the user about their request status
    try {
      await Notification.create({
        recipient: req.params.userId,
        type: status === 'approved' ? 'request_approved' : 'request_rejected',
        message: status === 'approved' 
          ? `Your request to join ${community.name} has been approved!` 
          : `Your request to join ${community.name} has been rejected.`,
        relatedId: community._id,
        isRead: false
      });
      
      console.log(`Notification created for user ${req.params.userId} about their ${status} join request`);
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
      // Don't fail the request if notification creation fails
    }
    
    res.json({ 
      message: `Membership request ${status}` 
    });
  } catch (error) {
    console.error('Error handling membership request:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Community or user not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject community (walmart only)
router.put('/:id/reject', walmartAuth, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }
    
    // Instead of deleting, we'll mark it as rejected but keep the record
    community.isApproved = false;
    community.status = 'rejected'; // Add a status field if it doesn't exist
    
    await community.save();
    
    // Create notification for the community creator
    await Notification.create({
      recipient: community.admin,
      type: 'community_rejected',
      title: 'Community Rejected',
      message: `Your community "${community.name}" has not been approved. ${req.body.reason || 'No specific reason provided.'}`,
      relatedId: community._id,
      onModel: 'Community'
    });
    
    res.json({ 
      message: 'Community rejected',
      community 
    });
  } catch (error) {
    console.error('Error rejecting community:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Community not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
