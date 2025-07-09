# Neighborhood Bulk Order Coordinator - Backend

This is the backend API for the Neighborhood Bulk Order Coordinator application, which allows neighbors to opt into grouped deliveries to save money and reduce emissions.

## Project Overview

The Neighborhood Bulk Order Coordinator aims to solve the problem of costly and repetitive last-mile deliveries by allowing neighbors to coordinate bulk orders, especially in apartments or hostels.

## Features

- User authentication and authorization
- Community creation and management
- Product catalog management
- Shopping cart functionality
- Order processing
- Carbon footprint tracking
- Admin dashboard for Walmart
- Community admin dashboard

## Tech Stack

- Node.js
- Express
- MongoDB with Mongoose
- JWT for authentication
- bcryptjs for password hashing

## Getting Started

### Prerequisites

- Node.js (v16+)
- MongoDB

### Installation

1. Clone the repository
2. Navigate to the backend directory
   ```bash
   cd backend
   ```
3. Install dependencies
   ```bash
   npm install
   ```
4. Create a `.env` file based on `.env.example`
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/neighborhood_bulk_order
   JWT_SECRET=your_jwt_secret_here
   ```

### Database Seeding

To populate the database with sample data:

```bash
npm run seed
```

This will create:
- Sample users (including a Walmart admin)
- Sample products
- Sample communities
- Sample orders

### Running the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### Authentication
- POST `/api/users/register` - Register a new user
- POST `/api/users/login` - Login user

### Users
- GET `/api/users/me` - Get current user profile
- PUT `/api/users/me` - Update current user profile

### Products
- GET `/api/products` - Get all products
- GET `/api/products/:id` - Get product by ID
- GET `/api/products/category/:category` - Get products by category
- POST `/api/products` - Create new product (admin only)
- PUT `/api/products/:id` - Update product (admin only)
- DELETE `/api/products/:id` - Delete product (admin only)

### Communities
- GET `/api/communities` - Get all communities
- GET `/api/communities/:id` - Get community by ID
- POST `/api/communities` - Create new community
- PUT `/api/communities/:id/approve` - Approve community (Walmart only)
- POST `/api/communities/:id/join` - Request to join community
- PUT `/api/communities/:id/requests/:requestId` - Approve/reject join request

### Cart
- GET `/api/cart` - Get user's cart
- POST `/api/cart/add-item` - Add item to cart
- PUT `/api/cart/update-item` - Update item quantity
- DELETE `/api/cart/remove-item/:productId` - Remove item from cart
- DELETE `/api/cart/clear` - Clear cart
- GET `/api/cart/carbon-footprint` - Get carbon footprint comparison

### Orders
- POST `/api/orders` - Create new order
- GET `/api/orders` - Get all orders for a user
- GET `/api/orders/:id` - Get specific order
- GET `/api/orders/community/:communityId` - Get orders for a community
- GET `/api/orders/carbon-stats/user` - Get carbon footprint statistics for user

### Admin (Walmart)
- GET `/api/admin/dashboard` - Get dashboard data
- GET `/api/admin/community-requests` - Get pending community approval requests
- GET `/api/admin/orders` - Get all orders data
- GET `/api/admin/user-stats` - Get user statistics

## License

This project is licensed under the ISC License.
