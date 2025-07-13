const express = require('express');
const { auth, adminAuth, walmartAuth } = require('../middleware/auth');
const Product = require('../models/Product');
const router = express.Router();

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({ inStock: true });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Get products by category
router.get('/category/:category', async (req, res) => {
  try {
    const products = await Product.find({ 
      category: req.params.category,
      inStock: true 
    });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products by category:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new product (walmart admin only)
router.post('/', walmartAuth, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      price, 
      category, 
      imageUrl,
      communityDiscountPercentage,
      carbonFootprint 
    } = req.body;

    const newProduct = new Product({
      name,
      description,
      price,
      category,
      imageUrl,
      communityDiscountPercentage,
      carbonFootprint
    });

    const product = await newProduct.save();
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update product (walmart admin only)
router.put('/:id', walmartAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const { 
      name, 
      description, 
      price, 
      category, 
      imageUrl,
      inStock,
      communityDiscountPercentage,
      carbonFootprint,
      discountPercentage,
      discountedPrice
    } = req.body;
    
    if (name) product.name = name;
    if (description) product.description = description;
    if (price) product.price = price;
    if (category) product.category = category;
    if (imageUrl) product.imageUrl = imageUrl;
    if (inStock !== undefined) product.inStock = inStock;
    if (communityDiscountPercentage) product.communityDiscountPercentage = communityDiscountPercentage;
    if (carbonFootprint) product.carbonFootprint = carbonFootprint;
    if (discountPercentage !== undefined) product.discountPercentage = discountPercentage;
    if (discountedPrice !== undefined) product.discountedPrice = discountedPrice;
    
    await product.save();
    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete product (walmart admin only)
router.delete('/:id', walmartAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    await product.deleteOne();
    res.json({ message: 'Product removed' });
  } catch (error) {
    console.error('Error deleting product:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
