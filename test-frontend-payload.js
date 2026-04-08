const axios = require('axios');

const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';

async function testFrontendPayload() {
  console.log('🔍 TESTING WITH FRONTEND-LIKE PAYLOAD');
  console.log('='.repeat(70));

  try {
    // Login
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@azizpoultry.com',
      password: 'admin123'
    });
    const token = loginResponse.data.access_token;
    console.log('✅ Login successful\n');

    // Get the order first
    console.log('📋 Fetching purchase order 27...');
    const getResponse = await axios.get(`${API_URL}/purchases/27`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const order = getResponse.data;
    console.log('✅ Order fetched');
    console.log('   Current payment status:', order.purchasePaymentStatus);
    console.log('   Order data:', JSON.stringify(order, null, 2).substring(0, 500) + '...\n');

    // Simulate what frontend sends (full order data)
    console.log('📝 Sending update with full order data (like frontend does)...');
    
    const updatePayload = {
      orderNumber: order.orderNumber,
      supplierName: order.supplierName,
      orderDate: order.orderDate,
      dueDate: order.dueDate || undefined,
      status: order.status,
      farmerId: order.farmerId || undefined,
      farmerMobile: order.farmerMobile || undefined,
      farmLocation: order.farmLocation || undefined,
      vehicleId: order.vehicleId || undefined,
      birdType: order.birdType || undefined,
      totalWeight: order.totalWeight?.toString() || undefined,
      ratePerKg: order.ratePerKg || undefined,
      transportCharges: order.transportCharges || undefined,
      loadingCharges: order.loadingCharges || undefined,
      commission: order.commission || undefined,
      otherCharges: order.otherCharges || undefined,
      weightShortage: order.weightShortage || undefined,
      mortalityDeduction: order.mortalityDeduction || undefined,
      otherDeduction: order.otherDeduction || undefined,
      purchasePaymentStatus: 'partial', // Change to partial
      advancePaid: order.advancePaid || undefined,
      paymentMode: order.paymentMode || undefined,
      totalPaymentMade: order.totalPaymentMade || undefined,
      notes: order.notes,
      items: [], // Empty items array like frontend sends
    };

    console.log('Payload keys:', Object.keys(updatePayload).join(', '));
    console.log('Items:', updatePayload.items);
    console.log('Payment status change:', order.purchasePaymentStatus, '→', updatePayload.purchasePaymentStatus);

    try {
      const updateResponse = await axios.patch(
        `${API_URL}/purchases/27`,
        updatePayload,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      console.log('\n✅ Update successful!');
      console.log('   New payment status:', updateResponse.data.purchasePaymentStatus);
      
    } catch (error) {
      console.log('\n❌ Update failed');
      console.log('   Status:', error.response?.status);
      console.log('   Error:', JSON.stringify(error.response?.data, null, 2));
      
      if (error.response?.status === 500) {
        console.log('\n🔍 This is the same error you see in the browser!');
        console.log('   The issue is with the payload structure or data types.');
        
        // Try with minimal payload
        console.log('\n📝 Trying with minimal payload...');
        try {
          const minimalUpdate = await axios.patch(
            `${API_URL}/purchases/27`,
            { purchasePaymentStatus: 'partial' },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          console.log('✅ Minimal update works! New status:', minimalUpdate.data.purchasePaymentStatus);
          console.log('   Problem is with the full payload from frontend.');
        } catch (minError) {
          console.log('❌ Even minimal update fails:', minError.response?.data);
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

testFrontendPayload();

