const { Client } = require('pg');
require('dotenv').config();

async function fixPaymentStatusType() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check what types exist
    console.log('Checking existing types...');
    const types = await client.query(`
      SELECT typname FROM pg_type 
      WHERE typname LIKE '%payment_status%'
    `);
    console.log('Existing types:', types.rows);

    // Check what columns use these types
    console.log('\nChecking columns using payment_status types...');
    const columns = await client.query(`
      SELECT table_name, column_name, udt_name 
      FROM information_schema.columns 
      WHERE udt_name LIKE '%payment_status%'
    `);
    console.log('Columns:', columns.rows);

    // Drop the old type with CASCADE
    console.log('\nDropping old payment_status_type_old with CASCADE...');
    await client.query('DROP TYPE IF EXISTS payment_status_type_old CASCADE');
    
    console.log('✓ Successfully dropped old type');
    
    // Verify it's gone
    const typesAfter = await client.query(`
      SELECT typname FROM pg_type 
      WHERE typname LIKE '%payment_status%'
    `);
    console.log('\nRemaining types:', typesAfter.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

fixPaymentStatusType();

