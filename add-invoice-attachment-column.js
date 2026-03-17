const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE purchase_orders
      ADD COLUMN IF NOT EXISTS invoice_attachment VARCHAR(500) NULL;
    `);
    console.log('✅ invoice_attachment column added to purchase_orders');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
