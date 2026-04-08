const axios = require('axios');

const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';

async function testSpecificOrder() {
  console.log('🔍 TESTING SPECIFIC PURCHASE ORDER UPDATE');
  console.log('='.repeat(70));

  try {
    // Login
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@azizpoultry.com',
      password: 'admin123'
    });
    const token = loginResponse.data.access_token;
    console.log('✅ Login successful\n');

    // Get all purchase orders
    console.log('📋 Fetching all purchase orders...');
    const allOrders = await axios.get(`${API_URL}/purchases`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`✅ Found ${allOrders.data.length} purchase orders\n`);
    
    // Show first few orders
    console.log('Recent purchase orders:');
    allOrders.data.slice(0, 5).forEach(order => {
      console.log(`   ID: ${order.id}, Order#: ${order.orderNumber}, Status: ${order.purchasePaymentStatus}, Supplier: ${order.supplierName}`);
    });

    // Test updating the first order
    if (allOrders.data.length > 0) {
      const testOrder = allOrders.data[0];
      console.log(`\n📝 Testing update on Order ID: ${testOrder.id}`);
      
      try {
        const updateResponse = await axios.patch(
          `${API_URL}/purchases/${testOrder.id}`,
          { 
            notes: 'Test update from browser issue - ' + new Date().toISOString(),
            purchasePaymentStatus: testOrder.purchasePaymentStatus === 'paid' ? 'partial' : 'paid'
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        console.log('✅ Update successful!');
        console.log('   New payment status:', updateResponse.data.purchasePaymentStatus);
        console.log('   New notes:', updateResponse.data.notes);
      } catch (error) {
        console.log('❌ Update failed');
        console.log('   Status:', error.response?.status);
        console.log('   Error:', JSON.stringify(error.response?.data, null, 2));
        
        // Try to get more details
        if (error.response?.status === 500) {
          console.log('\n🔍 Checking order details...');
          const orderDetails = await axios.get(`${API_URL}/purchases/${testOrder.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log('   Order data types:');
          console.log('   - totalAmount:', typeof orderDetails.data.totalAmount);
          console.log('   - advancePaid:', typeof orderDetails.data.advancePaid);
          console.log('   - totalPaymentMade:', typeof orderDetails.data.totalPaymentMade);
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

testSpecificOrder();

