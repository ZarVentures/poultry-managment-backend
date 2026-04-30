const axios = require('axios');
const { execSync } = require('child_process');

const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';

console.log('🔍 COMPREHENSIVE SYSTEM DIAGNOSIS');
console.log('='.repeat(80));

async function runDiagnosis() {
  const results = {
    compilation: null,
    database: null,
    api: null,
    purchaseOrder: null,
    updateTest: null
  };

  // 1. CHECK COMPILATION
  console.log('\n📦 STEP 1: Checking TypeScript Compilation');
  console.log('-'.repeat(80));
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
    results.compilation = { status: 'SUCCESS', message: 'Project compiles without errors' };
    console.log('✅ Compilation successful');
  } catch (error) {
    results.compilation = { status: 'FAILED', message: error.message };
    console.log('❌ Compilation failed');
    return results;
  }

  // 2. CHECK DATABASE CONNECTION
  console.log('\n🗄️  STEP 2: Checking Database Connection');
  console.log('-'.repeat(80));
  try {
    const { Client } = require('pg');
    require('dotenv').config();
    
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    console.log('✅ Database connected');
    
    // Check purchase_orders table structure
    const tableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'purchase_orders'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Purchase Orders Table Structure:');
    tableInfo.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Check specific purchase order
    const orderQuery = await client.query(`
      SELECT 
        id, order_number, purchase_payment_status,
        total_amount, transport_charges, loading_charges, commission, other_charges,
        weight_shortage, mortality_deduction, other_deduction,
        gross_amount, net_amount, advance_paid, total_payment_made,
        balance_amount, outstanding_payment,
        pg_typeof(total_amount) as total_amount_type,
        pg_typeof(advance_paid) as advance_paid_type,
        pg_typeof(total_payment_made) as total_payment_made_type
      FROM purchase_orders 
      WHERE id = 27
    `);
    
    if (orderQuery.rows.length > 0) {
      const order = orderQuery.rows[0];
      console.log('\n📦 Purchase Order #27 Details:');
      console.log('   Order Number:', order.order_number);
      console.log('   Payment Status:', order.purchase_payment_status);
      console.log('   Total Amount:', order.total_amount, `(${order.total_amount_type})`);
      console.log('   Advance Paid:', order.advance_paid, `(${order.advance_paid_type})`);
      console.log('   Total Payment Made:', order.total_payment_made, `(${order.total_payment_made_type})`);
      console.log('   Net Amount:', order.net_amount);
      console.log('   Balance Amount:', order.balance_amount);
      
      results.database = {
        status: 'SUCCESS',
        order: order,
        types: {
          totalAmount: order.total_amount_type,
          advancePaid: order.advance_paid_type,
          totalPaymentMade: order.total_payment_made_type
        }
      };
    }
    
    await client.end();
    
  } catch (error) {
    results.database = { status: 'FAILED', message: error.message };
    console.log('❌ Database check failed:', error.message);
  }

  // 3. CHECK API HEALTH
  console.log('\n🌐 STEP 3: Checking API Health');
  console.log('-'.repeat(80));
  try {
    const healthCheck = await axios.get(`${API_URL}/health`).catch(() => null);
    if (healthCheck) {
      console.log('✅ API is responding');
      results.api = { status: 'SUCCESS' };
    } else {
      console.log('⚠️  Health endpoint not available, trying login...');
    }
  } catch (error) {
    console.log('⚠️  Health check skipped');
  }

  // 4. TEST LOGIN AND GET PURCHASE ORDER
  console.log('\n🔐 STEP 4: Testing Authentication & Data Retrieval');
  console.log('-'.repeat(80));
  try {
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@azizpoultry.com',
      password: 'admin123'
    });
    const token = loginResponse.data.access_token;
    console.log('✅ Login successful');
    
    const orderResponse = await axios.get(`${API_URL}/purchases/27`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const order = orderResponse.data;
    
    console.log('\n📦 API Response for Purchase Order #27:');
    console.log('   Order Number:', order.orderNumber);
    console.log('   Payment Status:', order.purchasePaymentStatus);
    console.log('   Total Amount:', order.totalAmount, `(${typeof order.totalAmount})`);
    console.log('   Advance Paid:', order.advancePaid, `(${typeof order.advancePaid})`);
    console.log('   Total Payment Made:', order.totalPaymentMade, `(${typeof order.totalPaymentMade})`);
    console.log('   Net Amount:', order.netAmount, `(${typeof order.netAmount})`);
    
    results.purchaseOrder = {
      status: 'SUCCESS',
      order: order,
      types: {
        totalAmount: typeof order.totalAmount,
        advancePaid: typeof order.advancePaid,
        totalPaymentMade: typeof order.totalPaymentMade,
        netAmount: typeof order.netAmount
      }
    };
    
    // 5. TEST UPDATE
    console.log('\n✏️  STEP 5: Testing Update Operation');
    console.log('-'.repeat(80));
    
    // Test 1: Simple field update
    console.log('\nTest 1: Updating notes field...');
    try {
      await axios.patch(
        `${API_URL}/purchases/27`,
        { notes: 'Diagnostic test at ' + new Date().toISOString() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('✅ Notes update successful');
    } catch (error) {
      console.log('❌ Notes update failed');
      console.log('   Status:', error.response?.status);
      console.log('   Error:', error.response?.data);
      
      // Try to get more details from logs
      if (error.response?.status === 500) {
        console.log('\n⚠️  500 Error detected. This indicates a server-side issue.');
        console.log('   Possible causes:');
        console.log('   1. Type conversion error (string vs number)');
        console.log('   2. Database constraint violation');
        console.log('   3. Missing required field');
        console.log('   4. Calculation error with null/undefined values');
      }
    }
    
    // Test 2: Payment status update
    console.log('\nTest 2: Updating payment status...');
    try {
      const updateResponse = await axios.patch(
        `${API_URL}/purchases/27`,
        { purchasePaymentStatus: 'paid' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('✅ Payment status update successful');
      console.log('   New status:', updateResponse.data.purchasePaymentStatus);
      results.updateTest = { status: 'SUCCESS' };
    } catch (error) {
      console.log('❌ Payment status update failed');
      console.log('   Status:', error.response?.status);
      console.log('   Error:', JSON.stringify(error.response?.data, null, 2));
      results.updateTest = { 
        status: 'FAILED', 
        error: error.response?.data,
        statusCode: error.response?.status
      };
    }
    
  } catch (error) {
    console.log('❌ Authentication/API test failed:', error.message);
    results.api = { status: 'FAILED', message: error.message };
  }

  // SUMMARY
  console.log('\n' + '='.repeat(80));
  console.log('📊 DIAGNOSIS SUMMARY');
  console.log('='.repeat(80));
  
  console.log('\n1. Compilation:', results.compilation?.status || 'NOT TESTED');
  console.log('2. Database:', results.database?.status || 'NOT TESTED');
  console.log('3. API:', results.api?.status || 'NOT TESTED');
  console.log('4. Purchase Order Retrieval:', results.purchaseOrder?.status || 'NOT TESTED');
  console.log('5. Update Operation:', results.updateTest?.status || 'NOT TESTED');
  
  if (results.database?.status === 'SUCCESS' && results.purchaseOrder?.status === 'SUCCESS') {
    console.log('\n🔍 TYPE COMPARISON:');
    console.log('   Database types:', JSON.stringify(results.database.types, null, 2));
    console.log('   API response types:', JSON.stringify(results.purchaseOrder.types, null, 2));
    
    if (results.database.types.totalAmount !== 'numeric' && 
        results.purchaseOrder.types.totalAmount === 'string') {
      console.log('\n⚠️  ISSUE IDENTIFIED: Numeric fields are being returned as strings!');
      console.log('   This causes calculation errors in the update method.');
      console.log('   Solution: Ensure all numeric fields are properly converted.');
    }
  }
  
  if (results.updateTest?.status === 'FAILED') {
    console.log('\n❌ ROOT CAUSE: Update operation is failing on the server');
    console.log('   The deployment may not have completed yet, or there is a runtime error.');
    console.log('   Recommendation: Wait for deployment to complete and retry.');
  }
  
  console.log('\n' + '='.repeat(80));
}

runDiagnosis().catch(console.error);


