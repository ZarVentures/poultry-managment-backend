require('dotenv').config();

async function testMasterEntries() {
  const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';
  let accessToken = '';
  let testIds = {
    farmer: null,
    retailer: null,
    vehicle: null,
    inventory: null
  };

  let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  function logTest(name, passed, message = '') {
    testResults.total++;
    if (passed) {
      testResults.passed++;
      console.log(`  ✅ ${name}`);
    } else {
      testResults.failed++;
      console.log(`  ❌ ${name}: ${message}`);
    }
    testResults.tests.push({ name, passed, message });
  }

  try {
    console.log('🧪 MASTER ENTRIES - COMPLETE FUNCTIONALITY TEST');
    console.log('='.repeat(70));
    console.log();

    // Login
    console.log('🔐 Authentication');
    const loginResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@azizpoultry.com',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      console.log('❌ Login failed');
      return;
    }

    const { accessToken: token } = await loginResponse.json();
    accessToken = token;
    console.log('✅ Login successful\n');

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    // ========================================
    // FARMERS MODULE
    // ========================================
    console.log('👨‍🌾 FARMERS MODULE');
    console.log('-'.repeat(70));

    // Get all farmers
    const farmersResponse = await fetch(`${API_URL}/farmers`, { headers });
    const farmersData = await farmersResponse.json();
    const farmers = farmersData.data || farmersData; // Handle wrapped response
    logTest('Get all farmers', farmersResponse.ok && Array.isArray(farmers));
    console.log(`   Found ${farmers.length} farmers`);

    // Get active farmers
    const activeFarmersResponse = await fetch(`${API_URL}/farmers/active/list`, { headers });
    const activeFarmers = await activeFarmersResponse.json();
    logTest('Get active farmers', activeFarmersResponse.ok);
    if (activeFarmersResponse.ok) {
      console.log(`   Active farmers: ${activeFarmers.length}`);
    }

    // Create farmer
    const timestamp = Date.now();
    const createFarmerResponse = await fetch(`${API_URL}/farmers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Test Farmer',
        phone: '9876543210',
        address: 'Test Address',
        status: 'active',
        notes: 'Test farmer'
      })
    });
    if (createFarmerResponse.ok) {
      const newFarmer = await createFarmerResponse.json();
      testIds.farmer = newFarmer.id;
      logTest('Create farmer', true);
    } else {
      logTest('Create farmer', false, await createFarmerResponse.text());
    }

    // Update farmer
    if (testIds.farmer) {
      const updateFarmerResponse = await fetch(`${API_URL}/farmers/${testIds.farmer}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name: 'Test Farmer Updated' })
      });
      logTest('Update farmer', updateFarmerResponse.ok);
    }

    // Delete farmer
    if (testIds.farmer) {
      const deleteFarmerResponse = await fetch(`${API_URL}/farmers/${testIds.farmer}`, {
        method: 'DELETE',
        headers
      });
      logTest('Delete farmer', deleteFarmerResponse.ok);
    }

    console.log();

    // ========================================
    // RETAILERS MODULE
    // ========================================
    console.log('🏪 RETAILERS MODULE');
    console.log('-'.repeat(70));

    // Get all retailers
    const retailersResponse = await fetch(`${API_URL}/retailers`, { headers });
    const retailers = await retailersResponse.json();
    logTest('Get all retailers', retailersResponse.ok && Array.isArray(retailers));
    console.log(`   Found ${retailers.length} retailers`);

    // Get active retailers
    const activeRetailersResponse = await fetch(`${API_URL}/retailers/active/list`, { headers });
    const activeRetailers = await activeRetailersResponse.json();
    logTest('Get active retailers', activeRetailersResponse.ok);
    if (activeRetailersResponse.ok) {
      console.log(`   Active retailers: ${activeRetailers.length}`);
    }

    // Create retailer
    const createRetailerResponse = await fetch(`${API_URL}/retailers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Test Retailer',
        ownerName: 'Test Owner',
        phone: '9876543210',
        address: 'Test Address',
        status: 'active',
        notes: 'Test retailer'
      })
    });
    if (createRetailerResponse.ok) {
      const newRetailer = await createRetailerResponse.json();
      testIds.retailer = newRetailer.id;
      logTest('Create retailer', true);
    } else {
      logTest('Create retailer', false, await createRetailerResponse.text());
    }

    // Update retailer
    if (testIds.retailer) {
      const updateRetailerResponse = await fetch(`${API_URL}/retailers/${testIds.retailer}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name: 'Test Retailer Updated' })
      });
      logTest('Update retailer', updateRetailerResponse.ok);
    }

    // Delete retailer
    if (testIds.retailer) {
      const deleteRetailerResponse = await fetch(`${API_URL}/retailers/${testIds.retailer}`, {
        method: 'DELETE',
        headers
      });
      logTest('Delete retailer', deleteRetailerResponse.ok);
    }

    console.log();

    // ========================================
    // VEHICLES MODULE
    // ========================================
    console.log('🚚 VEHICLES MODULE');
    console.log('-'.repeat(70));

    // Get all vehicles
    const vehiclesResponse = await fetch(`${API_URL}/vehicles`, { headers });
    const vehicles = await vehiclesResponse.json();
    logTest('Get all vehicles', vehiclesResponse.ok && Array.isArray(vehicles));
    console.log(`   Found ${vehicles.length} vehicles`);

    // Get active vehicles
    const activeVehiclesResponse = await fetch(`${API_URL}/vehicles/active/list`, { headers });
    const activeVehicles = await activeVehiclesResponse.json();
    logTest('Get active vehicles', activeVehiclesResponse.ok);
    if (activeVehiclesResponse.ok) {
      console.log(`   Active vehicles: ${activeVehicles.length}`);
    }

    // Create vehicle
    const createVehicleResponse = await fetch(`${API_URL}/vehicles`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        vehicleNumber: `TEST${timestamp}`,
        vehicleType: 'Truck',
        driverName: 'Test Driver',
        phone: '9876543210',
        joinDate: new Date().toISOString().split('T')[0],
        status: 'active',
        note: 'Test vehicle'
      })
    });
    if (createVehicleResponse.ok) {
      const newVehicle = await createVehicleResponse.json();
      testIds.vehicle = newVehicle.id;
      logTest('Create vehicle', true);
    } else {
      const error = await createVehicleResponse.json();
      logTest('Create vehicle', false, error.message);
    }

    // Update vehicle
    if (testIds.vehicle) {
      const updateVehicleResponse = await fetch(`${API_URL}/vehicles/${testIds.vehicle}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ driverName: 'Test Driver Updated' })
      });
      logTest('Update vehicle', updateVehicleResponse.ok);
    }

    // Delete vehicle
    if (testIds.vehicle) {
      const deleteVehicleResponse = await fetch(`${API_URL}/vehicles/${testIds.vehicle}`, {
        method: 'DELETE',
        headers
      });
      logTest('Delete vehicle', deleteVehicleResponse.ok);
    }

    console.log();

    // ========================================
    // INVENTORY MODULE
    // ========================================
    console.log('📦 INVENTORY MODULE');
    console.log('-'.repeat(70));

    // Get all inventory items
    const inventoryResponse = await fetch(`${API_URL}/inventory`, { headers });
    const inventory = await inventoryResponse.json();
    logTest('Get all inventory items', inventoryResponse.ok && Array.isArray(inventory));
    console.log(`   Found ${inventory.length} items`);

    // Get low stock items
    const lowStockResponse = await fetch(`${API_URL}/inventory/low-stock`, { headers });
    const lowStock = await lowStockResponse.json();
    logTest('Get low stock items', lowStockResponse.ok);
    if (lowStockResponse.ok) {
      console.log(`   Low stock items: ${lowStock.length || 0}`);
    }

    // Get total inventory value
    const totalValueResponse = await fetch(`${API_URL}/inventory/total-value`, { headers });
    const totalValue = await totalValueResponse.json();
    logTest('Get total inventory value', totalValueResponse.ok);
    if (totalValueResponse.ok) {
      console.log(`   Total value: ₹${totalValue.totalValue || 0}`);
    }

    // Get inventory by type
    const byTypeResponse = await fetch(`${API_URL}/inventory/by-type`, { headers });
    const byType = await byTypeResponse.json();
    logTest('Get inventory by type', byTypeResponse.ok);
    if (byTypeResponse.ok) {
      console.log(`   Types: ${Object.keys(byType).length}`);
    }

    // Create inventory item
    const createInventoryResponse = await fetch(`${API_URL}/inventory`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        itemType: 'feed',
        itemName: 'Test Feed',
        quantity: 100,
        unit: 'kg',
        minimumStockLevel: 20,
        currentStockLevel: 100,
        notes: 'Test inventory item'
      })
    });
    if (createInventoryResponse.ok) {
      const newItem = await createInventoryResponse.json();
      testIds.inventory = newItem.id;
      logTest('Create inventory item', true);
    } else {
      const error = await createInventoryResponse.json();
      logTest('Create inventory item', false, error.message);
    }

    // Update inventory item
    if (testIds.inventory) {
      const updateInventoryResponse = await fetch(`${API_URL}/inventory/${testIds.inventory}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ quantity: 150 })
      });
      logTest('Update inventory item', updateInventoryResponse.ok);
    }

    // Delete inventory item
    if (testIds.inventory) {
      const deleteInventoryResponse = await fetch(`${API_URL}/inventory/${testIds.inventory}`, {
        method: 'DELETE',
        headers
      });
      logTest('Delete inventory item', deleteInventoryResponse.ok);
    }

    console.log();

  } catch (error) {
    console.error('❌ Test suite error:', error.message);
  }

  // Print summary
  console.log('='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  console.log();

  if (testResults.failed > 0) {
    console.log('Failed Tests:');
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => console.log(`  - ${t.name}: ${t.message}`));
    console.log();
  }

  if (testResults.passed === testResults.total) {
    console.log('🎉 ALL TESTS PASSED! Master Entries modules are fully functional.');
  } else {
    console.log('⚠️  Some tests failed. Please review the issues above.');
  }
}

testMasterEntries().catch(console.error);


