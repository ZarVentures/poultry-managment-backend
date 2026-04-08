require('dotenv').config();

async function testDeleteEndpoint() {
  const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';
  
  // First, login to get token
  console.log('🔐 Logging in...');
  const loginResponse = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@azizpoultry.com',
      password: 'admin123'
    })
  });

  if (!loginResponse.ok) {
    console.error('❌ Login failed');
    return;
  }

  const { accessToken } = await loginResponse.json();
  console.log('✅ Login successful\n');

  // Get all users
  console.log('📋 Fetching users...');
  const usersResponse = await fetch(`${API_URL}/users`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  const users = await usersResponse.json();
  console.log(`Found ${users.length} users\n`);

  // Try to check if DELETE endpoint exists by checking OPTIONS or trying with a non-existent ID
  console.log('🔍 Testing DELETE endpoint availability...');
  const testId = '00000000-0000-0000-0000-000000000000'; // Non-existent UUID
  
  const deleteResponse = await fetch(`${API_URL}/users/${testId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  console.log(`DELETE /users/${testId}`);
  console.log(`Status: ${deleteResponse.status} ${deleteResponse.statusText}`);
  
  if (deleteResponse.status === 404) {
    const error = await deleteResponse.json();
    console.log(`Response: ${JSON.stringify(error, null, 2)}`);
    
    if (error.message && error.message.includes('not found')) {
      console.log('\n✅ DELETE endpoint exists! (Got 404 for non-existent user, which is correct)');
    } else {
      console.log('\n❌ DELETE endpoint might not exist (Got 404 but wrong error message)');
    }
  } else if (deleteResponse.status === 405) {
    console.log('\n❌ DELETE endpoint does NOT exist (Method Not Allowed)');
  } else {
    console.log(`\n⚠️ Unexpected response: ${deleteResponse.status}`);
  }
}

testDeleteEndpoint().catch(console.error);


