require('dotenv').config();

async function checkPasswordExposure() {
  const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';

  // Login
  const loginResponse = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@azizpoultry.com',
      password: 'admin123'
    })
  });

  const { accessToken } = await loginResponse.json();
  const headers = { 'Authorization': `Bearer ${accessToken}` };

  // Get users
  const usersResponse = await fetch(`${API_URL}/users`, { headers });
  const users = await usersResponse.json();

  console.log('Checking first user for password exposure...');
  console.log('User fields:', Object.keys(users[0]));
  console.log();
  console.log('Has password field?', 'password' in users[0]);
  console.log('Has passwordHash field?', 'passwordHash' in users[0]);
  console.log();
  
  if ('password' in users[0] || 'passwordHash' in users[0]) {
    console.log('❌ SECURITY ISSUE: Password field exposed in API response!');
  } else {
    console.log('✅ SECURE: Password not exposed in API response');
  }
}

checkPasswordExposure().catch(console.error);


