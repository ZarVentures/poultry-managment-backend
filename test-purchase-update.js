require('dotenv').config();

async function testPurchaseUpdate() {
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

  // Get purchase order PO-2024-004
  console.log('Fetching purchase order PO-2024-004...');
  const purchasesResponse = await fetch(`${API_URL}/purchases`, { headers });
  const purchases = await purchasesResponse.json();
  
  const purchase = purchases.find(p => p.orderNumber === 'PO-2024-004');
  
  if (!purchase) {
    console.log('Purchase order PO-2024-004 not found');
    return;
  }

  console.log('\nCurrent purchase order:');
  console.log('Order Number:', purchase.orderNumber);
  console.log('Supplier:', purchase.supplierName);
  console.log('Payment Status:', purchase.purchasePaymentStatus);
  console.log('Net Amount:', purchase.netAmount);
  console.log('Total Payment Made:', purchase.totalPaymentMade);
  console.log('Balance:', purchase.balanceAmount);

  // Try to update payment status to 'paid'
  console.log('\n\nAttempting to update payment status to "paid"...');
  
  const updateData = {
    purchasePaymentStatus: 'paid'
  };

  const updateResponse = await fetch(`${API_URL}/purchases/${purchase.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updateData)
  });

  if (!updateResponse.ok) {
    const error = await updateResponse.json();
    console.log('❌ Update failed:', error);
    return;
  }

  const updated = await updateResponse.json();
  console.log('✅ Update successful!');
  console.log('\nUpdated purchase order:');
  console.log('Payment Status:', updated.purchasePaymentStatus);
  console.log('Net Amount:', updated.netAmount);
  console.log('Total Payment Made:', updated.totalPaymentMade);
  console.log('Balance:', updated.balanceAmount);
}

testPurchaseUpdate().catch(console.error);


