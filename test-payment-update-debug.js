const axios = require('axios');

const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';

async function testPaymentUpdate() {
  console.log('🔍 DEBUGGING PAYMENT STATUS UPDATE');
  console.log('='.repeat(70));

  try {
    // Step 1: Login
    console.log('\nStep 1: Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@azizpoultry.com',
      password: 'admin123'
    });
    const token = loginResponse.data.access_token;
    console.log('✅ Login successful');

    // Step 2: Get purchase order
    console.log('\nStep 2: Fetching purchase order...');
    const getResponse = await axios.get(`${API_URL}/purchases/27`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const order = getResponse.data;
    console.log('✅ Order fetched:', {
      id: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: order.purchasePaymentStatus,
      netAmount: order.netAmount
    });

    // Step 3: Try minimal update - just payment status
    console.log('\nStep 3: Updating ONLY payment status...');
    try {
      const updateResponse = await axios.patch(
        `${API_URL}/purchases/27`,
        { purchasePaymentStatus: 'paid' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('✅ Update successful!');
      console.log('   New payment status:', updateResponse.data.purchasePaymentStatus);
    } catch (error) {
      console.log('❌ Update failed');
      if (error.response) {
        console.log('   Status:', error.response.status);
        console.log('   Error:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.log('   Error:', error.message);
      }
    }

    // Step 4: Try update with all required fields
    console.log('\nStep 4: Updating with full data...');
    try {
      const fullUpdate = {
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        supplierId: order.supplierId,
        supplierName: order.supplierName,
        vehicleId: order.vehicleId,
        vehicleNumber: order.vehicleNumber,
        purchasePaymentStatus: 'paid',
        items: [] // Empty items array
      };
      
      const updateResponse = await axios.patch(
        `${API_URL}/purchases/27`,
        fullUpdate,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('✅ Update successful!');
      console.log('   New payment status:', updateResponse.data.purchasePaymentStatus);
    } catch (error) {
      console.log('❌ Update failed');
      if (error.response) {
        console.log('   Status:', error.response.status);
        console.log('   Error:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.log('   Error:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

testPaymentUpdate();

