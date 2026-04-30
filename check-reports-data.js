const { Client } = require('pg');
require('dotenv').config();

async function checkReportsData() {
  console.log('🔍 CHECKING DATA AVAILABILITY FOR REPORTS');
  console.log('='.repeat(70));

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Database connected\n');

    // Check Purchases
    console.log('📦 PURCHASE ORDERS:');
    const purchases = await client.query(`
      SELECT 
        COUNT(*) as total_count,
        MIN(order_date) as earliest_date,
        MAX(order_date) as latest_date,
        SUM(CAST(total_amount AS NUMERIC)) as total_amount,
        SUM(CAST(net_amount AS NUMERIC)) as total_net_amount
      FROM purchase_orders
    `);
    console.log('   Total Orders:', purchases.rows[0].total_count);
    console.log('   Date Range:', purchases.rows[0].earliest_date, 'to', purchases.rows[0].latest_date);
    console.log('   Total Amount: ₹', purchases.rows[0].total_amount);
    console.log('   Total Net Amount: ₹', purchases.rows[0].total_net_amount);

    // Sample purchases
    const samplePurchases = await client.query(`
      SELECT order_number, order_date, supplier_name, total_amount, net_amount, purchase_payment_status
      FROM purchase_orders
      ORDER BY order_date DESC
      LIMIT 5
    `);
    console.log('\n   Recent Purchases:');
    samplePurchases.rows.forEach(p => {
      console.log(`   - ${p.order_number} | ${p.order_date} | ${p.supplier_name} | ₹${p.net_amount} | ${p.purchase_payment_status}`);
    });

    // Check Sales
    console.log('\n\n💰 SALES:');
    const sales = await client.query(`
      SELECT 
        COUNT(*) as total_count,
        MIN(sale_date) as earliest_date,
        MAX(sale_date) as latest_date,
        SUM(CAST(total_amount AS NUMERIC)) as total_amount,
        SUM(CAST(net_amount AS NUMERIC)) as total_net_amount
      FROM sales
    `);
    console.log('   Total Sales:', sales.rows[0].total_count);
    console.log('   Date Range:', sales.rows[0].earliest_date, 'to', sales.rows[0].latest_date);
    console.log('   Total Amount: ₹', sales.rows[0].total_amount);
    console.log('   Total Net Amount: ₹', sales.rows[0].total_net_amount);

    // Sample sales
    const sampleSales = await client.query(`
      SELECT invoice_number, sale_date, customer_name, total_amount, net_amount, payment_status
      FROM sales
      ORDER BY sale_date DESC
      LIMIT 5
    `);
    console.log('\n   Recent Sales:');
    sampleSales.rows.forEach(s => {
      console.log(`   - ${s.invoice_number} | ${s.sale_date} | ${s.customer_name} | ₹${s.net_amount} | ${s.payment_status}`);
    });

    // Check Expenses
    console.log('\n\n💸 EXPENSES:');
    const expenses = await client.query(`
      SELECT 
        COUNT(*) as total_count,
        MIN(expense_date) as earliest_date,
        MAX(expense_date) as latest_date,
        SUM(CAST(amount AS NUMERIC)) as total_amount
      FROM expenses
    `);
    console.log('   Total Expenses:', expenses.rows[0].total_count);
    console.log('   Date Range:', expenses.rows[0].earliest_date, 'to', expenses.rows[0].latest_date);
    console.log('   Total Amount: ₹', expenses.rows[0].total_amount);

    // Sample expenses
    const sampleExpenses = await client.query(`
      SELECT expense_date, category, description, amount
      FROM expenses
      ORDER BY expense_date DESC
      LIMIT 5
    `);
    console.log('\n   Recent Expenses:');
    sampleExpenses.rows.forEach(e => {
      console.log(`   - ${e.expense_date} | ${e.category} | ${e.description} | ₹${e.amount}`);
    });

    // Check Mortality Data (from purchases)
    console.log('\n\n☠️  MORTALITY DATA:');
    const mortality = await client.query(`
      SELECT 
        COUNT(*) as orders_with_mortality,
        SUM(CAST(mortality_deduction AS NUMERIC)) as total_mortality_deduction
      FROM purchase_orders
      WHERE mortality_deduction > 0
    `);
    console.log('   Orders with Mortality:', mortality.rows[0].orders_with_mortality);
    console.log('   Total Mortality Deduction: ₹', mortality.rows[0].total_mortality_deduction);

    // Calculate Profit/Loss
    console.log('\n\n📊 PROFIT/LOSS CALCULATION:');
    const totalRevenue = parseFloat(sales.rows[0].total_net_amount || 0);
    const totalCost = parseFloat(purchases.rows[0].total_net_amount || 0);
    const totalExpenses = parseFloat(expenses.rows[0].total_amount || 0);
    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalExpenses;

    console.log('   Total Revenue (Sales): ₹', totalRevenue.toFixed(2));
    console.log('   Total Cost (Purchases): ₹', totalCost.toFixed(2));
    console.log('   Gross Profit: ₹', grossProfit.toFixed(2));
    console.log('   Total Expenses: ₹', totalExpenses.toFixed(2));
    console.log('   Net Profit: ₹', netProfit.toFixed(2));
    console.log('   Profit Margin:', ((netProfit / totalRevenue) * 100).toFixed(2) + '%');

    console.log('\n' + '='.repeat(70));
    console.log('✅ DATA CHECK COMPLETE');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkReportsData();

