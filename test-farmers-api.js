const fetch = require('node-fetch');

async function testFarmersAPI() {
  const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';
  
  try {
    console.log('🔍 Testing Farmers API...\n');
    
    // Test GET /farmers
    console.log('GET /farmers');
    const response = await fetch(`${API_URL}/farmers`);
    
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    if (response.ok) {
      const farmers = await response.json();
      console.log('\n✅ Success! Farmers count:', farmers.length);
      console.log('\n📋 Farmers List:');
      console.log('─'.repeat(80));
      farmers.forEach((farmer, index) => {
        console.log(`${index + 1}. ${farmer.name} - ${farmer.phone} (${farmer.address || 'No address'})`);
      });
      console.log('─'.repeat(80));
    } else {
      const error = await response.text();
      console.error('❌ Error:', error);
    }
    
  } catch (error) {
    console.error('❌ Failed to test API:', error.message);
  }
}

testFarmersAPI();

