const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();

  console.log('\n=== SALES TABLE: number_of_birds column ===\n');
  const res = await client.query(`
    SELECT id, invoice_number, sale_date, customer_name, quantity, number_of_birds
    FROM sales
    ORDER BY created_at DESC
    LIMIT 10
  `);

  console.table(res.rows);

  console.log('\n=== SUMMARY ===');
  const summary = await client.query(`
    SELECT 
      COUNT(*) as total_sales,
      SUM(CASE WHEN number_of_birds IS NULL THEN 1 ELSE 0 END) as null_count,
      SUM(CASE WHEN number_of_birds = 0 THEN 1 ELSE 0 END) as zero_count,
      SUM(CASE WHEN number_of_birds > 0 THEN 1 ELSE 0 END) as has_value_count,
      SUM(number_of_birds) as total_birds
    FROM sales
  `);
  console.table(summary.rows);

  await client.end();
}

main().catch(console.error);
