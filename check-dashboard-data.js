require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  const now = new Date();
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

  console.log(`\n=== Dashboard Data Check (${firstDay} to ${lastDay}) ===\n`);

  // Total Sales this month
  const sales = await client.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(net_amount), 0) as total FROM sales WHERE sale_date BETWEEN $1 AND $2`,
    [firstDay, lastDay]
  );
  console.log(`Total Sales (This Month): ₹${Number(sales.rows[0].total).toFixed(2)} | ${sales.rows[0].count} transactions`);

  // Total Purchases this month
  const purchases = await client.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(net_amount), 0) as total FROM purchase_orders WHERE order_date BETWEEN $1 AND $2`,
    [firstDay, lastDay]
  );
  console.log(`Total Purchases (This Month): ₹${Number(purchases.rows[0].total).toFixed(2)} | ${purchases.rows[0].count} orders`);

  // Total Expenses this month
  const expenses = await client.query(
    `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date BETWEEN $1 AND $2`,
    [firstDay, lastDay]
  );
  console.log(`Total Expenses (This Month): ₹${Number(expenses.rows[0].total).toFixed(2)} | ${expenses.rows[0].count} records`);

  // Net Profit
  const profit = Number(sales.rows[0].total) - Number(purchases.rows[0].total) - Number(expenses.rows[0].total);
  console.log(`Net Profit/Loss (This Month): ₹${profit.toFixed(2)}`);

  // Farmers
  const farmers = await client.query(`SELECT COUNT(*) as count FROM farmers`);
  console.log(`\nFarmers (Total): ${farmers.rows[0].count}`);

  // Retailers
  const retailers = await client.query(`SELECT COUNT(*) as count FROM retailers`);
  console.log(`Retailers (Total): ${retailers.rows[0].count}`);

  // Active Vehicles
  const vehicles = await client.query(`SELECT COUNT(*) as count FROM vehicles WHERE status = 'active'`);
  console.log(`Active Vehicles: ${vehicles.rows[0].count}`);

  // Birds Mortality
  const mortality = await client.query(`SELECT COALESCE(SUM(number_of_birds_died), 0) as total FROM mortalities`);
  console.log(`Birds Mortality (Total): ${mortality.rows[0].total}`);

  // All-time sales total
  const allSales = await client.query(`SELECT COUNT(*) as count, COALESCE(SUM(net_amount), 0) as total FROM sales`);
  console.log(`\nAll-Time Sales: ₹${Number(allSales.rows[0].total).toFixed(2)} | ${allSales.rows[0].count} records`);

  // All-time purchases total
  const allPurchases = await client.query(`SELECT COUNT(*) as count, COALESCE(SUM(net_amount), 0) as total FROM purchase_orders`);
  console.log(`All-Time Purchases: ₹${Number(allPurchases.rows[0].total).toFixed(2)} | ${allPurchases.rows[0].count} records`);

  await client.end();
}

run().catch(err => { console.error(err); process.exit(1); });
