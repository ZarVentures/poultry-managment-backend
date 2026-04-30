require('dotenv').config();

async function verifyPaymentStatusUpdate() {
  const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';

  console.log('🔍 VERIFYING PAYMENT STATUS UPDATE FUNCTIONALITY');
  console.log('='.repeat(70));
  console.log();

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
  console.log('Step 1: Fetching purchase order ID 27...');
  const purchaseResponse = await fetch(`${API_URL}/purchases/27`, { headers });
  
  if (!purchaseResponse.ok) {
    console.log('❌ Failed to fetch purchase order');
    return;
  }

  const purchase = await purchaseResponse.json();
  
  console.log('✅ Purchase order fetched');
  console.log('   Order Number:', purchase.orderNumber);
  console.log('   Supplier:', purchase.supplierName);
  console.log('   Current Payment Status:', purchase.purchasePaymentStatus);
  console.log('   Net Amount: ₹' + purchase.netAmount);
  console.log();

  // Update payment status to 'paid'
  console.log('Step 2: Updating payment status to "paid"...');
  
  const updateData = {
    orderNumber: purchase.orderNumber,
    supplierName: purchase.supplierName,
    orderDate: purchase.orderDate,
    status: purchase.status,
    purchasePaymentStatus: 'paid',
    items: [] // Empty array - should be accepted now
  };

  const updateResponse = await fetch(`${API_URL}/purchases/27`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updateData)
  });

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    console.log('❌ Update failed');
    console.log('   Status:', updateResponse.status);
    console.log('   Error:', errorText);
    console.log();
    console.log('⚠️  Deployment may not be complete yet. Wait a few minutes and try again.');
    return;
  }

  const updated = await updateResponse.json();
  console.log('✅ Update successful!');
  console.log('   New Payment Status:', updated.purchasePaymentStatus);
  console.log();

  // Verify by fetching again
  console.log('Step 3: Verifying payment status was saved to database...');
  const verifyResponse = await fetch(`${API_URL}/purchases/27`, { headers });
  const verified = await verifyResponse.json();
  
  console.log('✅ Verification fetch successful');
  console.log('   Payment Status in DB:', verified.purchasePaymentStatus);
  console.log();

  // Final check
  if (verified.purchasePaymentStatus === 'paid') {
    console.log('='.repeat(70));
    console.log('🎉 SUCCESS! Payment status was saved to database correctly!');
    console.log('='.repeat(70));
    console.log();
    console.log('✅ Payment status change: pending → paid');
    console.log('✅ Saved to database: YES');
    console.log('✅ Persisted after fetch: YES');
    console.log();
    console.log('The payment status update functionality is working correctly!');
  } else {
    console.log('❌ FAILED! Payment status was not saved correctly');
    console.log('   Expected: paid');
    console.log('   Got:', verified.purchasePaymentStatus);
  }
}

verifyPaymentStatusUpdate().catch(console.error);


