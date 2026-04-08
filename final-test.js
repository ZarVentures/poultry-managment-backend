const axios = require('axios');

const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';

async function finalTest() {
  console.log('🎯 FINAL COMPREHENSIVE TEST');
  console.log('='.repeat(70));

  try {
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@azizpoultry.com',
      password: 'admin123'
    });
    const token = loginResponse.data.access_token;
    console.log('✅ Login successful\n');

    // Test 1: Update with cages (exact browser payload)
    console.log('Test 1: Update with cages (browser payload)');
    const payloadWithCages = {
      "orderNumber": "PO-2312",
      "supplierName": "Usman Tariq",
      "orderDate": "2026-03-04",
      "status": "pending",
      "farmerId": "35",
      "farmerMobile": "+92-300-1234567",
      "farmLocation": "Farm House, Village Chak 123, Faisalabad",
      "vehicleId": "26",
      "birdType": "layer",
      "totalWeight": "123",
      "ratePerKg": "12.00",
      "transportCharges": "123.00",
      "loadingCharges": "122.98",
      "commission": "123.00",
      "otherCharges": "32.00",
      "weightShortage": "213.00",
      "mortalityDeduction": "0.00",
      "otherDeduction": "0.00",
      "purchasePaymentStatus": "partial",
      "advancePaid": "122.00",
      "paymentMode": "bank_transfer",
      "totalPaymentMade": "0.00",
      "notes": "Final test with cages",
      "items": [],
      "cages": [{"cageId": "1231", "birdType": "layer", "numberOfBirds": 123, "cageWeight": 123}]
    };

    try {
      const r1 = await axios.patch(`${API_URL}/purchases/27`, payloadWithCages, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('   ✅ SUCCESS - Payment status:', r1.data.purchasePaymentStatus);
    } catch (e) {
      console.log('   ❌ FAILED -', e.response?.status, e.response?.data?.message);
    }

    // Test 2: Update payment status only
    console.log('\nTest 2: Update payment status only');
    try {
      const r2 = await axios.patch(`${API_URL}/purchases/27`, 
        { purchasePaymentStatus: 'paid' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('   ✅ SUCCESS - Payment status:', r2.data.purchasePaymentStatus);
    } catch (e) {
      console.log('   ❌ FAILED -', e.response?.status, e.response?.data?.message);
    }

    // Test 3: Verify payment status persists
    console.log('\nTest 3: Verify payment status persists in database');
    try {
      const r3 = await axios.get(`${API_URL}/purchases/27`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('   ✅ Payment status in DB:', r3.data.purchasePaymentStatus);
    } catch (e) {
      console.log('   ❌ FAILED -', e.response?.status);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ TESTING COMPLETE');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

finalTest();

