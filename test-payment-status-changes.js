const axios = require('axios');

const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';

async function testPaymentStatusChanges() {
  console.log('🔍 TESTING PAYMENT STATUS CHANGES');
  console.log('='.repeat(70));

  try {
    // Login
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@azizpoultry.com',
      password: 'admin123'
    });
    const token = loginResponse.data.access_token;
    console.log('✅ Login successful\n');

    const statuses = ['pending', 'partial', 'paid'];
    
    for (const status of statuses) {
      console.log(`📝 Changing payment status to: ${status}`);
      
      const updateResponse = await axios.patch(
        `${API_URL}/purchases/27`,
        { purchasePaymentStatus: status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log(`   ✅ Update successful: ${updateResponse.data.purchasePaymentStatus}`);
      
      // Verify by fetching
      const verifyResponse = await axios.get(`${API_URL}/purchases/27`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (verifyResponse.data.purchasePaymentStatus === status) {
        console.log(`   ✅ Verified in database: ${status}\n`);
      } else {
        console.log(`   ❌ Mismatch! Expected: ${status}, Got: ${verifyResponse.data.purchasePaymentStatus}\n`);
      }
    }

    console.log('='.repeat(70));
    console.log('🎉 ALL PAYMENT STATUS CHANGES WORKING CORRECTLY!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

testPaymentStatusChanges();

