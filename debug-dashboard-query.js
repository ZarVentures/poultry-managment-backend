require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

client.connect().then(async () => {
  const startDate = '2026-05-01';
  const endDate = '2026-05-04';

  console.log(`\nQuerying sales from ${startDate} to ${endDate}\n`);

  // Exact query TypeORM generates
  const r1 = await client.query(
    'SELECT COUNT(*) as cnt, COALESCE(SUM(net_amount), 0) as total FROM sales WHERE sale_date >= $1 AND sale_date <= $2',
    [startDate, endDate]
  );
  console.log('Simple date range:', r1.rows[0]);

  // Check what dates exist in May
  const r2 = await client.query(
    'SELECT sale_date::text, COUNT(*) as cnt, SUM(net_amount) as total FROM sales WHERE sale_date >= $1 AND sale_date <= $2 GROUP BY sale_date ORDER BY sale_date',
    ['2026-05-01', '2026-05-31']
  );
  console.log('\nAll May sales by date:');
  r2.rows.forEach(r => console.log(`  ${r.sale_date}: ${r.cnt} sales, ₹${Number(r.total).toFixed(2)}`));

  // Total May
  const r3 = await client.query(
    'SELECT COUNT(*) as cnt, SUM(net_amount) as total FROM sales WHERE sale_date >= $1 AND sale_date <= $2',
    ['2026-05-01', '2026-05-31']
  );
  console.log('\nTotal May:', r3.rows[0]);

  await client.end();
});
