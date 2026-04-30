require('dotenv').config();

async function testUsersComplete() {
  const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';
  let testUserId = null;
  let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  function logTest(name, passed, message = '') {
    testResults.total++;
    if (passed) {
      testResults.passed++;
      console.log(`✅ ${name}`);
    } else {
      testResults.failed++;
      console.log(`❌ ${name}: ${message}`);
    }
    testResults.tests.push({ name, passed, message });
  }

  try {
    console.log('🧪 USERS MODULE - COMPLETE FUNCTIONALITY TEST');
    console.log('='.repeat(60));
    console.log();

    // Test 1: Login
    console.log('1️⃣  Authentication');
    const loginResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@azizpoultry.com',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      logTest('Login', false, 'Failed to authenticate');
      return;
    }

    const { accessToken } = await loginResponse.json();
    logTest('Login', true);
    console.log();

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    // Test 2: Get all users
    console.log('2️⃣  Read Operations');
    const usersResponse = await fetch(`${API_URL}/users`, { headers });
    const users = await usersResponse.json();
    logTest('Get all users', usersResponse.ok && Array.isArray(users), 
      !usersResponse.ok ? 'Failed to fetch users' : '');
    console.log(`   Found ${users.length} users`);

    // Test 3: Get statistics
    const statsResponse = await fetch(`${API_URL}/users/statistics/summary`, { headers });
    const stats = await statsResponse.json();
    logTest('Get user statistics', statsResponse.ok && stats.totalUsers !== undefined,
      !statsResponse.ok ? 'Failed to fetch statistics' : '');
    if (statsResponse.ok) {
      console.log(`   Total: ${stats.totalUsers}, Active: ${stats.activeUsers}, Inactive: ${stats.inactiveUsers}`);
      console.log(`   Admins: ${stats.adminUsers}, Managers: ${stats.managerUsers}, Staff: ${stats.staffUsers}`);
    }
    console.log();

    // Test 4: Create user
    console.log('3️⃣  Create Operations');
    const timestamp = Date.now();
    const createResponse = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Test User Complete',
        email: `testcomplete${timestamp}@test.com`,
        password: 'test123',
        phone: '1234567890',
        role: 'staff',
        status: 'active',
        notes: 'Created by complete test'
      })
    });

    if (createResponse.ok) {
      const newUser = await createResponse.json();
      testUserId = newUser.id;
      logTest('Create user', true);
      console.log(`   Created user ID: ${testUserId}`);
    } else {
      const error = await createResponse.json();
      logTest('Create user', false, error.message);
    }
    console.log();

    if (!testUserId) {
      console.log('⚠️  Cannot continue tests without user ID');
      return;
    }

    // Test 5: Get single user
    console.log('4️⃣  Read Single User');
    const userResponse = await fetch(`${API_URL}/users/${testUserId}`, { headers });
    const user = await userResponse.json();
    logTest('Get user by ID', userResponse.ok && user.id === testUserId,
      !userResponse.ok ? 'Failed to fetch user' : '');
    console.log();

    // Test 6: Update user
    console.log('5️⃣  Update Operations');
    const updateResponse = await fetch(`${API_URL}/users/${testUserId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        name: 'Test User Updated',
        notes: 'Updated by complete test'
      })
    });
    const updated = updateResponse.ok ? await updateResponse.json() : null;
    logTest('Update user', updateResponse.ok && updated?.name === 'Test User Updated',
      !updateResponse.ok ? 'Failed to update user' : '');
    console.log();

    // Test 7: Deactivate user
    console.log('6️⃣  Status Management - Deactivate');
    const deactivateResponse = await fetch(`${API_URL}/users/${testUserId}/deactivate`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({})
    });
    const deactivated = deactivateResponse.ok ? await deactivateResponse.json() : null;
    logTest('Deactivate user', deactivateResponse.ok && deactivated?.status === 'inactive',
      !deactivateResponse.ok ? 'Failed to deactivate user' : '');
    console.log();

    // Test 8: Activate user
    console.log('7️⃣  Status Management - Activate');
    const activateResponse = await fetch(`${API_URL}/users/${testUserId}/activate`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({})
    });
    const activated = activateResponse.ok ? await activateResponse.json() : null;
    logTest('Activate user', activateResponse.ok && activated?.status === 'active',
      !activateResponse.ok ? 'Failed to activate user' : '');
    console.log();

    // Test 9: Delete user
    console.log('8️⃣  Delete Operations');
    const deleteResponse = await fetch(`${API_URL}/users/${testUserId}`, {
      method: 'DELETE',
      headers
    });
    logTest('Delete user', deleteResponse.ok, 
      !deleteResponse.ok ? `Failed with status ${deleteResponse.status}` : '');
    console.log();

    // Test 10: Verify deletion
    console.log('9️⃣  Verify Deletion');
    const verifyResponse = await fetch(`${API_URL}/users/${testUserId}`, { headers });
    logTest('User deleted from database', verifyResponse.status === 404,
      verifyResponse.ok ? 'User still exists' : '');
    console.log();

    // Test 11: Validation tests
    console.log('🔟 Validation Tests');
    
    // Missing required fields
    const invalidResponse1 = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Test' })
    });
    logTest('Reject missing email', !invalidResponse1.ok);

    // Duplicate email
    const duplicateResponse = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Duplicate Test',
        email: 'admin@azizpoultry.com',
        password: 'test123',
        role: 'staff'
      })
    });
    logTest('Reject duplicate email', !duplicateResponse.ok);

    // Invalid email format
    const invalidEmailResponse = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Invalid Email',
        email: 'notanemail',
        password: 'test123',
        role: 'staff'
      })
    });
    logTest('Reject invalid email format', !invalidEmailResponse.ok);

    console.log();

  } catch (error) {
    console.error('❌ Test suite error:', error.message);
  }

  // Print summary
  console.log('='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  console.log();

  if (testResults.failed > 0) {
    console.log('Failed Tests:');
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => console.log(`  - ${t.name}: ${t.message}`));
    console.log();
  }

  if (testResults.passed === testResults.total) {
    console.log('🎉 ALL TESTS PASSED! Users module is fully functional.');
  } else {
    console.log('⚠️  Some tests failed. Please review the issues above.');
  }
}

testUsersComplete().catch(console.error);


