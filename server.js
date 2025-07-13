const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

// Import routes
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const communityRoutes = require('./routes/communities');
const cartRoutes = require('./routes/carts');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const deliveryCycleRoutes = require('./routes/deliveryCycles');
const communityCartRoutes = require('./routes/communityCarts');
const pricingRoutes = require('./routes/pricing');
const notificationRoutes = require('./routes/notifications');
const logisticsRoutes = require('./routes/logistics');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Enhanced CORS configuration
const corsOptions = {
  origin: ['http://localhost:3000', 'https://lastmile-frontend.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/delivery-cycles', deliveryCycleRoutes);
app.use('/api/community-carts', communityCartRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/logistics', logisticsRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Neighborhood Bulk Order Coordinator API is running');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
