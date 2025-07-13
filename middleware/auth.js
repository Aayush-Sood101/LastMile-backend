const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getTokenFromHeaders = (req) => {
  // Try Authorization header first
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }
  
  // Then try x-auth-token
  const xAuthToken = req.header('x-auth-token');
  if (xAuthToken) {
    return xAuthToken;
  }
  
  return null;
};

const auth = async (req, res, next) => {
  try {
    const token = getTokenFromHeaders(req);
    
    if (!token) {
      throw new Error('No authentication token provided');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      throw new Error('User not found');
    }

    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({ message: 'Not authorized', error: error.message });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    const token = getTokenFromHeaders(req);
    
    if (!token) {
      throw new Error('No authentication token provided');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.role !== 'admin') {
      throw new Error('User is not an admin');
    }

    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error.message);
    res.status(401).json({ message: 'Not authorized as admin', error: error.message });
  }
};

const walmartAuth = async (req, res, next) => {
  try {
    const token = getTokenFromHeaders(req);
    
    if (!token) {
      throw new Error('No authentication token provided');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.role !== 'walmart') {
      console.log('walmartAuth: Not authorized as Walmart');
      throw new Error('User is not a Walmart admin');
    }
    console.log('walmartAuth: Authorized Walmart user', user.email);
    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized as Walmart' });
  }
};

const communityAdminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      throw new Error('User not found');
    }
    
    // Check if user has isCommunityAdmin flag
    if (!user.isCommunityAdmin) {
      // If not, check if they're listed as an admin in any community
      const Community = require('../models/Community');
      const adminCommunity = await Community.findOne({ admin: user._id });
      
      if (!adminCommunity) {
        console.log('Auth failed: User is not a community admin', { 
          userId: user._id,
          isCommunityAdmin: user.isCommunityAdmin
        });
        throw new Error('Not a community admin');
      }
      
      // If they're an admin but don't have the flag, update their record
      console.log(`Updating user ${user._id} to set isCommunityAdmin flag`);
      await User.findByIdAndUpdate(user._id, { isCommunityAdmin: true });
      user.isCommunityAdmin = true;
    }

    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    console.error('Community admin auth error:', error.message);
    res.status(401).json({ message: 'Not authorized as community admin' });
  }
};

module.exports = { auth, adminAuth, walmartAuth, communityAdminAuth };
