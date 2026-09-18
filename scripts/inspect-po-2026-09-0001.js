require('dotenv').config();
require('dotenv').config({ path: '.env.example' });
const { Client } = require('pg');

const client = new Client(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'poultry',
      },
);

async function main() {
  await client.connect();
  const po = await client.query(
    `SELECT id, order_number, order_date, total_weight, rate_per_kg, net_amount, tenant_id
     FROM purchase_orders WHERE order_number = 'PO-2026-09-0001'`,
  );
  console.log('PO', JSON.stringify(po.rows, null, 2));
  const tid = po.rows[0]?.tenant_id;
  const inw = await client.query(
    `SELECT inward_no, entry_date, number_of_birds, total_weight, actual_weight, average_weight,
            rate_per_kg, total_amount, purchase_invoice_no, tenant_id
     FROM godown_inward_entries
     WHERE inward_no ILIKE '%2026-09-0001%' OR purchase_invoice_no = 'PO-2026-09-0001'`,
  );
  console.log('INWARD', JSON.stringify(inw.rows, null, 2));
  const gs = await client.query(
    `SELECT sale_no, invoice_number, sale_date, number_of_birds, total_weight, average_weight,
            rate_per_kg, total_amount, tenant_id
     FROM godown_sales
     WHERE ($1::bigint IS NOT NULL AND tenant_id = $1) OR sale_date = '2026-09-18'
     ORDER BY id DESC LIMIT 15`,
    [tid || null],
  );
  console.log('GDS', JSON.stringify(gs.rows, null, 2));
  const vs = await client.query(
    `SELECT invoice_number, sale_date, sale_mode, number_of_birds, quantity, unit_price, net_amount, tenant_id
     FROM sales
     WHERE ($1::bigint IS NOT NULL AND tenant_id = $1) OR sale_date = '2026-09-18'
     ORDER BY id DESC LIMIT 15`,
    [tid || null],
  );
  console.log('SALES', JSON.stringify(vs.rows, null, 2));
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
