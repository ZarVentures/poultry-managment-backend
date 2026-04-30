/**
 * Migration: add is_advance column to purchase_order_payments
 * Run: node add-payment-is-advance-column.js
 */
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log('Connected to database');

  // Check if column already exists
  const check = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'purchase_order_payments' AND column_name = 'is_advance'
  `);

  if (check.rows.length > 0) {
    console.log('Column is_advance already exists — skipping');
  } else {
    await client.query(`
      ALTER TABLE purchase_order_payments
      ADD COLUMN is_advance BOOLEAN NOT NULL DEFAULT FALSE
    `);
    console.log('✅ Added is_advance column to purchase_order_payments');
  }

  await client.end();
  console.log('Done');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
