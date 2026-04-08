const axios = require('axios');

const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';

async function testSimpleUpdate() {
  console.log('🔍 TESTING SIMPLE UPDATE');
  console.log('='.repeat(70));

  try {
    // Login
    console.log('\nLogging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@azizpoultry.com',
      password: 'admin123'
    });
    const token = loginResponse.data.access_token;
    console.log('✅ Login successful');

    // Get purchase order
    console.log('\nFetching purchase order 27...');
    const getResponse = await axios.get(`${API_URL}/purchases/27`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const order = getResponse.data;
    console.log('✅ Order fetched');
    console.log('   Current status:', order.purchasePaymentStatus);
    console.log('   Current notes:', order.notes || '(empty)');

    // Try updating just notes first
    console.log('\nTest 1: Updating notes only...');
    try {
      const response = await axios.patch(
        `${API_URL}/purchases/27`,
        { notes: 'Test update at ' + new Date().toISOString() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('✅ Notes update successful');
      console.log('   New notes:', response.data.notes);
    } catch (error) {
      console.log('❌ Notes update failed');
      if (error.response) {
        console.log('   Status:', error.response.status);
        console.log('   Error:', JSON.stringify(error.response.data, null, 2));
      }
    }

    // Try updating payment status
    console.log('\nTest 2: Updating payment status only...');
    try {
      const response = await axios.patch(
        `${API_URL}/purchases/27`,
        { purchasePaymentStatus: 'paid' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('✅ Payment status update successful');
      console.log('   New status:', response.data.purchasePaymentStatus);
    } catch (error) {
      console.log('❌ Payment status update failed');
      if (error.response) {
        console.log('   Status:', error.response.status);
        console.log('   Error:', JSON.stringify(error.response.data, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSimpleUpdate();

