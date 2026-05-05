require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

client.connect().then(async () => {
  // Test 1: AT TIME ZONE approach
  const r1 = await client.query(
    "SELECT COUNT(*) as cnt, SUM(net_amount) as total FROM sales WHERE (sale_date AT TIME ZONE 'Asia/Kolkata')::date >= $1 AND (sale_date AT TIME ZONE 'Asia/Kolkata')::date <= $2",
    ['2026-05-01', '2026-05-04']
  );
  console.log('AT TIME ZONE result:', r1.rows[0]);

  // Test 2: UTC offset range (IST = UTC+5:30, so May 1 IST = Apr 30 18:30 UTC)
  const r2 = await client.query(
    "SELECT COUNT(*) as cnt, SUM(net_amount) as total FROM sales WHERE sale_date >= $1 AND sale_date < $2",
    ['2026-04-30 18:30:00+00', '2026-05-05 18:30:00+00']
  );
  console.log('UTC offset range result:', r2.rows[0]);

  // Test 3: What does the sale_date column type actually look like?
  const r3 = await client.query(
    "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'sale_date'"
  );
  console.log('Column type:', r3.rows[0]);

  // Test 4: Sample raw values
  const r4 = await client.query("SELECT sale_date, sale_date::date as date_only FROM sales LIMIT 3");
  console.log('Sample sale_date values:', r4.rows);

  await client.end();
});
