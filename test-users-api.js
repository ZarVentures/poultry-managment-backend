require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.DATABASE_URL ? 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'' : 'http://localhost:3000/api/v1';

let authToken = '';
let testUserId = '';

async function login() {
  console.log('🔐 Testing Login...');
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@azizpoultry.com',
      password: 'admin123'
    });
    
    authToken = response.data.accessToken;
    console.log('✅ Login successful');
    console.log(`   Token: ${authToken.substring(0, 20)}...`);
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

async function testGetAllUsers() {
  console.log('\n📋 Testing GET /users (Get All Users)...');
  try {
    const response = await axios.get(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Get all users successful');
    console.log(`   Total users: ${response.data.length}`);
    response.data.slice(0, 3).forEach(user => {
      console.log(`   - ${user.name} (${user.email}) - ${user.role} - ${user.status}`);
    });
    return true;
  } catch (error) {
    console.error('❌ Get all users failed:', error.response?.data || error.message);
    return false;
  }
}

async function testCreateUser() {
  console.log('\n➕ Testing POST /users (Create User)...');
  try {
    const newUser = {
      name: 'Test User',
      email: `test${Date.now()}@test.com`,
      password: 'test123',
      role: 'staff',
      status: 'active'
    };
    
    const response = await axios.post(`${API_URL}/users`, newUser, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    testUserId = response.data.id;
    console.log('✅ Create user successful');
    console.log(`   User ID: ${testUserId}`);
    console.log(`   Name: ${response.data.name}`);
    console.log(`   Email: ${response.data.email}`);
    console.log(`   Role: ${response.data.role}`);
    console.log(`   Status: ${response.data.status}`);
    return true;
  } catch (error) {
    console.error('❌ Create user failed:', error.response?.data || error.message);
    return false;
  }
}

async function testGetOneUser() {
  console.log('\n🔍 Testing GET /users/:id (Get Single User)...');
  try {
    const response = await axios.get(`${API_URL}/users/${testUserId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Get single user successful');
    console.log(`   Name: ${response.data.name}`);
    console.log(`   Email: ${response.data.email}`);
    console.log(`   Role: ${response.data.role}`);
    console.log(`   Status: ${response.data.status}`);
    return true;
  } catch (error) {
    console.error('❌ Get single user failed:', error.response?.data || error.message);
    return false;
  }
}

async function testUpdateUser() {
  console.log('\n✏️ Testing PATCH /users/:id (Update User)...');
  try {
    const updateData = {
      name: 'Test User Updated',
      role: 'manager'
    };
    
    const response = await axios.patch(`${API_URL}/users/${testUserId}`, updateData, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Update user successful');
    console.log(`   Updated Name: ${response.data.name}`);
    console.log(`   Updated Role: ${response.data.role}`);
    return true;
  } catch (error) {
    console.error('❌ Update user failed:', error.response?.data || error.message);
    return false;
  }
}

async function testUpdateUserStatus() {
  console.log('\n🔄 Testing PATCH /users/:id/deactivate and /activate (Update User Status)...');
  try {
    // Deactivate
    const deactivateResponse = await axios.patch(`${API_URL}/users/${testUserId}/deactivate`, 
      {},
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    console.log('✅ Deactivate user successful');
    console.log(`   New Status: ${deactivateResponse.data.status}`);
    
    // Reactivate
    const activateResponse = await axios.patch(`${API_URL}/users/${testUserId}/activate`, 
      {},
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('✅ Activate user successful');
    console.log(`   New Status: ${activateResponse.data.status}`);
    return true;
  } catch (error) {
    console.error('❌ Update user status failed:', error.response?.data || error.message);
    return false;
  }
}

async function testDeleteUser() {
  console.log('\n🗑️ Testing User Cleanup (Deactivate instead of Delete)...');
  try {
    // Since there's no delete endpoint, we'll deactivate the user
    await axios.patch(`${API_URL}/users/${testUserId}/deactivate`, 
      {},
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    console.log('✅ User deactivated successfully (no delete endpoint available)');
    console.log(`   Deactivated User ID: ${testUserId}`);
    console.log('   Note: Users are deactivated, not deleted, to maintain data integrity');
    return true;
  } catch (error) {
    console.error('❌ User cleanup failed:', error.response?.data || error.message);
    return false;
  }
}

async function testGetStatistics() {
  console.log('\n📊 Testing GET /users/statistics/summary (Get Statistics)...');
  try {
    const response = await axios.get(`${API_URL}/users/statistics/summary`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Get statistics successful');
    console.log(`   Total Users: ${response.data.totalUsers}`);
    console.log(`   Active Users: ${response.data.activeUsers}`);
    console.log(`   Inactive Users: ${response.data.inactiveUsers}`);
    console.log(`   Admin Users: ${response.data.adminUsers}`);
    console.log(`   Manager Users: ${response.data.managerUsers}`);
    console.log(`   Staff Users: ${response.data.staffUsers}`);
    return true;
  } catch (error) {
    console.error('❌ Get statistics failed:', error.response?.data || error.message);
    return false;
  }
}

async function testValidation() {
  console.log('\n🛡️ Testing Validation...');
  
  // Test 1: Missing required fields
  console.log('   Test 1: Missing required fields...');
  try {
    await axios.post(`${API_URL}/users`, {
      name: 'Test'
      // Missing email, password, etc.
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('   ❌ Should have failed validation');
    return false;
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('   ✅ Validation working - rejected missing fields');
    } else {
      console.log('   ⚠️ Unexpected error:', error.response?.status);
    }
  }
  
  // Test 2: Invalid email format
  console.log('   Test 2: Invalid email format...');
  try {
    await axios.post(`${API_URL}/users`, {
      name: 'Test User',
      email: 'invalid-email',
      password: 'test123',
      role: 'staff'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('   ❌ Should have failed validation');
    return false;
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('   ✅ Validation working - rejected invalid email');
    } else {
      console.log('   ⚠️ Unexpected error:', error.response?.status);
    }
  }
  
  // Test 3: Duplicate email
  console.log('   Test 3: Duplicate email...');
  try {
    await axios.post(`${API_URL}/users`, {
      name: 'Duplicate User',
      email: 'admin@azizpoultry.com', // Existing email
      password: 'test123',
      role: 'staff'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('   ❌ Should have failed - duplicate email');
    return false;
  } catch (error) {
    if (error.response?.status === 400 || error.response?.status === 409) {
      console.log('   ✅ Validation working - rejected duplicate email');
    } else {
      console.log('   ⚠️ Unexpected error:', error.response?.status);
    }
  }
  
  return true;
}

async function testUnauthorizedAccess() {
  console.log('\n🔒 Testing Unauthorized Access...');
  try {
    await axios.get(`${API_URL}/users`);
    console.log('❌ Should have required authentication');
    return false;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Authentication required - unauthorized access blocked');
      return true;
    } else {
      console.log('⚠️ Unexpected error:', error.response?.status);
      return false;
    }
  }
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 USERS API COMPREHENSIVE TEST SUITE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`API URL: ${API_URL}`);
  console.log('═══════════════════════════════════════════════════════\n');
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  const tests = [
    { name: 'Unauthorized Access', fn: testUnauthorizedAccess },
    { name: 'Login', fn: login },
    { name: 'Get All Users', fn: testGetAllUsers },
    { name: 'Get Statistics', fn: testGetStatistics },
    { name: 'Create User', fn: testCreateUser },
    { name: 'Get Single User', fn: testGetOneUser },
    { name: 'Update User', fn: testUpdateUser },
    { name: 'Update User Status', fn: testUpdateUserStatus },
    { name: 'User Cleanup', fn: testDeleteUser },
    { name: 'Validation Tests', fn: testValidation },
  ];
  
  for (const test of tests) {
    results.total++;
    const passed = await test.fn();
    if (passed) {
      results.passed++;
    } else {
      results.failed++;
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log('═══════════════════════════════════════════════════════\n');
  
  if (results.failed === 0) {
    console.log('🎉 ALL TESTS PASSED! Users API is working perfectly!');
  } else {
    console.log('⚠️ Some tests failed. Please review the errors above.');
  }
}

runAllTests().catch(console.error);


