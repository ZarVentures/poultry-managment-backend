const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function createGodownSalePaymentsTable() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Create godown_sale_payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS godown_sale_payments (
        id BIGSERIAL PRIMARY KEY,
        godown_sale_id BIGINT NOT NULL REFERENCES godown_sales(id) ON DELETE CASCADE,
        payment_mode VARCHAR(50) NOT NULL,
        amount NUMERIC(14, 2) NOT NULL,
        is_advance BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT fk_godown_sale FOREIGN KEY (godown_sale_id) REFERENCES godown_sales(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Created godown_sale_payments table');

    // Create index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_godown_sale_payments_godown_sale_id 
      ON godown_sale_payments(godown_sale_id);
    `);
    console.log('✅ Created index on godown_sale_id');

    // Migrate existing payment_mode data to payments table
    const existingSales = await client.query(`
      SELECT id, payment_mode, amount_received 
      FROM godown_sales 
      WHERE payment_mode IS NOT NULL AND amount_received > 0
    `);

    if (existingSales.rows.length > 0) {
      console.log(`\nMigrating ${existingSales.rows.length} existing payments...`);
      
      for (const sale of existingSales.rows) {
        await client.query(`
          INSERT INTO godown_sale_payments (godown_sale_id, payment_mode, amount, is_advance)
          VALUES ($1, $2, $3, false)
        `, [sale.id, sale.payment_mode, sale.amount_received]);
      }
      
      console.log('✅ Migrated existing payment data');
    }

    console.log('\n✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Update godown.service.ts to use payments table');
    console.log('2. Update frontend to show payment breakdown');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

createGodownSalePaymentsTable();
