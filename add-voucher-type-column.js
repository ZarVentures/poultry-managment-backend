/**
 * add-voucher-type-column.js
 *
 * Adds voucherType column to payment_vouchers table to properly track
 * whether a voucher is an IN (money received) or OUT (money paid) voucher.
 * This fixes the ledger posting issue where vouchers were being posted
 * based on payeeType instead of the actual voucher direction.
 *
 * Run: node add-voucher-type-column.js
 */

require('dotenv').config();
const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL;

async function run() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Add voucher_type column if it doesn't exist
    await client.query(`
      ALTER TABLE payment_vouchers
      ADD COLUMN IF NOT EXISTS voucher_type VARCHAR(10) DEFAULT 'out';
    `);
    console.log('✅ voucherType column added (or already exists)');

    // Display table structure
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'payment_vouchers'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Payment Vouchers Table Structure:');
    result.rows.forEach((row) => {
      console.log(
        `   - ${row.column_name}: ${row.data_type}${row.is_nullable === 'NO' ? ' NOT NULL' : ''}${
          row.column_default ? ` DEFAULT ${row.column_default}` : ''
        }`
      );
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart the backend server to load the updated entity');
    console.log('   2. Test creating a new IN voucher to verify it posts as CREDIT');
    console.log('   3. Test creating a new OUT voucher to verify it posts as DEBIT');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
