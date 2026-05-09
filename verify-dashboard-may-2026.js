const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('amazonaws.com') ? { rejectUnauthorized: false } : false,
});

async function verifyDashboardData() {
  await client.connect();
  console.log('Connected to DB');

  try {
    console.log('\n=== DASHBOARD DATA VERIFICATION FOR MAY 2026 ===');
    console.log('Date Range: 2026-05-01 to 2026-05-07 (Today)');
    
    // Sales for May 2026
    const salesResult = await client.query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(net_amount), 0) as total_revenue
      FROM sales 
      WHERE sale_date >= '2026-05-01' AND sale_date <= '2026-05-07'
    `);
    
    console.log('\n--- SALES (May 1-7, 2026) ---');
    console.log('Count:', salesResult.rows[0].count);
    console.log('Total Revenue:', '₹' + Number(salesResult.rows[0].total_revenue).toLocaleString());
    
    // Purchases for May 2026
    const purchasesResult = await client.query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(net_amount), 0) as total_value
      FROM purchase_orders 
      WHERE order_date >= '2026-05-01' AND order_date <= '2026-05-07'
    `);
    
    console.log('\n--- PURCHASES (May 1-7, 2026) ---');
    console.log('Count:', purchasesResult.rows[0].count);
    console.log('Total Value:', '₹' + Number(purchasesResult.rows[0].total_value).toLocaleString());
    
    // Expenses for May 2026
    const expensesResult = await client.query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses 
      WHERE expense_date >= '2026-05-01' AND expense_date <= '2026-05-07'
    `);
    
    console.log('\n--- EXPENSES (May 1-7, 2026) ---');
    console.log('Count:', expensesResult.rows[0].count);
    console.log('Total Expenses:', '₹' + Number(expensesResult.rows[0].total_expenses).toLocaleString());
    
    // Recent sales to see actual dates
    const recentSales = await client.query(`
      SELECT sale_date, customer_name, net_amount 
      FROM sales 
      WHERE sale_date >= '2026-05-01' AND sale_date <= '2026-05-07'
      ORDER BY sale_date DESC 
      LIMIT 10
    `);
    
    console.log('\n--- RECENT SALES IN MAY 2026 ---');
    recentSales.rows.forEach(sale => {
      console.log(`${sale.sale_date} | ${sale.customer_name} | ₹${Number(sale.net_amount).toFixed(2)}`);
    });
    
    // Check what the dashboard API would return for "This Month" (current month start to today)
    console.log('\n--- DASHBOARD API LOGIC CHECK ---');
    console.log('Current IST date logic should use: 2026-05-01 to 2026-05-07');
    
    const dashboardSales = await client.query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(net_amount), 0) as total_revenue
      FROM sales 
      WHERE sale_date >= '2026-05-01' AND sale_date <= '2026-05-07'
    `);
    
    console.log('Dashboard Sales Count:', dashboardSales.rows[0].count);
    console.log('Dashboard Sales Revenue:', '₹' + Number(dashboardSales.rows[0].total_revenue).toLocaleString());
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

verifyDashboardData();