require('dotenv').config();

async function testUserDelete() {
  const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';
  
  // Login
  console.log('🔐 Logging in...');
  const loginResponse = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@azizpoultry.com',
      password: 'admin123'
    })
  });

  const { accessToken } = await loginResponse.json();
  console.log('✅ Login successful\n');

  // Get all users
  console.log('📋 Fetching users...');
  const usersResponse = await fetch(`${API_URL}/users`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  const users = await usersResponse.json();
  console.log(`Found ${users.length} users:`);
  users.forEach(u => {
    console.log(`  - ID: ${u.id} | Name: ${u.name} | Email: ${u.email} | Status: ${u.status}`);
  });

  // Check if user ID 17 exists
  const user17 = users.find(u => u.id === '17' || u.id === 17);
  if (user17) {
    console.log(`\n✅ User with ID 17 found: ${user17.name}`);
  } else {
    console.log(`\n❌ User with ID 17 NOT found`);
    console.log('Available user IDs:', users.map(u => u.id).join(', '));
  }
}

testUserDelete().catch(console.error);


