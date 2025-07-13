const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const { auth } = require('../middleware/auth');

/**
 * Calculate the number of trucks required based on volume and weight constraints
 */
function calculateTrucksRequired(
  quantities, 
  volumePerUnit, 
  weightPerUnit, 
  truckVolume = 15.0, 
  truckWeight = 3000.0
) {
  // Calculate total volume and weight
  let totalVolume = 0;
  let totalWeight = 0;
  
  for (let i = 0; i < quantities.length; i++) {
    totalVolume += quantities[i] * volumePerUnit[i];
    totalWeight += quantities[i] * weightPerUnit[i];
  }
  
  // Calculate trucks needed by volume and weight
  const trucksByVolume = Math.ceil(totalVolume / truckVolume);
  const trucksByWeight = Math.ceil(totalWeight / truckWeight);
  
  // Return the maximum of the two
  return Math.max(trucksByVolume, trucksByWeight);
}

/**
 * Calculate CO2 emission savings from bulk delivery vs individual deliveries
 */
function calculateCO2Savings({
  numHouseholds = 50,
  indivDistanceKm = 4,     // avg per household trip
  bulkDistanceKm = 10,     // warehouse to community
  emissionIndiv = 0.18,    // kg CO2/km (bike/scooter)
  emissionTruck = 0.55,    // kg CO2/km (truck)
  numTrucks = 1
}) {
  // Calculate CO2 for individual deliveries
  const emissionIndividual = numHouseholds * indivDistanceKm * emissionIndiv;
  
  // Calculate CO2 for bulk delivery
  const emissionBulk = numTrucks * bulkDistanceKm * emissionTruck;
  
  // Calculate saved emissions
  const emissionSaved = emissionIndividual - emissionBulk;
  const relativeReduction = (emissionSaved / emissionIndividual) * 100;
  
  // Return detailed results
  return {
    numHouseholds,
    emissionIndividual,
    emissionBulk,
    emissionSaved,
    relativeReduction,
    numTrucks,
    indivDistanceKm,
    bulkDistanceKm
  };
}

/**
 * Logistic map for chaos
 */
function logisticMap(c, mu = 4.0) {
  return mu * c * (1 - c);
}

/**
 * Define the margin constraint function
 */
function marginConstraint(discounts, quantities, retailPrices, supplierCosts, operationalCosts, targetMargin, transportCost) {
  let sum = 0;
  
  for (let i = 0; i < discounts.length; i++) {
    const term = quantities[i] * ((1 - targetMargin) * retailPrices[i] * 
                                  (1 - discounts[i]) - supplierCosts[i] - operationalCosts[i]);
    sum += term;
  }
  
  // Include transport cost in constraint
  return sum - transportCost;
}

/**
 * Define objective function (maximize total weighted discount)
 */
function objective(discounts, quantities) {
  let sum = 0;
  for (let i = 0; i < discounts.length; i++) {
    sum += quantities[i] * discounts[i];
  }
  return sum;
}

/**
 * Stage 1: Chaotic initialization
 */
function chaoticInitialization(numIterations, numDimensions, maxDiscount, quantities, retailPrices, supplierCosts, operationalCosts, targetMargin, transportCost) {
  let c = 0.7; // Initial chaotic value
  let bestDiscounts = null;
  let bestObjectiveValue = -Infinity;
  
  console.log('Starting chaotic initialization with parameters:', {
    numIterations,
    numDimensions,
    maxDiscount,
    targetMargin,
    transportCost
  });
  
  for (let k = 0; k < numIterations; k++) {
    c = logisticMap(c);
    
    // Create different discount for each product, not uniform
    const discounts = Array(numDimensions).fill(0).map(() => {
      c = logisticMap(c);
      return maxDiscount * c;
    });
    
    // Check if margin constraint is satisfied
    const constraintValue = marginConstraint(discounts, quantities, retailPrices, supplierCosts, operationalCosts, targetMargin, transportCost);
    if (constraintValue >= 0) {
      const objValue = objective(discounts, quantities);
      
      if (objValue > bestObjectiveValue) {
        bestObjectiveValue = objValue;
        bestDiscounts = [...discounts];
      }
    }
  }
  
  // If no feasible solution found, try with minimal discounts
  if (!bestDiscounts) {
    console.log('No solution found in chaotic initialization, trying minimal discounts');
    // Try a more conservative approach with very small discounts
    for (let attempt = 0; attempt < 100; attempt++) {
      const smallDiscounts = Array(numDimensions).fill(0).map(() => Math.random() * 0.05); // 0-5% discount
      
      if (marginConstraint(smallDiscounts, quantities, retailPrices, supplierCosts, operationalCosts, targetMargin, transportCost) >= 0) {
        console.log('Found feasible solution with minimal discounts');
        return smallDiscounts;
      }
    }
    
    // If all else fails, try zero discounts
    const zeroDiscounts = Array(numDimensions).fill(0);
    if (marginConstraint(zeroDiscounts, quantities, retailPrices, supplierCosts, operationalCosts, targetMargin, transportCost) >= 0) {
      console.log('Only zero discounts are feasible');
      return zeroDiscounts;
    }
  }
  
  console.log('Chaotic initialization result:', bestDiscounts ? 'Found solution' : 'No solution found');
  return bestDiscounts;
}

/**
 * Utility function to clamp values between bounds
 */
function clamp(x, lower, upper) {
  return Math.min(Math.max(x, lower), upper);
}

/**
 * Stage 2: Pattern search
 */
function patternSearch(initialDiscounts, quantities, retailPrices, supplierCosts, operationalCosts, targetMargin, maxDiscount, transportCost, epsilon = 1e-4, maxIterations = 1000) {
  const discounts = [...initialDiscounts];
  const n = discounts.length;
  const delta = Array(n).fill(0.05); // Initial step sizes
  
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let improved = false;
    const Y = [...discounts];
    
    for (let i = 0; i < n; i++) {
      const fBase = objective(Y, quantities);
      
      // Try positive direction
      const YPos = [...Y];
      YPos[i] = clamp(YPos[i] + delta[i], 0, maxDiscount);
      
      if (marginConstraint(YPos, quantities, retailPrices, supplierCosts, operationalCosts, targetMargin, transportCost) >= 0 && 
          objective(YPos, quantities) > fBase) {
        // Copy YPos to Y
        for (let j = 0; j < n; j++) {
          Y[j] = YPos[j];
        }
        improved = true;
        continue;
      }
      
      // Try negative direction
      const YNeg = [...Y];
      YNeg[i] = clamp(YNeg[i] - delta[i], 0, maxDiscount);
      
      if (marginConstraint(YNeg, quantities, retailPrices, supplierCosts, operationalCosts, targetMargin, transportCost) >= 0 && 
          objective(YNeg, quantities) > fBase) {
        // Copy YNeg to Y
        for (let j = 0; j < n; j++) {
          Y[j] = YNeg[j];
        }
        improved = true;
        continue;
      }
    }
    
    if (improved) {
      // Pattern move
      const XNew = Array(n);
      for (let i = 0; i < n; i++) {
        XNew[i] = clamp(2 * Y[i] - discounts[i], 0, maxDiscount);
      }
      
      if (marginConstraint(XNew, quantities, retailPrices, supplierCosts, operationalCosts, targetMargin, transportCost) >= 0 && 
          objective(XNew, quantities) > objective(Y, quantities)) {
        // Copy XNew to discounts
        for (let i = 0; i < n; i++) {
          discounts[i] = XNew[i];
        }
      } else {
        // Copy Y to discounts
        for (let i = 0; i < n; i++) {
          discounts[i] = Y[i];
        }
      }
    } else {
      // Reduce step sizes
      for (let i = 0; i < n; i++) {
        delta[i] /= 2;
      }
    }
    
    // Check for convergence
    const maxDelta = Math.max(...delta);
    if (maxDelta < epsilon) {
      break;
    }
  }
  
  return discounts;
}

/**
 * @route   POST /api/logistics/optimize
 * @desc    Optimize discounts with logistics constraints
 * @access  Private (admin or walmart)
 */
router.post('/optimize', auth, async (req, res) => {
  try {
    console.log('Logistics optimization requested by user:', req.user.id, 'role:', req.user.role);
    
    // Check if user is admin or walmart
    if (req.user.role !== 'admin' && req.user.role !== 'walmart') {
      return res.status(403).json({ msg: 'Not authorized to access this resource' });
    }

    const {
      productIds,
      quantities,
      volumePerUnit,
      weightPerUnit,
      targetMargin = 0.2,
      maxDiscount = 0.5,
      distanceKm = 10,
      costPerKm = 55,
      numHouseholds = 50,
      truckVolume = 15.0,
      truckWeight = 3000.0
    } = req.body;
    
    console.log('Received optimization request with parameters:', { 
      numProducts: productIds?.length, 
      targetMargin, 
      maxDiscount, 
      distanceKm,
      costPerKm,
      numHouseholds
    });

    // VALIDATION START
    // 1. Check for required arrays
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      console.error('Missing or invalid productIds in request:', productIds);
      return res.status(400).json({ 
        msg: 'Missing or invalid required field: productIds',
        details: 'Must be a non-empty array'
      });
    }
    
    if (!quantities || !Array.isArray(quantities) || quantities.length === 0) {
      console.error('Missing or invalid quantities in request:', quantities);
      return res.status(400).json({ 
        msg: 'Missing or invalid required field: quantities',
        details: 'Must be a non-empty array'
      });
    }
    
    if (!volumePerUnit || !Array.isArray(volumePerUnit) || volumePerUnit.length === 0) {
      console.error('Missing or invalid volumePerUnit in request:', volumePerUnit);
      return res.status(400).json({ 
        msg: 'Missing or invalid required field: volumePerUnit',
        details: 'Must be a non-empty array'
      });
    }
    
    if (!weightPerUnit || !Array.isArray(weightPerUnit) || weightPerUnit.length === 0) {
      console.error('Missing or invalid weightPerUnit in request:', weightPerUnit);
      return res.status(400).json({ 
        msg: 'Missing or invalid required field: weightPerUnit',
        details: 'Must be a non-empty array'
      });
    }

    // 2. Check array lengths match
    if (productIds.length !== quantities.length || 
        productIds.length !== volumePerUnit.length || 
        productIds.length !== weightPerUnit.length) {
      console.error('Array length mismatch:', {
        productIdsLength: productIds.length,
        quantitiesLength: quantities.length,
        volumePerUnitLength: volumePerUnit.length,
        weightPerUnitLength: weightPerUnit.length
      });
      return res.status(400).json({ 
        msg: 'Arrays must be of equal length',
        details: {
          productIdsLength: productIds.length,
          quantitiesLength: quantities.length,
          volumePerUnitLength: volumePerUnit.length,
          weightPerUnitLength: weightPerUnit.length
        }
      });
    }
    
    // 3. Validate ObjectId format for productIds
    const invalidIds = productIds.filter(id => !id.match(/^[0-9a-fA-F]{24}$/));
    if (invalidIds.length > 0) {
      console.error('Invalid MongoDB ObjectId format in productIds:', invalidIds);
      return res.status(400).json({ 
        msg: 'Invalid product ID format',
        details: 'All productIds must be valid MongoDB ObjectIds',
        invalidIds
      });
    }
    
    // 4. Validate numeric arrays
    const invalidQuantities = quantities.filter(q => typeof q !== 'number' || isNaN(q) || q <= 0);
    if (invalidQuantities.length > 0) {
      console.error('Invalid quantities:', invalidQuantities);
      return res.status(400).json({ 
        msg: 'Invalid quantities',
        details: 'All quantities must be positive numbers'
      });
    }
    
    const invalidVolumes = volumePerUnit.filter(v => typeof v !== 'number' || isNaN(v) || v <= 0);
    if (invalidVolumes.length > 0) {
      console.error('Invalid volumePerUnit values:', invalidVolumes);
      return res.status(400).json({ 
        msg: 'Invalid volumePerUnit values',
        details: 'All volumePerUnit values must be positive numbers'
      });
    }
    
    const invalidWeights = weightPerUnit.filter(w => typeof w !== 'number' || isNaN(w) || w <= 0);
    if (invalidWeights.length > 0) {
      console.error('Invalid weightPerUnit values:', invalidWeights);
      return res.status(400).json({ 
        msg: 'Invalid weightPerUnit values',
        details: 'All weightPerUnit values must be positive numbers'
      });
    }
    
    // 5. Validate scalar parameters
    if (typeof targetMargin !== 'number' || isNaN(targetMargin) || targetMargin < 0 || targetMargin > 1) {
      console.error('Invalid targetMargin:', targetMargin);
      return res.status(400).json({ 
        msg: 'Invalid targetMargin',
        details: 'targetMargin must be a number between 0 and 1'
      });
    }
    
    if (typeof maxDiscount !== 'number' || isNaN(maxDiscount) || maxDiscount < 0 || maxDiscount > 1) {
      console.error('Invalid maxDiscount:', maxDiscount);
      return res.status(400).json({ 
        msg: 'Invalid maxDiscount',
        details: 'maxDiscount must be a number between 0 and 1'
      });
    }
    
    if (typeof distanceKm !== 'number' || isNaN(distanceKm) || distanceKm <= 0) {
      console.error('Invalid distanceKm:', distanceKm);
      return res.status(400).json({ 
        msg: 'Invalid distanceKm',
        details: 'distanceKm must be a positive number'
      });
    }
    
    if (typeof costPerKm !== 'number' || isNaN(costPerKm) || costPerKm <= 0) {
      console.error('Invalid costPerKm:', costPerKm);
      return res.status(400).json({ 
        msg: 'Invalid costPerKm',
        details: 'costPerKm must be a positive number'
      });
    }
    
    if (typeof numHouseholds !== 'number' || isNaN(numHouseholds) || numHouseholds <= 0) {
      console.error('Invalid numHouseholds:', numHouseholds);
      return res.status(400).json({ 
        msg: 'Invalid numHouseholds',
        details: 'numHouseholds must be a positive number'
      });
    }
    // VALIDATION END

    // Fetch products from database
    let products;
    try {
      console.log('Fetching products with IDs:', productIds);
      products = await Product.find({ _id: { $in: productIds } });
      console.log(`Found ${products.length} products out of ${productIds.length} requested`);
      
      if (products.length === 0) {
        return res.status(400).json({
          msg: 'No products found with the provided IDs',
          productIds
        });
      }
      
      if (products.length !== productIds.length) {
        // Find which product IDs were not found
        const foundIds = products.map(p => p._id.toString());
        const missingIds = productIds.filter(id => !foundIds.includes(id));
        console.error('Missing product IDs:', missingIds);
        return res.status(400).json({ 
          msg: 'Some products not found', 
          missingIds,
          foundIds
        });
      }
      
      // Validate that all products have the necessary price fields
      // If missing, apply defaults
      products = products.map(product => {
        const updatedProduct = { ...product.toObject() };
        
        // Check price
        if (typeof updatedProduct.price !== 'number' || isNaN(updatedProduct.price) || updatedProduct.price <= 0) {
          console.warn(`Product ${updatedProduct._id} has invalid price: ${updatedProduct.price}`);
          return null;
        }
        
        // Check/default costPrice
        if (typeof updatedProduct.costPrice !== 'number' || isNaN(updatedProduct.costPrice) || updatedProduct.costPrice <= 0) {
          console.warn(`Product ${updatedProduct._id} has invalid costPrice: ${updatedProduct.costPrice}, using default`);
          updatedProduct.costPrice = updatedProduct.price * 0.7; // Default to 70% of price
        }
        
        // Check/default operationalCost
        if (typeof updatedProduct.operationalCost !== 'number' || isNaN(updatedProduct.operationalCost) || updatedProduct.operationalCost < 0) {
          console.warn(`Product ${updatedProduct._id} has invalid operationalCost: ${updatedProduct.operationalCost}, using default`);
          updatedProduct.operationalCost = 5; // Default operational cost
        }
        
        return updatedProduct;
      }).filter(p => p !== null);
      
      if (products.length === 0) {
        return res.status(400).json({
          msg: 'All products have invalid price data',
          productIds
        });
      }
      
      if (products.length !== productIds.length) {
        const validIds = products.map(p => p._id.toString());
        const invalidIds = productIds.filter(id => !validIds.includes(id));
        console.error('Products with invalid price data:', invalidIds);
        return res.status(400).json({
          msg: 'Some products have invalid price data',
          invalidIds
        });
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      return res.status(500).json({ 
        msg: 'Error fetching products from database', 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }

    // Prepare data for optimization
    const supplierCosts = products.map(p => p.costPrice);
    const operationalCosts = products.map(p => p.operationalCost);
    const retailPrices = products.map(p => p.price);

    // Calculate number of trucks required
    const numTrucks = calculateTrucksRequired(
      quantities,
      volumePerUnit,
      weightPerUnit,
      truckVolume,
      truckWeight
    );
    
    console.log('Logistics calculation:', {
      numTrucks,
      distanceKm,
      costPerKm,
      transportCost: numTrucks * costPerKm * distanceKm
    });
    
    // Calculate transport cost
    const transportCost = numTrucks * costPerKm * distanceKm;
    
    // Check if optimization is feasible with zero discounts
    const zeroDiscounts = Array(productIds.length).fill(0);
    const zeroMarginConstraint = marginConstraint(
      zeroDiscounts, 
      quantities,
      retailPrices,
      supplierCosts,
      operationalCosts,
      targetMargin,
      transportCost
    );
    
    if (zeroMarginConstraint < 0) {
      console.error('Optimization is infeasible even with zero discounts:', {
        zeroMarginConstraint,
        targetMargin,
        transportCost
      });
      
      return res.status(400).json({
        success: false,
        msg: "Optimization infeasible with current parameters",
        details: "The target margin cannot be achieved even with zero discounts. Try reducing the target margin or adjusting other parameters."
      });
    }
    
    // Run optimization algorithm
    console.log('Starting chaotic initialization phase...');
    const numIterStage1 = 1000;
    const initialDiscounts = chaoticInitialization(
      numIterStage1, 
      supplierCosts.length, 
      maxDiscount,
      quantities,
      retailPrices,
      supplierCosts,
      operationalCosts,
      targetMargin,
      transportCost
    );
    
    if (!initialDiscounts) {
      console.error('No feasible solution found in initialization stage', {
        targetMargin,
        maxDiscount,
        transportCost
      });
      
      return res.status(400).json({
        success: false,
        msg: "No feasible solution found in initialization stage",
        details: "Try reducing the target margin or increasing the maximum allowable discount."
      });
    }
    
    // Run pattern search
    console.log('Starting pattern search phase...');
    let optimalDiscounts;
    try {
      optimalDiscounts = patternSearch(
        initialDiscounts,
        quantities,
        retailPrices,
        supplierCosts,
        operationalCosts,
        targetMargin,
        maxDiscount,
        transportCost
      );
      
      if (!optimalDiscounts) {
        throw new Error('Pattern search failed to produce a solution');
      }
    } catch (error) {
      console.error('Optimization algorithm error:', error);
      return res.status(500).json({
        success: false,
        msg: "Optimization algorithm error",
        error: error.message
      });
    }
    
    // Calculate final prices and profits
    const finalPrices = retailPrices.map((p, i) => p * (1 - optimalDiscounts[i]));
    const finalProfits = finalPrices.map((p, i) => 
      (p - supplierCosts[i] - operationalCosts[i]) * quantities[i]
    );
    const totalProfit = finalProfits.reduce((sum, p) => sum + p, 0);
    const totalRevenue = finalPrices.reduce((sum, p, i) => sum + p * quantities[i], 0);
    const finalMargin = totalRevenue > 0 ? totalProfit / totalRevenue : 0;
    
    // Validate the solution
    if (finalMargin < targetMargin * 0.95) {
      console.warn('Optimization warning: Final margin is significantly below target', {
        targetMargin,
        finalMargin,
        difference: targetMargin - finalMargin
      });
    }
    
    // Calculate CO2 savings
    console.log('Calculating CO2 emissions savings...');
    const emissions = calculateCO2Savings({
      numHouseholds,
      bulkDistanceKm: distanceKm,
      numTrucks
    });
    
    // Map results back to product information
    const productDetails = products.map((product, i) => ({
      id: product._id,
      name: product.name,
      retailPrice: retailPrices[i],
      supplierCost: supplierCosts[i],
      operationalCost: operationalCosts[i],
      discount: optimalDiscounts[i],
      finalPrice: finalPrices[i],
      quantity: quantities[i],
      profit: finalProfits[i]
    }));
    
    // Prepare response
    const result = {
      success: true,
      optimization: {
        productDetails,
        totalRevenue,
        totalProfit,
        finalMargin,
        transportCost,
        targetMargin, // Include the target for reference
        maxDiscount   // Include the max discount for reference
      },
      logistics: {
        numTrucks,
        distanceKm,
        costPerKm,
        totalTransportCost: transportCost,
        totalVolume: quantities.reduce((sum, q, i) => sum + q * volumePerUnit[i], 0),
        totalWeight: quantities.reduce((sum, q, i) => sum + q * weightPerUnit[i], 0)
      },
      emissions
    };
    
    console.log('Optimization successful');
    
    res.json(result);
  } catch (error) {
    console.error('Error in logistics optimization:', error);
    
    // Provide more detailed error message based on error type
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        msg: 'Validation error', 
        error: error.message,
        details: error.errors 
      });
    } else if (error.name === 'CastError') {
      return res.status(400).json({ 
        msg: 'Invalid ID format', 
        error: error.message,
        details: error.path 
      });
    } else if (error.code === 11000) {
      return res.status(400).json({ 
        msg: 'Duplicate key error', 
        error: error.message,
        details: error.keyValue 
      });
    } else {
      return res.status(500).json({ 
        msg: 'Server error', 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
});

/**
 * @route   GET /api/logistics/co2-savings/:orderId
 * @desc    Calculate CO2 savings for an order
 * @access  Private
 */
router.get('/co2-savings/:orderId', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { distanceKm = 10, numHouseholds = 50 } = req.query;
    
    // Find the order
    const order = await Order.findById(orderId).populate('items.product');
    
    if (!order) {
      return res.status(404).json({ msg: 'Order not found' });
    }
    
    // Calculate volume and weight for the order
    let totalVolume = 0;
    let totalWeight = 0;
    
    order.items.forEach(item => {
      // Default values if not specified
      const volume = item.product.volume || 0.02; // cubic meters
      const weight = item.product.weight || 1.5; // kg
      
      totalVolume += item.quantity * volume;
      totalWeight += item.quantity * weight;
    });
    
    // Calculate trucks required
    const numTrucks = calculateTrucksRequired(
      [1],
      [totalVolume],
      [totalWeight]
    );
    
    // Calculate CO2 savings
    const emissions = calculateCO2Savings({
      numHouseholds: parseInt(numHouseholds),
      bulkDistanceKm: parseFloat(distanceKm),
      numTrucks
    });
    
    res.json({
      success: true,
      orderId,
      totalVolume,
      totalWeight,
      numTrucks,
      emissions
    });
  } catch (error) {
    console.error('Error calculating CO2 savings:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
});

module.exports = router;
