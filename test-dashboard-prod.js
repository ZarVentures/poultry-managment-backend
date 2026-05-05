const axios = require('axios');

const API_BASE = 'https://13.234.140.190.nip.io/api/v1';

async function testDashboard() {
  try {
    console.log('=== Testing Production Dashboard API ===\n');
    
    // Test 1: Get comprehensive dashboard data
    console.log('1. Testing /dashboard/comprehensive endpoint...');
    const response = await axios.get(`${API_BASE}/dashboard/comprehensive`, {
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
      }
    });
    
    console.log('\n✅ Dashboard API Response:');
    console.log('KPIs:', JSON.stringify(response.data.kpis, null, 2));
    console.log('\nMonthly Trends (last 3 months):');
    response.data.monthlyTrends?.slice(-3).forEach(trend => {
      console.log(`  ${trend.month}: Revenue ₹${trend.revenue}, Expenses ₹${trend.expenses}, Profit ₹${trend.profit}`);
    });
    
    console.log('\nExpenses by Category:');
    response.data.expensesByCategory?.forEach(exp => {
      console.log(`  ${exp.category}: ₹${exp.amount} (${exp.count} transactions)`);
    });
    
    console.log('\nPurchases Summary:', JSON.stringify(response.data.purchasesSummary, null, 2));
    
    // Test 2: Get KPIs with date range
    console.log('\n\n2. Testing /dashboard/kpis with current month...');
    const now = new Date();
    const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const startDate = `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;
    
    console.log(`Date Range: ${startDate} to ${endDate} (IST)`);
    
    const kpisResponse = await axios.get(`${API_BASE}/dashboard/kpis`, {
      params: { startDate, endDate },
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
      }
    });
    
    console.log('\n✅ KPIs Response:', JSON.stringify(kpisResponse.data, null, 2));
    
    console.log('\n\n=== Summary ===');
    console.log('Database: AWS RDS PostgreSQL (poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com)');
    console.log('API Endpoint: /dashboard/comprehensive');
    console.log('Date Handling: IST timezone');
    console.log('\nThe dashboard is fetching data from:');
    console.log('  - Sales table (for revenue)');
    console.log('  - Expenses table (for expenses)');
    console.log('  - Purchase Orders table (for purchases)');
    console.log('  - Vehicles table (for active vehicles count)');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    console.log('\nNote: You need to replace YOUR_TOKEN_HERE with a valid JWT token');
    console.log('To get a token, login through the frontend and copy it from localStorage');
  }
}

testDashboard();
