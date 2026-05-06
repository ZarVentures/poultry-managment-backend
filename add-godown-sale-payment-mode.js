const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('amazonaws.com') ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  await client.connect();
  console.log('Connected to DB');

  try {
    // Add payment_mode column to godown_sales
    await client.query(`
      ALTER TABLE godown_sales
      ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) NULL;
    `);
    console.log('✅ Added payment_mode column to godown_sales');

    // Verify
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'godown_sales' AND column_name = 'payment_mode';
    `);
    console.log('Column info:', result.rows);
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    await client.end();
  }
}

migrate();
