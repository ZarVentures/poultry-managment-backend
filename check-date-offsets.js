require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

client.connect().then(async () => {
  console.log('\n=== Checking date offsets across all tables ===\n');

  const tables = [
    { table: 'sales', col: 'sale_date' },
    { table: 'purchase_orders', col: 'order_date' },
    { table: 'expenses', col: 'expense_date' },
    { table: 'mortalities', col: 'mortality_date' },
    { table: 'godown_inward_entries', col: 'entry_date' },
    { table: 'godown_sales', col: 'sale_date' },
    { table: 'godown_mortality', col: 'mortality_date' },
    { table: 'godown_expenses', col: 'expense_date' },
  ];

  for (const { table, col } of tables) {
    try {
      const r = await client.query(
        `SELECT ${col}, ${col}::text as raw FROM ${table} ORDER BY ${col} DESC LIMIT 2`
      );
      if (r.rows.length > 0) {
        console.log(`${table}.${col}:`);
        r.rows.forEach(row => console.log(`  stored: ${row.raw}  |  JS: ${row[col]}`));
      }
    } catch (e) {
      console.log(`${table}.${col}: ERROR - ${e.message}`);
    }
  }

  // Check if dates are off by 1 day
  console.log('\n=== Sample sales dates (raw vs expected) ===');
  const s = await client.query(
    `SELECT id, sale_date::text as raw_date FROM sales WHERE sale_date >= '2026-05-01' ORDER BY sale_date LIMIT 5`
  );
  console.log('Sales with sale_date >= 2026-05-01:', s.rows);

  const s2 = await client.query(
    `SELECT id, sale_date::text as raw_date FROM sales WHERE sale_date >= '2026-04-30' AND sale_date < '2026-05-01' ORDER BY sale_date LIMIT 5`
  );
  console.log('Sales with sale_date = 2026-04-30:', s2.rows);

  await client.end();
});
