const axios = require('axios');

const API_URL = 'process.env.API_URL || 'https://13.234.140.190.nip.io/api/v1'';

async function testReportsAPI() {
  console.log('🔍 TESTING REPORTS API');
  console.log('='.repeat(70));

  try {
    // Login
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@azizpoultry.com',
      password: 'admin123'
    });
    const token = loginResponse.data.access_token;
    console.log('✅ Login successful\n');

    // Test Purchase Report
    console.log('📦 Testing Purchase Report...');
    try {
      const purchaseReport = await axios.get(`${API_URL}/reports/purchases`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('   ✅ Purchase Report API working');
      console.log('   Total Orders:', purchaseReport.data.summary.totalOrders);
      console.log('   Total Amount: ₹', purchaseReport.data.summary.totalNetAmount.toFixed(2));
    } catch (e) {
      console.log('   ❌ Failed:', e.response?.status, e.response?.data?.message);
    }

    // Test Sales Report
    console.log('\n💰 Testing Sales Report...');
    try {
      const salesReport = await axios.get(`${API_URL}/reports/sales`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('   ✅ Sales Report API working');
      console.log('   Total Sales:', salesReport.data.summary.totalSales);
      console.log('   Total Amount: ₹', salesReport.data.summary.totalNetAmount.toFixed(2));
    } catch (e) {
      console.log('   ❌ Failed:', e.response?.status, e.response?.data?.message);
    }

    // Test Mortality Report
    console.log('\n☠️  Testing Mortality Report...');
    try {
      const mortalityReport = await axios.get(`${API_URL}/reports/mortality`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('   ✅ Mortality Report API working');
      console.log('   Orders with Mortality:', mortalityReport.data.summary.totalOrders);
      console.log('   Total Deduction: ₹', mortalityReport.data.summary.totalMortalityDeduction.toFixed(2));
    } catch (e) {
      console.log('   ❌ Failed:', e.response?.status, e.response?.data?.message);
    }

    // Test Profit/Loss Report
    console.log('\n📊 Testing Profit/Loss Report...');
    try {
      const plReport = await axios.get(`${API_URL}/reports/profit-loss`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('   ✅ Profit/Loss Report API working');
      console.log('   Total Revenue: ₹', plReport.data.summary.totalRevenue.toFixed(2));
      console.log('   Total Cost: ₹', plReport.data.summary.totalCost.toFixed(2));
      console.log('   Net Profit: ₹', plReport.data.summary.netProfit.toFixed(2));
      console.log('   Profit Margin:', plReport.data.summary.profitMargin.toFixed(2) + '%');
    } catch (e) {
      console.log('   ❌ Failed:', e.response?.status, e.response?.data?.message);
    }

    // Test with date range
    console.log('\n📅 Testing with Date Range (Feb 2024)...');
    try {
      const dateRangeReport = await axios.get(
        `${API_URL}/reports/profit-loss?startDate=2024-02-01&endDate=2024-02-29`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('   ✅ Date range filtering working');
      console.log('   Net Profit (Feb 2024): ₹', dateRangeReport.data.summary.netProfit.toFixed(2));
    } catch (e) {
      console.log('   ❌ Failed:', e.response?.status, e.response?.data?.message);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL REPORTS API TESTS COMPLETE');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testReportsAPI();

