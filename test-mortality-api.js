const axios = require('axios');

const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';

async function testMortalityAPI() {
  console.log('🧪 TESTING MORTALITY API');
  console.log('='.repeat(70));

  try {
    // 1. Login to get token
    console.log('\n1️⃣ Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@azizpoultry.com',
      password: 'admin123'
    });
    const token = loginResponse.data.accessToken;
    console.log('✅ Login successful');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. Get all purchase orders to find one to link
    console.log('\n2️⃣ Fetching purchase orders...');
    const purchasesResponse = await axios.get(`${API_URL}/purchases`, { headers });
    const purchases = purchasesResponse.data;
    console.log(`✅ Found ${purchases.length} purchase orders`);

    if (purchases.length === 0) {
      console.log('⚠️  No purchase orders found. Please create one first.');
      return;
    }

    const firstPurchase = purchases[0];
    console.log(`   Using purchase: ${firstPurchase.orderNumber}`);
    console.log(`   Supplier: ${firstPurchase.supplierName}`);
    console.log(`   Date: ${firstPurchase.orderDate}`);

    // Calculate total birds from cages
    let totalBirds = 0;
    if (firstPurchase.cages && firstPurchase.cages.length > 0) {
      totalBirds = firstPurchase.cages.reduce((sum, cage) => sum + (cage.numberOfBirds || 0), 0);
      console.log(`   Total birds in cages: ${totalBirds}`);
    }

    // 3. Create a mortality record
    console.log('\n3️⃣ Creating mortality record...');
    const mortalityData = {
      purchaseInvoiceNo: firstPurchase.orderNumber,
      purchaseDate: firstPurchase.orderDate,
      farmerName: firstPurchase.supplierName,
      farmLocation: firstPurchase.farmLocation || 'Test Location',
      cageIdNumber: firstPurchase.cages?.[0]?.cageId || undefined,
      totalBirdsPurchased: totalBirds,
      numberOfBirdsDied: 5,
      cause: 'Test mortality - natural causes',
      notes: 'This is a test mortality record'
    };

    const createResponse = await axios.post(`${API_URL}/mortality`, mortalityData, { headers });
    const createdMortality = createResponse.data;
    console.log('✅ Mortality record created successfully');
    console.log(`   Record Number: ${createdMortality.recordNumber}`);
    console.log(`   ID: ${createdMortality.id}`);

    // 4. Get all mortality records
    console.log('\n4️⃣ Fetching all mortality records...');
    const getAllResponse = await axios.get(`${API_URL}/mortality`, { headers });
    const allMortalities = getAllResponse.data;
    console.log(`✅ Found ${allMortalities.length} mortality records`);

    // 5. Get single mortality record
    console.log('\n5️⃣ Fetching single mortality record...');
    const getOneResponse = await axios.get(`${API_URL}/mortality/${createdMortality.id}`, { headers });
    const mortality = getOneResponse.data;
    console.log('✅ Mortality record retrieved:');
    console.log(`   Record Number: ${mortality.recordNumber}`);
    console.log(`   Purchase Invoice: ${mortality.purchaseInvoiceNo}`);
    console.log(`   Farmer: ${mortality.farmerName}`);
    console.log(`   Total Birds Purchased: ${mortality.totalBirdsPurchased}`);
    console.log(`   Birds Died: ${mortality.numberOfBirdsDied}`);
    console.log(`   Cause: ${mortality.cause}`);

    // 6. Update mortality record
    console.log('\n6️⃣ Updating mortality record...');
    const updateData = {
      numberOfBirdsDied: 8,
      cause: 'Updated cause - disease',
      notes: 'Updated notes'
    };
    const updateResponse = await axios.patch(`${API_URL}/mortality/${createdMortality.id}`, updateData, { headers });
    console.log('✅ Mortality record updated successfully');
    console.log(`   New birds died count: ${updateResponse.data.numberOfBirdsDied}`);
    console.log(`   New cause: ${updateResponse.data.cause}`);

    // 7. Get stats
    console.log('\n7️⃣ Fetching mortality stats...');
    const statsResponse = await axios.get(`${API_URL}/mortality/stats`, { headers });
    const stats = statsResponse.data;
    console.log('✅ Mortality stats:');
    console.log(`   Total Records: ${stats.totalRecords}`);
    console.log(`   Total Birds Purchased: ${stats.totalBirdsPurchased}`);
    console.log(`   Total Birds Death: ${stats.totalBirdsDeath}`);
    console.log(`   Total Value: ₹${stats.totalValue}`);

    // 8. Delete mortality record
    console.log('\n8️⃣ Deleting test mortality record...');
    await axios.delete(`${API_URL}/mortality/${createdMortality.id}`, { headers });
    console.log('✅ Mortality record deleted successfully');

    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ ERROR:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testMortalityAPI();

