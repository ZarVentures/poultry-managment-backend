/**
 * check-payment-vouchers.js
 * 
 * Checks the state of payment_vouchers table and its voucherType field.
 * 
 * Run: node check-payment-vouchers.js
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
    console.log('✅ Connected to database\n');

    // Check table structure
    console.log('📋 Payment Vouchers Table Structure:');
    const tableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'payment_vouchers'
      ORDER BY ordinal_position;
    `);
    
    tableInfo.rows.forEach((row) => {
      console.log(`   - ${row.column_name}: ${row.data_type}${row.is_nullable === 'NO' ? ' NOT NULL' : ''}${row.column_default ? ` DEFAULT ${row.column_default}` : ''}`);
    });

    // Check vouchers without voucherType
    console.log('\n🔍 Checking for NULL voucherType values:');
    const nullResult = await client.query(`
      SELECT COUNT(*) as count FROM payment_vouchers WHERE voucher_type IS NULL;
    `);
    console.log(`   Found ${nullResult.rows[0].count} vouchers with NULL voucher_type`);

    // Show sample records
    console.log('\n📊 Sample Records:');
    const sampleResult = await client.query(`
      SELECT id, voucher_number, voucher_type, payee_type, status 
      FROM payment_vouchers 
      LIMIT 5;
    `);
    
    sampleResult.rows.forEach((row) => {
      console.log(`   ID ${row.id}: ${row.voucher_number} | Type: ${row.voucher_type || 'NULL'} | Payee: ${row.payee_type} | Status: ${row.status}`);
    });

    // Count total
    const countResult = await client.query('SELECT COUNT(*) as count FROM payment_vouchers');
    console.log(`\n📈 Total payment vouchers: ${countResult.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
