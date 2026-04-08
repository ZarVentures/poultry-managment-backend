require('dotenv').config();

async function testPurchaseUpdateDetailed() {
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
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  // Get purchase order ID 27
  console.log('Fetching purchase order ID 27...');
  const purchaseResponse = await fetch(`${API_URL}/purchases/27`, { headers });
  
  if (!purchaseResponse.ok) {
    console.log('❌ Failed to fetch purchase order');
    return;
  }

  const purchase = await purchaseResponse.json();
  
  console.log('\nCurrent purchase order:');
  console.log(JSON.stringify(purchase, null, 2));

  // Try to update with the same data structure the frontend sends
  console.log('\n\nAttempting to update with full data...');
  
  const updateData = {
    orderNumber: purchase.orderNumber,
    supplierName: purchase.supplierName,
    orderDate: purchase.orderDate,
    status: purchase.status,
    purchasePaymentStatus: 'paid',
    items: [], // Empty items array like frontend sends
  };

  console.log('\nSending update data:');
  console.log(JSON.stringify(updateData, null, 2));

  const updateResponse = await fetch(`${API_URL}/purchases/27`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updateData)
  });

  console.log('\nResponse status:', updateResponse.status);

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    console.log('❌ Update failed');
    console.log('Error response:', errorText);
    return;
  }

  const updated = await updateResponse.json();
  console.log('✅ Update successful!');
  console.log('\nUpdated purchase order:');
  console.log('Payment Status:', updated.purchasePaymentStatus);
}

testPurchaseUpdateDetailed().catch(console.error);


