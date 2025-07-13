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
  
  for (let k = 0; k < numIterations; k++) {
    c = logisticMap(c);
    
    // Create uniform discounts for all products
    const discounts = Array(numDimensions).fill(0 + (maxDiscount - 0) * c);
    
    // Check if margin constraint is satisfied
    if (marginConstraint(discounts, quantities, retailPrices, supplierCosts, operationalCosts, targetMargin, transportCost) >= 0) {
      const objValue = objective(discounts, quantities);
      
      if (objValue > bestObjectiveValue) {
        bestObjectiveValue = objValue;
        bestDiscounts = [...discounts];
      }
    }
  }
  
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
 * @access  Private (admin)
 */
router.post('/optimize', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
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

    // Validate inputs
    if (!productIds || !quantities || !volumePerUnit || !weightPerUnit) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }

    if (productIds.length !== quantities.length || 
        productIds.length !== volumePerUnit.length || 
        productIds.length !== weightPerUnit.length) {
      return res.status(400).json({ msg: 'Arrays must be of equal length' });
    }

    // Fetch products from database
    const products = await Product.find({ _id: { $in: productIds } });
    
    if (products.length !== productIds.length) {
      return res.status(400).json({ msg: 'Some products not found' });
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
    
    // Calculate transport cost
    const transportCost = numTrucks * costPerKm * distanceKm;
    
    // Run optimization algorithm
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
      return res.status(400).json({
        success: false,
        message: "No feasible solution found in initialization stage"
      });
    }
    
    // Run pattern search
    const optimalDiscounts = patternSearch(
      initialDiscounts,
      quantities,
      retailPrices,
      supplierCosts,
      operationalCosts,
      targetMargin,
      maxDiscount,
      transportCost
    );
    
    // Calculate final results
    const finalPrices = retailPrices.map((p, i) => p * (1 - optimalDiscounts[i]));
    const profitPerProduct = finalPrices.map((p, i) => 
      (p - supplierCosts[i] - operationalCosts[i]) * quantities[i]
    );
    
    const totalProfit = profitPerProduct.reduce((sum, p) => sum + p, 0) - transportCost;
    const totalRevenue = finalPrices.reduce((sum, p, i) => sum + p * quantities[i], 0);
    const finalMargin = totalRevenue > 0 ? totalProfit / totalRevenue : 0;
    
    // Calculate CO2 savings
    const co2Savings = calculateCO2Savings({
      numHouseholds,
      bulkDistanceKm: distanceKm,
      numTrucks
    });
    
    // Prepare detailed results
    const productDetails = [];
    for (let i = 0; i < optimalDiscounts.length; i++) {
      productDetails.push({
        productId: productIds[i],
        name: products[i].name,
        discount: optimalDiscounts[i],
        finalPrice: finalPrices[i],
        profit: profitPerProduct[i],
        quantity: quantities[i],
        volume: volumePerUnit[i],
        weight: weightPerUnit[i],
        supplierCost: supplierCosts[i],
        operationalCost: operationalCosts[i],
        retailPrice: retailPrices[i]
      });
    }
    
    return res.json({
      success: true,
      optimization: {
        discounts: optimalDiscounts,
        finalPrices,
        profitPerProduct,
        totalProfit,
        totalRevenue,
        finalMargin,
        transportCost,
        productDetails
      },
      logistics: {
        numTrucks,
        distanceKm,
        costPerKm,
        totalTransportCost: transportCost
      },
      emissions: co2Savings
    });
    
  } catch (err) {
    console.error('Error in logistics optimization:', err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   GET /api/logistics/co2-savings
 * @desc    Calculate CO2 savings for a community order
 * @access  Private
 */
router.get('/co2-savings/:orderId', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('items.product');
    
    if (!order) {
      return res.status(404).json({ msg: 'Order not found' });
    }
    
    // Default values if not provided
    const {
      numHouseholds = order.communitySize || 50,
      indivDistanceKm = 4,
      bulkDistanceKm = order.deliveryDistance || 10,
      truckVolume = 15.0,
      truckWeight = 3000.0
    } = req.query;
    
    // Extract quantities, volumes and weights from order
    const quantities = order.items.map(item => item.quantity);
    const volumePerUnit = order.items.map(item => item.product.volume || 0.02);
    const weightPerUnit = order.items.map(item => item.product.weight || 1.5);
    
    // Calculate number of trucks
    const numTrucks = calculateTrucksRequired(
      quantities,
      volumePerUnit,
      weightPerUnit,
      truckVolume,
      truckWeight
    );
    
    // Calculate CO2 savings
    const co2Savings = calculateCO2Savings({
      numHouseholds: parseInt(numHouseholds),
      indivDistanceKm: parseFloat(indivDistanceKm),
      bulkDistanceKm: parseFloat(bulkDistanceKm),
      numTrucks
    });
    
    res.json({
      success: true,
      orderId: req.params.orderId,
      numTrucks,
      co2Savings
    });
    
  } catch (err) {
    console.error('Error calculating CO2 savings:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
