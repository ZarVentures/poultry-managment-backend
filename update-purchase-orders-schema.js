const { Client } = require('pg');
require('dotenv').config();

async function updatePurchaseOrdersSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Add new columns to purchase_orders table
    console.log('\n1. Adding new columns to purchase_orders table...');
    
    const alterTableSQL = `
      -- Farmer integration
      ALTER TABLE purchase_orders 
      ADD COLUMN IF NOT EXISTS farmer_id BIGINT REFERENCES farmers(id),
      ADD COLUMN IF NOT EXISTS farmer_mobile VARCHAR(20),
      ADD COLUMN IF NOT EXISTS farm_location TEXT,
      
      -- Vehicle integration
      ADD COLUMN IF NOT EXISTS vehicle_id BIGINT REFERENCES vehicles(id),
      
      -- Bird details
      ADD COLUMN IF NOT EXISTS bird_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS total_weight NUMERIC(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rate_per_kg NUMERIC(10, 2) DEFAULT 0,
      
      -- Payment tracking
      ADD COLUMN IF NOT EXISTS purchase_payment_status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS advance_paid NUMERIC(14, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS outstanding_payment NUMERIC(14, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50),
      ADD COLUMN IF NOT EXISTS total_payment_made NUMERIC(14, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(14, 2) DEFAULT 0;
    `;
    
    await client.query(alterTableSQL);
    console.log('✓ New columns added successfully');

    // Create purchase_order_cages table
    console.log('\n2. Creating purchase_order_cages table...');
    
    const createCagesTableSQL = `
      CREATE TABLE IF NOT EXISTS purchase_order_cages (
        id BIGSERIAL PRIMARY KEY,
        purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        cage_id VARCHAR(50),
        bird_type VARCHAR(50),
        number_of_birds INTEGER NOT NULL,
        cage_weight NUMERIC(10, 2) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    await client.query(createCagesTableSQL);
    console.log('✓ purchase_order_cages table created successfully');

    // Create index for better performance
    console.log('\n3. Creating indexes...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_purchase_order_cages_order_id 
      ON purchase_order_cages(purchase_order_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_purchase_orders_farmer_id 
      ON purchase_orders(farmer_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_purchase_orders_vehicle_id 
      ON purchase_orders(vehicle_id);
    `);
    
    console.log('✓ Indexes created successfully');

    // Verify the changes
    console.log('\n4. Verifying schema changes...');
    
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'purchase_orders'
      AND column_name IN (
        'farmer_id', 'farmer_mobile', 'farm_location', 'vehicle_id',
        'bird_type', 'total_weight', 'rate_per_kg',
        'purchase_payment_status', 'advance_paid', 'outstanding_payment',
        'payment_mode', 'total_payment_made', 'balance_amount'
      )
      ORDER BY column_name;
    `);
    
    console.log('\nNew columns in purchase_orders:');
    columnsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    const cagesTableResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'purchase_order_cages'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nColumns in purchase_order_cages:');
    cagesTableResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    console.log('\n✅ Purchase orders schema update completed successfully!');

  } catch (error) {
    console.error('❌ Error updating schema:', error);
    throw error;
  } finally {
    await client.end();
  }
}

updatePurchaseOrdersSchema();

