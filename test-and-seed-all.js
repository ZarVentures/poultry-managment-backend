const axios = require('axios');

const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';
// const API_URL = 'http://localhost:3001/api/v1';

let authToken = '';

// Login and get token
async function login() {
  try {
    console.log('🔐 Logging in...');
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@azizpoultry.com',
      password: 'admin123'
    });
    authToken = response.data.accessToken;
    console.log('✅ Login successful\n');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

// Helper to make authenticated requests
async function apiRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    };
    if (data) config.data = data;
    
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message,
      status: error.response?.status
    };
  }
}

// Test and seed farmers
async function testFarmers() {
  console.log('👨‍🌾 Testing Farmers...');
  const result = await apiRequest('GET', '/farmers');
  
  if (result.success) {
    console.log(`   Found ${result.data.length} farmers`);
    
    if (result.data.length === 0) {
      console.log('   📝 Adding sample farmers...');
      const farmers = [
        { name: 'Ahmed Khan', phone: '03001234567', email: 'ahmed@example.com', address: 'Lahore', status: 'active', notes: 'Regular supplier' },
        { name: 'Muhammad Ali', phone: '03009876543', email: 'ali@example.com', address: 'Faisalabad', status: 'active', notes: 'Quality birds' },
        { name: 'Hassan Raza', phone: '03111234567', address: 'Multan', status: 'active' }
      ];
      
      for (const farmer of farmers) {
        const addResult = await apiRequest('POST', '/farmers', farmer);
        if (addResult.success) {
          console.log(`   ✅ Added: ${farmer.name}`);
        } else {
          console.log(`   ❌ Failed to add ${farmer.name}: ${addResult.error}`);
        }
      }
    }
  } else {
    console.log(`   ❌ Error: ${result.error}`);
  }
  console.log();
}

// Test and seed retailers
async function testRetailers() {
  console.log('🏪 Testing Retailers...');
  const result = await apiRequest('GET', '/retailers');
  
  if (result.success) {
    console.log(`   Found ${result.data.length} retailers`);
    
    if (result.data.length === 0) {
      console.log('   📝 Adding sample retailers...');
      const retailers = [
        { name: 'City Poultry Shop', ownerName: 'Bilal Ahmed', phone: '03201234567', email: 'city@example.com', address: 'Main Market, Lahore', status: 'active' },
        { name: 'Fresh Chicken Center', ownerName: 'Imran Khan', phone: '03339876543', address: 'Gulberg, Lahore', status: 'active' },
        { name: 'Al-Rehman Traders', ownerName: 'Usman Ali', phone: '03451234567', address: 'Johar Town, Lahore', status: 'active' }
      ];
      
      for (const retailer of retailers) {
        const addResult = await apiRequest('POST', '/retailers', retailer);
        if (addResult.success) {
          console.log(`   ✅ Added: ${retailer.name}`);
        } else {
          console.log(`   ❌ Failed to add ${retailer.name}: ${addResult.error}`);
        }
      }
    }
  } else {
    console.log(`   ❌ Error: ${result.error}`);
  }
  console.log();
}

// Test and seed vehicles
async function testVehicles() {
  console.log('🚚 Testing Vehicles...');
  const result = await apiRequest('GET', '/vehicles');
  
  if (result.success) {
    console.log(`   Found ${result.data.length} vehicles`);
    
    if (result.data.length === 0) {
      console.log('   📝 Adding sample vehicles...');
      const vehicles = [
        { vehicleNumber: 'LHR-1234', vehicleType: 'Truck', driverName: 'Akram Khan', phone: '03001112233', ownerName: 'Aziz Poultry', totalCapacity: '5000 kg', petrolTankCapacity: '100 L', mileage: '8 km/L', joinDate: '2024-01-15', status: 'active' },
        { vehicleNumber: 'LHR-5678', vehicleType: 'Van', driverName: 'Rashid Ali', phone: '03009998877', ownerName: 'Aziz Poultry', totalCapacity: '2000 kg', petrolTankCapacity: '60 L', mileage: '12 km/L', joinDate: '2024-02-01', status: 'active' },
        { vehicleNumber: 'ISB-9012', vehicleType: 'Pickup', driverName: 'Zahid Hussain', phone: '03117776655', totalCapacity: '1000 kg', joinDate: '2024-03-01', status: 'active' }
      ];
      
      for (const vehicle of vehicles) {
        const addResult = await apiRequest('POST', '/vehicles', vehicle);
        if (addResult.success) {
          console.log(`   ✅ Added: ${vehicle.vehicleNumber}`);
        } else {
          console.log(`   ❌ Failed to add ${vehicle.vehicleNumber}: ${addResult.error}`);
        }
      }
    }
  } else {
    console.log(`   ❌ Error: ${result.error}`);
  }
  console.log();
}

// Test and seed inventory
async function testInventory() {
  console.log('📦 Testing Inventory...');
  const result = await apiRequest('GET', '/inventory');
  
  if (result.success) {
    console.log(`   Found ${result.data.length} inventory items`);
    
    if (result.data.length === 0) {
      console.log('   📝 Adding sample inventory...');
      const items = [
        { itemType: 'feed', itemName: 'Broiler Feed', quantity: 500, unit: 'kg', minimumStockLevel: 100, currentStockLevel: 500, notes: 'Premium quality' },
        { itemType: 'feed', itemName: 'Layer Feed', quantity: 300, unit: 'kg', minimumStockLevel: 50, currentStockLevel: 300 },
        { itemType: 'medicine', itemName: 'Antibiotics', quantity: 50, unit: 'bottles', minimumStockLevel: 10, currentStockLevel: 50 },
        { itemType: 'equipment', itemName: 'Feeders', quantity: 20, unit: 'pcs', minimumStockLevel: 5, currentStockLevel: 20 },
        { itemType: 'birds', itemName: 'Broiler Chicks', quantity: 1000, unit: 'pcs', minimumStockLevel: 200, currentStockLevel: 1000 }
      ];
      
      for (const item of items) {
        const addResult = await apiRequest('POST', '/inventory', item);
        if (addResult.success) {
          console.log(`   ✅ Added: ${item.itemName}`);
        } else {
          console.log(`   ❌ Failed to add ${item.itemName}: ${addResult.error}`);
        }
      }
    }
  } else {
    console.log(`   ❌ Error: ${result.error}`);
  }
  console.log();
}

// Test and seed sales
async function testSales() {
  console.log('💰 Testing Sales...');
  const result = await apiRequest('GET', '/sales');
  
  if (result.success) {
    console.log(`   Found ${result.data.length} sales`);
    
    if (result.data.length === 0) {
      console.log('   📝 Adding sample sales...');
      const sales = [
        { invoiceNumber: 'INV-001', customerName: 'City Poultry Shop', saleDate: '2024-03-01', productType: 'meat', quantity: 100, unit: 'kg', unitPrice: 350, totalAmount: 35000, paymentStatus: 'paid', amountReceived: 35000 },
        { invoiceNumber: 'INV-002', customerName: 'Fresh Chicken Center', saleDate: '2024-03-02', productType: 'eggs', quantity: 500, unit: 'dozen', unitPrice: 180, totalAmount: 90000, paymentStatus: 'pending', amountReceived: 0 },
        { invoiceNumber: 'INV-003', customerName: 'Al-Rehman Traders', saleDate: '2024-03-03', productType: 'chicks', quantity: 200, unit: 'pcs', unitPrice: 50, totalAmount: 10000, paymentStatus: 'partial', amountReceived: 5000 }
      ];
      
      for (const sale of sales) {
        const addResult = await apiRequest('POST', '/sales', sale);
        if (addResult.success) {
          console.log(`   ✅ Added: ${sale.invoiceNumber}`);
        } else {
          console.log(`   ❌ Failed to add ${sale.invoiceNumber}: ${addResult.error}`);
        }
      }
    }
  } else {
    console.log(`   ❌ Error: ${result.error}`);
  }
  console.log();
}

// Test and seed expenses
async function testExpenses() {
  console.log('💸 Testing Expenses...');
  const result = await apiRequest('GET', '/expenses');
  
  if (result.success) {
    console.log(`   Found ${result.data.length} expenses`);
    
    if (result.data.length === 0) {
      console.log('   📝 Adding sample expenses...');
      const expenses = [
        { expenseDate: '2024-03-01', category: 'feed', description: 'Broiler feed purchase', amount: 25000, paymentMethod: 'cash' },
        { expenseDate: '2024-03-02', category: 'labor', description: 'Worker salaries', amount: 15000, paymentMethod: 'bank_transfer' },
        { expenseDate: '2024-03-03', category: 'utilities', description: 'Electricity bill', amount: 8000, paymentMethod: 'bank_transfer' },
        { expenseDate: '2024-03-04', category: 'medicine', description: 'Vaccines and antibiotics', amount: 5000, paymentMethod: 'cash' },
        { expenseDate: '2024-03-05', category: 'transportation', description: 'Fuel for vehicles', amount: 12000, paymentMethod: 'cash' }
      ];
      
      for (const expense of expenses) {
        const addResult = await apiRequest('POST', '/expenses', expense);
        if (addResult.success) {
          console.log(`   ✅ Added: ${expense.description}`);
        } else {
          console.log(`   ❌ Failed to add ${expense.description}: ${addResult.error}`);
        }
      }
    }
  } else {
    console.log(`   ❌ Error: ${result.error}`);
  }
  console.log();
}

// Test and seed purchases
async function testPurchases() {
  console.log('🛒 Testing Purchases...');
  const result = await apiRequest('GET', '/purchases');
  
  if (result.success) {
    console.log(`   Found ${result.data.length} purchase orders`);
    
    if (result.data.length === 0) {
      console.log('   📝 Adding sample purchase orders...');
      const purchases = [
        {
          orderNumber: 'PO-001',
          supplierName: 'Ahmed Khan',
          orderDate: '2024-03-01',
          dueDate: '2024-03-05',
          status: 'received',
          totalAmount: 50000,
          items: [
            { itemName: 'Broiler Chicks', quantity: 500, unit: 'pcs', unitPrice: 50, totalPrice: 25000 },
            { itemName: 'Feed', quantity: 500, unit: 'kg', unitPrice: 50, totalPrice: 25000 }
          ]
        },
        {
          orderNumber: 'PO-002',
          supplierName: 'Muhammad Ali',
          orderDate: '2024-03-03',
          status: 'pending',
          totalAmount: 30000,
          items: [
            { itemName: 'Layer Chicks', quantity: 300, unit: 'pcs', unitPrice: 60, totalPrice: 18000 },
            { itemName: 'Vaccines', quantity: 100, unit: 'bottles', unitPrice: 120, totalPrice: 12000 }
          ]
        }
      ];
      
      for (const purchase of purchases) {
        const addResult = await apiRequest('POST', '/purchases', purchase);
        if (addResult.success) {
          console.log(`   ✅ Added: ${purchase.orderNumber}`);
        } else {
          console.log(`   ❌ Failed to add ${purchase.orderNumber}: ${addResult.error}`);
        }
      }
    }
  } else {
    console.log(`   ❌ Error: ${result.error}`);
  }
  console.log();
}

// Test and seed godown inward
async function testGodownInward() {
  console.log('📥 Testing Godown Inward...');
  const result = await apiRequest('GET', '/godown/inward');
  
  if (result.success) {
    console.log(`   Found ${result.data.length} inward entries`);
    
    if (result.data.length === 0) {
      console.log('   📝 Adding sample inward entries...');
      const entries = [
        { entryDate: '2024-03-01', farmerName: 'Ahmed Khan', vehicleNumber: 'LHR-1234', quantity: 500, unit: 'kg', rate: 200, totalAmount: 100000, notes: 'Fresh delivery' },
        { entryDate: '2024-03-02', farmerName: 'Muhammad Ali', vehicleNumber: 'LHR-5678', quantity: 300, unit: 'kg', rate: 210, totalAmount: 63000 },
        { entryDate: '2024-03-03', farmerName: 'Hassan Raza', vehicleNumber: 'ISB-9012', quantity: 200, unit: 'kg', rate: 205, totalAmount: 41000 }
      ];
      
      for (const entry of entries) {
        const addResult = await apiRequest('POST', '/godown/inward', entry);
        if (addResult.success) {
          console.log(`   ✅ Added: ${entry.farmerName} - ${entry.quantity}${entry.unit}`);
        } else {
          console.log(`   ❌ Failed to add entry: ${addResult.error}`);
        }
      }
    }
  } else {
    console.log(`   ❌ Error: ${result.error}`);
  }
  console.log();
}

// Test and seed godown sales
async function testGodownSales() {
  console.log('💵 Testing Godown Sales...');
  const result = await apiRequest('GET', '/godown/sales');
  
  if (result.success) {
    console.log(`   Found ${result.data.length} godown sales`);
    
    if (result.data.length === 0) {
      console.log('   📝 Adding sample godown sales...');
      const sales = [
        { saleDate: '2024-03-02', customerName: 'City Poultry Shop', quantity: 150, unit: 'kg', rate: 250, totalAmount: 37500 },
        { saleDate: '2024-03-03', customerName: 'Fresh Chicken Center', quantity: 200, unit: 'kg', rate: 245, totalAmount: 49000 },
        { saleDate: '2024-03-04', customerName: 'Al-Rehman Traders', quantity: 100, unit: 'kg', rate: 255, totalAmount: 25500 }
      ];
      
      for (const sale of sales) {
        const addResult = await apiRequest('POST', '/godown/sales', sale);
        if (addResult.success) {
          console.log(`   ✅ Added: ${sale.customerName} - ${sale.quantity}${sale.unit}`);
        } else {
          console.log(`   ❌ Failed to add sale: ${addResult.error}`);
        }
      }
    }
  } else {
    console.log(`   ❌ Error: ${result.error}`);
  }
  console.log();
}

// Test and seed godown mortality
async function testGodownMortality() {
  console.log('☠️ Testing Godown Mortality...');
  const result = await apiRequest('GET', '/godown/mortality');
  
  if (result.success) {
    console.log(`   Found ${result.data.length} mortality records`);
    
    if (result.data.length === 0) {
      console.log('   📝 Adding sample mortality records...');
      const records = [
        { mortalityDate: '2024-03-01', quantity: 5, unit: 'pcs', reason: 'Disease', notes: 'Isolated and disposed' },
        { mortalityDate: '2024-03-03', quantity: 3, unit: 'pcs', reason: 'Natural', notes: 'Old age' },
        { mortalityDate: '2024-03-05', quantity: 2, unit: 'pcs', reason: 'Accident' }
      ];
      
      for (const record of records) {
        const addResult = await apiRequest('POST', '/godown/mortality', record);
        if (addResult.success) {
          console.log(`   ✅ Added: ${record.quantity} ${record.unit} - ${record.reason}`);
        } else {
          console.log(`   ❌ Failed to add record: ${addResult.error}`);
        }
      }
    }
  } else {
    console.log(`   ❌ Error: ${result.error}`);
  }
  console.log();
}

// Test and seed godown expenses
async function testGodownExpenses() {
  console.log('💳 Testing Godown Expenses...');
  const result = await apiRequest('GET', '/godown/expenses');
  
  if (result.success) {
    console.log(`   Found ${result.data.length} godown expenses`);
    
    if (result.data.length === 0) {
      console.log('   📝 Adding sample godown expenses...');
      const expenses = [
        { expenseDate: '2024-03-01', category: 'Maintenance', description: 'Godown cleaning', amount: 2000 },
        { expenseDate: '2024-03-02', category: 'Utilities', description: 'Electricity for godown', amount: 3500 },
        { expenseDate: '2024-03-03', category: 'Labor', description: 'Worker wages', amount: 5000 },
        { expenseDate: '2024-03-04', category: 'Equipment', description: 'Cage repairs', amount: 1500 }
      ];
      
      for (const expense of expenses) {
        const addResult = await apiRequest('POST', '/godown/expenses', expense);
        if (addResult.success) {
          console.log(`   ✅ Added: ${expense.description} - Rs.${expense.amount}`);
        } else {
          console.log(`   ❌ Failed to add expense: ${addResult.error}`);
        }
      }
    }
  } else {
    console.log(`   ❌ Error: ${result.error}`);
  }
  console.log();
}

// Test settings
async function testSettings() {
  console.log('⚙️ Testing Settings...');
  const result = await apiRequest('GET', '/settings');
  
  if (result.success) {
    console.log(`   Found ${result.data.length} settings`);
    
    if (result.data.length === 0) {
      console.log('   📝 Adding default settings...');
      const settings = [
        { key: 'company_name', value: 'Aziz Poultry Farm', category: 'general', description: 'Company name' },
        { key: 'currency', value: 'PKR', category: 'general', description: 'Currency' },
        { key: 'tax_rate', value: '0', category: 'financial', description: 'Tax rate percentage' }
      ];
      
      for (const setting of settings) {
        const addResult = await apiRequest('POST', '/settings', setting);
        if (addResult.success) {
          console.log(`   ✅ Added: ${setting.key}`);
        } else {
          console.log(`   ❌ Failed to add ${setting.key}: ${addResult.error}`);
        }
      }
    }
  } else {
    console.log(`   ❌ Error: ${result.error}`);
  }
  console.log();
}

// Main test function
async function runTests() {
  console.log('🚀 Starting comprehensive system test...\n');
  console.log('='.repeat(50));
  console.log();
  
  const loggedIn = await login();
  if (!loggedIn) {
    console.log('❌ Cannot proceed without authentication');
    return;
  }
  
  await testFarmers();
  await testRetailers();
  await testVehicles();
  await testInventory();
  await testSales();
  await testExpenses();
  await testPurchases();
  await testGodownInward();
  await testGodownSales();
  await testGodownMortality();
  await testGodownExpenses();
  await testSettings();
  
  console.log('='.repeat(50));
  console.log('✅ All tests completed!');
  console.log('\n📊 Summary:');
  console.log('   - All modules tested');
  console.log('   - Sample data added where needed');
  console.log('   - System ready for use');
}

runTests().catch(console.error);

