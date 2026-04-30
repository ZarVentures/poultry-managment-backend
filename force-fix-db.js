const { Client } = require('pg');
require('dotenv').config();

async function forceFix() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // First, change the sales column to use the correct type
    console.log('1. Altering sales.payment_status column to use payment_status_type...');
    await client.query(`
      ALTER TABLE sales 
      ALTER COLUMN payment_status TYPE payment_status_type 
      USING payment_status::text::payment_status_type
    `);
    console.log('✓ Sales table updated');

    // Do the same for godown_sales if it exists
    console.log('2. Altering godown_sales.payment_status column...');
    await client.query(`
      ALTER TABLE godown_sales 
      ALTER COLUMN payment_status TYPE payment_status_type 
      USING payment_status::text::payment_status_type
    `);
    console.log('✓ Godown_sales table updated');

    // Now drop the old type
    console.log('3. Dropping payment_status_type_old...');
    await client.query('DROP TYPE IF EXISTS payment_status_type_old CASCADE');
    console.log('✓ Old type dropped');

    // Verify
    const types = await client.query(`
      SELECT typname FROM pg_type 
      WHERE typname LIKE '%payment_status%'
    `);
    console.log('\n✓ Remaining types:', types.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Detail:', error.detail);
  } finally {
    await client.end();
  }
}

forceFix();

