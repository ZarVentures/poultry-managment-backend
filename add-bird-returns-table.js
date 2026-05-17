const { Client } = require('pg');
require('dotenv').config();

async function addBirdReturnsTable() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Create enum types
    console.log('Creating enum types...');
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE return_reason_type AS ENUM ('dead', 'sick', 'underweight', 'quality_issue', 'customer_request', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE return_status_type AS ENUM ('pending', 'approved', 'rejected', 'processed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✅ Enum types created');

    // Create bird_returns table
    console.log('Creating bird_returns table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS bird_returns (
        id BIGSERIAL PRIMARY KEY,
        return_number VARCHAR(50) UNIQUE NOT NULL,
        return_date DATE NOT NULL,
        sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        customer_name VARCHAR(150) NOT NULL,
        retailer_id BIGINT REFERENCES retailers(id) ON DELETE SET NULL,
        number_of_birds_returned INTEGER NOT NULL,
        weight_returned NUMERIC(10, 2),
        return_reason return_reason_type NOT NULL,
        reason_description TEXT,
        refund_amount NUMERIC(14, 2) DEFAULT 0,
        adjustment_amount NUMERIC(14, 2) DEFAULT 0,
        status return_status_type DEFAULT 'pending',
        returned_to_inventory BOOLEAN DEFAULT false,
        inventory_location VARCHAR(100),
        approved_by VARCHAR(150),
        approved_at TIMESTAMPTZ,
        processed_by VARCHAR(150),
        processed_at TIMESTAMPTZ,
        notes TEXT,
        attachment_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ bird_returns table created');

    // Create indexes
    console.log('Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bird_returns_sale_id ON bird_returns(sale_id);
      CREATE INDEX IF NOT EXISTS idx_bird_returns_retailer_id ON bird_returns(retailer_id);
      CREATE INDEX IF NOT EXISTS idx_bird_returns_return_date ON bird_returns(return_date);
      CREATE INDEX IF NOT EXISTS idx_bird_returns_status ON bird_returns(status);
      CREATE INDEX IF NOT EXISTS idx_bird_returns_return_number ON bird_returns(return_number);
    `);
    console.log('✅ Indexes created');

    console.log('\n✅ Migration completed successfully!');
    console.log('\nBird Returns table is ready to use.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

addBirdReturnsTable();
