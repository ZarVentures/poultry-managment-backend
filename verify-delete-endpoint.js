require('dotenv').config();

async function verifyDeleteEndpoint() {
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

  // Create a test user
  console.log('👤 Creating test user...');
  const createResponse = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Delete Test User',
      email: `deletetest${Date.now()}@test.com`,
      password: 'test123',
      role: 'staff',
      status: 'active'
    })
  });

  if (!createResponse.ok) {
    const error = await createResponse.json();
    console.error('❌ Failed to create test user:', error);
    return;
  }

  const newUser = await createResponse.json();
  console.log(`✅ Created test user: ${newUser.name} (ID: ${newUser.id})\n`);

  // Try to delete the user
  console.log(`🗑️  Attempting to delete user ${newUser.id}...`);
  const deleteResponse = await fetch(`${API_URL}/users/${newUser.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  console.log(`Status: ${deleteResponse.status} ${deleteResponse.statusText}`);

  if (deleteResponse.ok) {
    console.log('✅ DELETE endpoint is working! User deleted successfully.\n');
    
    // Verify user is gone
    console.log('🔍 Verifying user was deleted...');
    const verifyResponse = await fetch(`${API_URL}/users/${newUser.id}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (verifyResponse.status === 404) {
      console.log('✅ Confirmed: User no longer exists in database');
    } else {
      console.log('⚠️  User still exists after delete');
    }
  } else {
    const error = await deleteResponse.json();
    console.log('❌ DELETE failed:', error);
  }
}

verifyDeleteEndpoint().catch(console.error);


