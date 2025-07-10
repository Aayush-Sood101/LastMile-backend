const express = require('express');
const { walmartAuth } = require('../middleware/auth');
const Order = require('../models/Order');
const Community = require('../models/Community');
const User = require('../models/User');
const router = express.Router();

// Get dashboard data for Walmart admin
router.get('/dashboard', walmartAuth, async (req, res) => {
  try {
    // Get total carbon footprint saved
    const totalCarbonSaved = await Order.aggregate([
      { $group: { _id: null, total: { $sum: '$carbonFootprintSaved' } } }
    ]);
    
    // Get communities carbon footprint data
    const communityCarbonData = await Community.find({ isApproved: true })
      .select('name totalCarbonFootprintSaved')
      .sort({ totalCarbonFootprintSaved: -1 });
    
    // Get community approval requests count
    const pendingCommunitiesCount = await Community.countDocuments({ 
      isApproved: false 
    });
    
    // Get recent group orders
    const recentGroupOrders = await Order.find({ 
      isGroupOrder: true 
    })
      .populate('community', 'name')
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Get order statistics
    const orderStats = await Order.aggregate([
      { 
        $group: { 
          _id: '$isGroupOrder', 
          count: { $sum: 1 },
          totalValue: { $sum: '$totalPrice' }
        }
      }
    ]);
    
    const individualOrders = orderStats.find(stat => !stat._id) || { count: 0, totalValue: 0 };
    const groupOrders = orderStats.find(stat => stat._id) || { count: 0, totalValue: 0 };
    
    res.json({
      totalCarbonFootprintSaved: totalCarbonSaved.length ? totalCarbonSaved[0].total : 0,
      communityCarbonData,
      pendingCommunitiesCount,
      recentGroupOrders,
      orderStats: {
        individual: {
          count: individualOrders.count,
          totalValue: individualOrders.totalValue
        },
        group: {
          count: groupOrders.count,
          totalValue: groupOrders.totalValue
        }
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get community creation requests (walmart only)
router.get('/community-requests', walmartAuth, async (req, res) => {
  try {
    const pendingCommunities = await Community.find({ isApproved: false })
      .populate('admin', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(pendingCommunities);
  } catch (error) {
    console.error('Error fetching community requests:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all communities with membership stats (walmart only)
router.get('/communities', walmartAuth, async (req, res) => {
  try {
    const communities = await Community.find()
      .populate('admin', 'name email')
      .select('-membershipRequests');
    
    const communitiesWithStats = await Promise.all(communities.map(async (community) => {
      // Get active cart
      const activeCart = await CommunityCart.findOne({ 
        community: community._id,
        isLocked: false 
      });
      
      // Get upcoming delivery cycle
      const today = new Date();
      const upcomingDeliveryCycle = await DeliveryCycle.findOne({
        community: community._id,
        scheduledDate: { $gte: today },
        status: { $in: ['scheduled', 'in-progress'] }
      }).sort({ scheduledDate: 1 });
      
      return {
        ...community._doc,
        memberCount: community.members.length,
        hasActiveCart: !!activeCart,
        upcomingDelivery: upcomingDeliveryCycle ? {
          id: upcomingDeliveryCycle._id,
          date: upcomingDeliveryCycle.scheduledDate,
          status: upcomingDeliveryCycle.status
        } : null
      };
    }));
    
    res.json(communitiesWithStats);
  } catch (error) {
    console.error('Error fetching communities with stats:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all orders data (for analytics)
router.get('/orders', walmartAuth, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('community', 'name')
      .populate('user', 'name')
      .sort({ createdAt: -1 });
    
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders data:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user statistics
router.get('/user-stats', walmartAuth, async (req, res) => {
  try {
    // Count users with and without communities
    const userStats = await User.aggregate([
      { 
        $match: { 
          role: 'user' 
        } 
      },
      {
        $group: {
          _id: { 
            hasCommunity: { 
              $cond: [{ $ne: ['$community', null] }, true, false] 
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const withCommunity = userStats.find(stat => stat._id.hasCommunity) || { count: 0 };
    const withoutCommunity = userStats.find(stat => !stat._id.hasCommunity) || { count: 0 };
    
    res.json({
      totalUsers: withCommunity.count + withoutCommunity.count,
      communityUsers: withCommunity.count,
      nonCommunityUsers: withoutCommunity.count
    });
  } catch (error) {
    console.error('Error fetching user statistics:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
