const axios = require('axios');

async function testLogin() {
  console.log('🧪 Testing Login on AWS EC2 Backend\n');
  
  const BACKEND_URL = process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1';
  
  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await axios.get(`${BACKEND_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data);
    console.log('');
    
    // Test 2: Login
    console.log('2️⃣ Testing login...');
    const loginData = {
      email: 'admin@azizpoultry.com',
      password: 'admin123'
    };
    
    console.log('Sending:', loginData);
    
    const loginResponse = await axios.post(`${BACKEND_URL}/auth/login`, loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Login successful!');
    console.log('Response:', JSON.stringify(loginResponse.data, null, 2));
    console.log('\n🎉 Everything is working!');
    
  } catch (error) {
    console.error('\n❌ Error occurred:');
    
    if (error.response) {
      // Server responded with error
      console.log('Status:', error.response.status);
      console.log('Status Text:', error.response.statusText);
      console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.log('\n💡 401 Unauthorized - Possible causes:');
        console.log('   1. Password hash mismatch');
        console.log('   2. User not found in database');
        console.log('   3. Backend not using updated code');
        console.log('   4. Database connection issue');
        
        console.log('\n🔍 Let me check the database...');
        await checkDatabase();
      }
    } else if (error.request) {
      // Request made but no response
      console.log('No response received from server');
      console.log('Backend might be down or not deployed');
    } else {
      // Error in request setup
      console.log('Error:', error.message);
    }
  }
}

async function checkDatabase() {
  const { Client } = require('pg');
  const bcrypt = require('bcrypt');
  
  require('dotenv').config();
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.log('❌ DATABASE_URL not set in .env');
    return;
  }
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Get admin user
    const result = await client.query(`
      SELECT id, name, email, password_hash, role, status 
      FROM users 
      WHERE email = 'admin@azizpoultry.com'
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Admin user not found in database!');
      return;
    }
    
    const user = result.rows[0];
    console.log('\n📊 Admin user in database:');
    console.log('   ID:', user.id);
    console.log('   Name:', user.name);
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('   Status:', user.status);
    console.log('   Password Hash:', user.password_hash.substring(0, 20) + '...');
    
    // Test password
    const isMatch = await bcrypt.compare('admin123', user.password_hash);
    console.log('\n🔐 Password verification:');
    console.log('   Password "admin123" matches hash:', isMatch ? '✅ YES' : '❌ NO');
    
    if (!isMatch) {
      console.log('\n⚠️ Password does not match! This is the problem.');
      console.log('   The backend is checking the password correctly,');
      console.log('   but the hash in database doesn\'t match "admin123"');
    }
    
  } catch (error) {
    console.error('Database check failed:', error.message);
  } finally {
    await client.end();
  }
}

testLogin();
