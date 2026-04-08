const fetch = require('node-fetch');

async function testAuthAndFarmers() {
  const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';
  
  try {
    console.log('🔐 Step 1: Login...\n');
    
    // Login first
    const loginResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@azizpoultry.com',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      console.error('❌ Login failed:', await loginResponse.text());
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login successful!');
    console.log('Response:', JSON.stringify(loginData, null, 2));
    
    const token = loginData.access_token || loginData.token || loginData.accessToken;
    if (!token) {
      console.error('❌ No token in response');
      return;
    }
    console.log('Token:', token.substring(0, 20) + '...');
    
    // Now test farmers API with token
    console.log('\n🔍 Step 2: Fetching farmers with token...\n');
    
    const farmersResponse = await fetch(`${API_URL}/farmers`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Status:', farmersResponse.status);
    
    if (farmersResponse.ok) {
      const farmers = await farmersResponse.json();
      console.log('\n✅ Success!');
      console.log('Response type:', typeof farmers);
      console.log('Is array:', Array.isArray(farmers));
      console.log('Response:', JSON.stringify(farmers, null, 2).substring(0, 500));
      
      // Handle both array and paginated response
      const farmersList = Array.isArray(farmers) ? farmers : (farmers.data || farmers.items || []);
      console.log('\nFarmers count:', farmersList.length);
      
      if (farmersList.length > 0) {
        console.log('\n📋 First 5 Farmers:');
        console.log('─'.repeat(80));
        farmersList.slice(0, 5).forEach((farmer, index) => {
          console.log(`${index + 1}. ID: ${farmer.id} | ${farmer.name} | ${farmer.phone}`);
          console.log(`   Address: ${farmer.address || 'N/A'}`);
        });
        console.log('─'.repeat(80));
      }
    } else {
      const error = await farmersResponse.text();
      console.error('❌ Error fetching farmers:', error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAuthAndFarmers();

