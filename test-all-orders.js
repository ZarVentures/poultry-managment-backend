const axios = require('axios');

const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';

async function testAllOrders() {
  console.log('🔍 TESTING ALL PURCHASE ORDERS');
  console.log('='.repeat(70));

  try {
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@azizpoultry.com',
      password: 'admin123'
    });
    const token = loginResponse.data.access_token;
    console.log('✅ Login successful\n');

    const ordersResponse = await axios.get(`${API_URL}/purchases`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`📋 Found ${ordersResponse.data.length} purchase orders\n`);

    for (const order of ordersResponse.data) {
      console.log(`Testing Order ID ${order.id} (${order.orderNumber})...`);
      
      try {
        const updateResponse = await axios.patch(
          `${API_URL}/purchases/${order.id}`,
          { notes: `Test ${new Date().toISOString()}` },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`  ✅ Update successful`);
      } catch (error) {
        console.log(`  ❌ Update failed: ${error.response?.status} - ${error.response?.data?.message}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ All orders tested');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAllOrders();

