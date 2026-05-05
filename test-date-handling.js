const { Client } = require('pg');
require('dotenv').config();

async function testDateHandling() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('=== Testing Date Handling ===\n');

    // Get current IST date
    const now = new Date();
    const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayIST = `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;
    
    console.log('Current IST Date:', todayIST);
    console.log('Current UTC Date:', now.toISOString().split('T')[0]);
    console.log();

    // Test 1: Check sales dates
    console.log('=== Sales Dates ===');
    const salesResult = await client.query(`
      SELECT id, sale_date, 
             TO_CHAR(sale_date, 'YYYY-MM-DD') as formatted_date
      FROM sales 
      ORDER BY sale_date DESC 
      LIMIT 5
    `);
    
    console.log('Recent sales:');
    salesResult.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Date: ${row.formatted_date}`);
    });
    console.log();

    // Test 2: Check purchase order dates
    console.log('=== Purchase Order Dates ===');
    const purchaseResult = await client.query(`
      SELECT id, order_date,
             TO_CHAR(order_date, 'YYYY-MM-DD') as formatted_date
      FROM purchase_orders 
      ORDER BY order_date DESC 
      LIMIT 5
    `);
    
    console.log('Recent purchase orders:');
    purchaseResult.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Date: ${row.formatted_date}`);
    });
    console.log();

    // Test 3: Check expense dates
    console.log('=== Expense Dates ===');
    const expenseResult = await client.query(`
      SELECT id, expense_date,
             TO_CHAR(expense_date, 'YYYY-MM-DD') as formatted_date
      FROM expenses 
      ORDER BY expense_date DESC 
      LIMIT 5
    `);
    
    console.log('Recent expenses:');
    expenseResult.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Date: ${row.formatted_date}`);
    });
    console.log();

    // Test 4: Count records by date for current month
    const monthStart = `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-01`;
    
    console.log('=== Current Month Summary (IST) ===');
    console.log(`Month Start: ${monthStart}`);
    console.log(`Today: ${todayIST}`);
    console.log();

    const salesCount = await client.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(net_amount), 0) as total
      FROM sales 
      WHERE sale_date >= $1 AND sale_date <= $2
    `, [monthStart, todayIST]);
    
    console.log(`Sales this month: ${salesCount.rows[0].count} records, Total: ₹${salesCount.rows[0].total}`);

    const expenseCount = await client.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM expenses 
      WHERE expense_date >= $1 AND expense_date <= $2
    `, [monthStart, todayIST]);
    
    console.log(`Expenses this month: ${expenseCount.rows[0].count} records, Total: ₹${expenseCount.rows[0].total}`);
    console.log();

    // Test 5: Verify date storage format
    console.log('=== Date Storage Verification ===');
    const dateTypeCheck = await client.query(`
      SELECT column_name, data_type, datetime_precision
      FROM information_schema.columns
      WHERE table_name IN ('sales', 'expenses', 'purchase_orders')
        AND column_name LIKE '%date%'
      ORDER BY table_name, column_name
    `);
    
    console.log('Date columns in database:');
    dateTypeCheck.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}${row.datetime_precision ? `(${row.datetime_precision})` : ''}`);
    });

    console.log('\n✅ Date handling test complete!');
    console.log('\nKey Points:');
    console.log('- Database stores dates as plain DATE type (no timezone)');
    console.log('- Application should work in IST timezone');
    console.log('- All date comparisons should use IST dates');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

testDateHandling();
