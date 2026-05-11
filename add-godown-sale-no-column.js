const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USERNAME || 'poultry_user',
  password: process.env.DB_PASSWORD || 'poultry_user1212',
  database: process.env.DB_NAME || 'poultry_stage',
});

async function addSaleNoColumn() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Add sale_no column to godown_sales table
    await client.query(`
      ALTER TABLE godown_sales 
      ADD COLUMN IF NOT EXISTS sale_no VARCHAR(50);
    `);
    console.log('✓ Added sale_no column to godown_sales table');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

addSaleNoColumn();
