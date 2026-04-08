const axios = require('axios');

const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';

async function testExactPayload() {
  console.log('🔍 TESTING EXACT PAYLOAD FROM BROWSER');
  console.log('='.repeat(70));

  try {
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@azizpoultry.com',
      password: 'admin123'
    });
    const token = loginResponse.data.access_token;
    console.log('✅ Login successful\n');

    // Exact payload from browser
    const payload = {
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
      "purchasePaymentStatus": "paid",
      "advancePaid": "122.00",
      "paymentMode": "bank_transfer",
      "totalPaymentMade": "0.00",
      "notes": "Test 2026-03-04T22:51:14.547Z",
      "items": [],
      "cages": [
        {
          "cageId": "1231",
          "birdType": "layer",
          "numberOfBirds": 123,
          "cageWeight": 123
        }
      ]
    };

    console.log('📝 Sending exact payload from browser...\n');

    try {
      const updateResponse = await axios.patch(
        `${API_URL}/purchases/27`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('✅ Update successful!');
      console.log('   Payment status:', updateResponse.data.purchasePaymentStatus);
    } catch (error) {
      console.log('❌ Update failed');
      console.log('   Status:', error.response?.status);
      console.log('   Error:', JSON.stringify(error.response?.data, null, 2));
      
      // Try without cages
      console.log('\n📝 Trying same payload WITHOUT cages...');
      const payloadWithoutCages = { ...payload };
      delete payloadWithoutCages.cages;
      
      try {
        const response2 = await axios.patch(
          `${API_URL}/purchases/27`,
          payloadWithoutCages,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('✅ Update without cages successful!');
        console.log('   Payment status:', response2.data.purchasePaymentStatus);
        console.log('\n🔍 ISSUE IDENTIFIED: The cages field is causing the error!');
      } catch (error2) {
        console.log('❌ Still failed:', error2.response?.data);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testExactPayload();

