require('dotenv').config();
const { Client } = require('pg');

async function createMissingTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Create mortality_records table
    console.log('📋 Creating mortality_records table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS mortality_records (
        id BIGSERIAL PRIMARY KEY,
        record_number VARCHAR(50) UNIQUE NOT NULL,
        purchase_invoice_no VARCHAR(50),
        purchase_order_id BIGINT REFERENCES purchase_orders(id) ON DELETE SET NULL,
        vehicle_id BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
        mortality_date DATE NOT NULL,
        number_of_birds_died INTEGER NOT NULL,
        reason TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ mortality_records table created\n');

    // Create product_type_enum
    console.log('📋 Creating product_type_enum...');
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE product_type_enum AS ENUM ('eggs', 'meat', 'chicks', 'feed', 'medicine', 'equipment', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✅ product_type_enum created\n');

    // Create product_status_enum
    console.log('📋 Creating product_status_enum...');
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE product_status_enum AS ENUM ('active', 'inactive');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✅ product_status_enum created\n');

    // Create products table
    console.log('📋 Creating products table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        category VARCHAR(50),
        product_type product_type_enum,
        unit VARCHAR(20),
        price NUMERIC(14,2),
        description TEXT,
        status product_status_enum DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(name)
      );
    `);
    // Create failed_accounting_jobs table
    console.log('📋 Creating failed_accounting_jobs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS failed_accounting_jobs (
        id BIGSERIAL PRIMARY KEY,
        payload TEXT NOT NULL,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ failed_accounting_jobs table created\n');

    // Create indexes
    console.log('📋 Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mortality_records_date ON mortality_records(mortality_date);
      CREATE INDEX IF NOT EXISTS idx_mortality_records_purchase ON mortality_records(purchase_order_id);
      CREATE INDEX IF NOT EXISTS idx_mortality_records_vehicle ON mortality_records(vehicle_id);
      CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
      CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);
      CREATE INDEX IF NOT EXISTS idx_failed_accounting_jobs_status ON failed_accounting_jobs(status);
    `);
    console.log('✅ Indexes created\n');

    console.log('🎉 All tables created successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

createMissingTables();

