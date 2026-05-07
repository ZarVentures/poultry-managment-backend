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

async function addGodownSalePaymentsTable() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if table already exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'godown_sale_payments'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log('ℹ️  Table godown_sale_payments already exists, skipping creation');
      return;
    }

    // Create godown_sale_payments table
    await client.query(`
      CREATE TABLE godown_sale_payments (
        id BIGSERIAL PRIMARY KEY,
        godown_sale_id BIGINT NOT NULL,
        payment_mode VARCHAR(30) NOT NULL,
        amount NUMERIC(14, 2) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT fk_godown_sale 
          FOREIGN KEY (godown_sale_id) 
          REFERENCES godown_sales(id) 
          ON DELETE CASCADE
      );
    `);
    console.log('✅ Created godown_sale_payments table');

    // Create index for faster lookups
    await client.query(`
      CREATE INDEX idx_godown_sale_payments_godown_sale_id 
      ON godown_sale_payments(godown_sale_id);
    `);
    console.log('✅ Created index on godown_sale_id');

    // Migrate existing payment_mode data to payments table
    const existingSales = await client.query(`
      SELECT id, payment_mode, amount_received 
      FROM godown_sales 
      WHERE payment_mode IS NOT NULL 
        AND amount_received > 0
    `);

    if (existingSales.rows.length > 0) {
      console.log(`\n📦 Migrating ${existingSales.rows.length} existing payments...`);
      
      for (const sale of existingSales.rows) {
        await client.query(`
          INSERT INTO godown_sale_payments (godown_sale_id, payment_mode, amount)
          VALUES ($1, $2, $3)
        `, [sale.id, sale.payment_mode, sale.amount_received]);
      }
      
      console.log('✅ Migrated existing payment data');
    } else {
      console.log('ℹ️  No existing payments to migrate');
    }

    console.log('\n✅ Migration complete!');
    console.log('\n📋 Summary:');
    console.log('  - Created godown_sale_payments table');
    console.log('  - Added foreign key constraint');
    console.log('  - Created index for performance');
    console.log(`  - Migrated ${existingSales.rows.length} existing payments`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

addGodownSalePaymentsTable()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  });
