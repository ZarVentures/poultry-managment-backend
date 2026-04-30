require('dotenv').config();

async function debugMasterEntries() {
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

  console.log('Testing Farmers endpoint...');
  const farmersResponse = await fetch(`${API_URL}/farmers`, { headers });
  console.log('Status:', farmersResponse.status);
  console.log('Content-Type:', farmersResponse.headers.get('content-type'));
  const farmersText = await farmersResponse.text();
  console.log('Response:', farmersText.substring(0, 200));
  console.log();

  console.log('Testing Farmer Statistics endpoint...');
  const farmerStatsResponse = await fetch(`${API_URL}/farmers/statistics/summary`, { headers });
  console.log('Status:', farmerStatsResponse.status);
  const farmerStatsText = await farmerStatsResponse.text();
  console.log('Response:', farmerStatsText);
  console.log();

  console.log('Testing Retailer Statistics endpoint...');
  const retailerStatsResponse = await fetch(`${API_URL}/retailers/statistics/summary`, { headers });
  console.log('Status:', retailerStatsResponse.status);
  const retailerStatsText = await retailerStatsResponse.text();
  console.log('Response:', retailerStatsText);
  console.log();

  console.log('Testing Vehicle Statistics endpoint...');
  const vehicleStatsResponse = await fetch(`${API_URL}/vehicles/statistics/summary`, { headers });
  console.log('Status:', vehicleStatsResponse.status);
  const vehicleStatsText = await vehicleStatsResponse.text();
  console.log('Response:', vehicleStatsText);
  console.log();

  console.log('Testing Inventory Statistics endpoint...');
  const inventoryStatsResponse = await fetch(`${API_URL}/inventory/statistics/summary`, { headers });
  console.log('Status:', inventoryStatsResponse.status);
  const inventoryStatsText = await inventoryStatsResponse.text();
  console.log('Response:', inventoryStatsText);
}

debugMasterEntries().catch(console.error);


