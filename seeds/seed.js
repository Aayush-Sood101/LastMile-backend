const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Product = require('../models/Product');
const Community = require('../models/Community');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const bcrypt = require('bcryptjs');
const path = require('path');

// Load environment variables
console.log('Current directory:', __dirname);
console.log('Looking for .env in:', path.resolve(__dirname, '..', '.env'));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Connect to MongoDB
console.log('MongoDB URI:', process.env.MONGODB_URI);
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected for seeding'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Sample data
const users = [
  {
    name: 'Walmart Admin',
    email: 'walmart@admin.com',
    password: 'password123',
    role: 'walmart',
    address: {
      street: '123 Walmart St',
      city: 'Bentonville',
      state: 'AR',
      zipCode: '72712'
    }
  },
  {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'password123',
    role: 'user',
    address: {
      street: '456 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001'
    },
    isCommunityAdmin: true,
    carbonFootprintSaved: 25.5
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    password: 'password123',
    role: 'user',
    address: {
      street: '789 Oak St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001'
    },
    carbonFootprintSaved: 10.2
  },
  {
    name: 'Mike Johnson',
    email: 'mike@example.com',
    password: 'password123',
    role: 'user',
    address: {
      street: '101 Pine St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001'
    }
  }
];

const products = [
  {
    name: 'Organic Bananas',
    description: 'Fresh organic bananas, bundle of 5',
    price: 3.99,
    category: 'Groceries',
    communityDiscountPercentage: 10,
    imageUrl: 'https://example.com/images/bananas.jpg',
    carbonFootprint: {
      individual: 2.5,
      community: 0.8
    }
  },
  {
    name: 'Whole Wheat Bread',
    description: 'Freshly baked whole wheat bread',
    price: 4.49,
    category: 'Groceries',
    communityDiscountPercentage: 8,
    imageUrl: 'https://example.com/images/bread.jpg',
    carbonFootprint: {
      individual: 1.8,
      community: 0.6
    }
  },
  {
    name: 'Almond Milk',
    description: 'Unsweetened almond milk, 64 oz',
    price: 3.79,
    category: 'Groceries',
    communityDiscountPercentage: 5,
    imageUrl: 'https://example.com/images/almond-milk.jpg',
    carbonFootprint: {
      individual: 2.0,
      community: 0.7
    }
  },
  {
    name: 'Paper Towels',
    description: 'Pack of 6 rolls, select-a-size',
    price: 9.99,
    category: 'Household',
    communityDiscountPercentage: 15,
    imageUrl: 'https://example.com/images/paper-towels.jpg',
    carbonFootprint: {
      individual: 3.5,
      community: 1.2
    }
  },
  {
    name: 'Dish Soap',
    description: 'Liquid dish soap, lemon scent, 32 oz',
    price: 2.99,
    category: 'Household',
    communityDiscountPercentage: 10,
    imageUrl: 'https://example.com/images/dish-soap.jpg',
    carbonFootprint: {
      individual: 1.5,
      community: 0.5
    }
  },
  {
    name: 'Ibuprofen',
    description: 'Pain reliever/fever reducer, 100 tablets',
    price: 7.49,
    category: 'Health',
    communityDiscountPercentage: 5,
    imageUrl: 'https://example.com/images/ibuprofen.jpg',
    carbonFootprint: {
      individual: 1.0,
      community: 0.3
    }
  },
  {
    name: 'Toothpaste',
    description: 'Mint flavor, cavity protection, 5.2 oz',
    price: 3.29,
    category: 'Health',
    communityDiscountPercentage: 8,
    imageUrl: 'https://example.com/images/toothpaste.jpg',
    carbonFootprint: {
      individual: 0.8,
      community: 0.3
    }
  }
];

// Seed function
const seedDatabase = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Product.deleteMany({});
    await Community.deleteMany({});
    await Order.deleteMany({});
    await Cart.deleteMany({});
    
    console.log('Database cleared');
    
    // Create users
    const createdUsers = await User.create(users);
    console.log(`${createdUsers.length} users created`);
    
    // Create products
    const createdProducts = await Product.create(products);
    console.log(`${createdProducts.length} products created`);
    
    // Create a community
    const community = await Community.create({
      name: 'Downtown Apartments',
      description: 'Community for residents of Downtown Apartments complex',
      location: {
        address: '456 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001'
      },
      admin: createdUsers[1]._id, // John Doe
      members: [createdUsers[1]._id, createdUsers[2]._id], // John and Jane
      isApproved: true,
      totalCarbonFootprintSaved: 35.7
    });
    console.log('Community created');
    
    // Update users with community
    await User.updateMany(
      { _id: { $in: [createdUsers[1]._id, createdUsers[2]._id] } },
      { community: community._id }
    );
    console.log('Users updated with community');
    
    // Create a pending community
    await Community.create({
      name: 'Sunset Neighborhood',
      description: 'Community for residents of Sunset Neighborhood',
      location: {
        address: '101 Pine St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001'
      },
      admin: createdUsers[3]._id, // Mike Johnson
      members: [createdUsers[3]._id],
      isApproved: false
    });
    console.log('Pending community created');
    
    // Create sample orders
    const sampleOrders = [
      {
        user: createdUsers[1]._id, // John
        community: community._id,
        items: [
          {
            product: createdProducts[0]._id,
            quantity: 2,
            price: createdProducts[0].price * 0.9 // 10% discount
          },
          {
            product: createdProducts[3]._id,
            quantity: 1,
            price: createdProducts[3].price * 0.85 // 15% discount
          }
        ],
        totalPrice: (createdProducts[0].price * 2 * 0.9) + (createdProducts[3].price * 0.85),
        shippingAddress: createdUsers[1].address,
        paymentMethod: 'credit_card',
        paymentStatus: 'completed',
        orderStatus: 'delivered',
        isGroupOrder: true,
        carbonFootprintSaved: 5.2
      },
      {
        user: createdUsers[2]._id, // Jane
        community: community._id,
        items: [
          {
            product: createdProducts[1]._id,
            quantity: 1,
            price: createdProducts[1].price * 0.92 // 8% discount
          },
          {
            product: createdProducts[6]._id,
            quantity: 2,
            price: createdProducts[6].price * 0.92 // 8% discount
          }
        ],
        totalPrice: (createdProducts[1].price * 0.92) + (createdProducts[6].price * 2 * 0.92),
        shippingAddress: createdUsers[2].address,
        paymentMethod: 'credit_card',
        paymentStatus: 'completed',
        orderStatus: 'delivered',
        isGroupOrder: true,
        carbonFootprintSaved: 2.7
      },
      {
        user: createdUsers[3]._id, // Mike (no community)
        items: [
          {
            product: createdProducts[2]._id,
            quantity: 1,
            price: createdProducts[2].price
          },
          {
            product: createdProducts[4]._id,
            quantity: 1,
            price: createdProducts[4].price
          }
        ],
        totalPrice: createdProducts[2].price + createdProducts[4].price,
        shippingAddress: createdUsers[3].address,
        paymentMethod: 'paypal',
        paymentStatus: 'completed',
        orderStatus: 'delivered',
        isGroupOrder: false,
        carbonFootprintSaved: 0
      }
    ];
    
    await Order.create(sampleOrders);
    console.log(`${sampleOrders.length} orders created`);
    
    console.log('Database seeded successfully');
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the seed function
seedDatabase();
