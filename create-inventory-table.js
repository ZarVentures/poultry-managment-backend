const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createInventoryTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Creating inventory_items table...\n');

    // Create the inventory_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id BIGSERIAL PRIMARY KEY,
        item_type VARCHAR(50) NOT NULL,
        item_name VARCHAR(150) NOT NULL,
        quantity DECIMAL(14, 2) DEFAULT 0 NOT NULL,
        unit VARCHAR(20) NOT NULL,
        minimum_stock_level DECIMAL(14, 2) DEFAULT 0 NOT NULL,
        current_stock_level DECIMAL(10, 2) DEFAULT 0 NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    console.log('✅ inventory_items table created successfully!');

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_item_type ON inventory_items(item_type);
      CREATE INDEX IF NOT EXISTS idx_inventory_item_name ON inventory_items(item_name);
      CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory_items(current_stock_level, minimum_stock_level);
    `);

    console.log('✅ Indexes created successfully!');

    // Insert some sample data
    await client.query(`
      INSERT INTO inventory_items (item_type, item_name, quantity, unit, minimum_stock_level, current_stock_level, notes)
      VALUES 
        ('Feed', 'Chicken Feed - Starter', 500, 'kg', 100, 500, 'For chicks 0-4 weeks'),
        ('Feed', 'Chicken Feed - Grower', 750, 'kg', 150, 750, 'For chickens 5-12 weeks'),
        ('Feed', 'Chicken Feed - Layer', 1000, 'kg', 200, 1000, 'For laying hens'),
        ('Medicine', 'Antibiotics - Amoxicillin', 50, 'bottles', 10, 50, 'For bacterial infections'),
        ('Medicine', 'Vitamins - Multivitamin', 100, 'bottles', 20, 100, 'Daily supplement'),
        ('Equipment', 'Feeders - Automatic', 20, 'pcs', 5, 20, 'Automatic feeding system'),
        ('Equipment', 'Drinkers - Nipple Type', 30, 'pcs', 10, 30, 'Water dispensers'),
        ('Supplies', 'Disinfectant', 25, 'liters', 5, 25, 'For cleaning and sanitization')
      ON CONFLICT DO NOTHING;
    `);

    console.log('✅ Sample inventory data inserted!');

    // Verify the table
    const result = await client.query(`
      SELECT COUNT(*) as count FROM inventory_items;
    `);

    console.log(`\n📊 Total inventory items: ${result.rows[0].count}`);

    // Show sample data
    const sampleData = await client.query(`
      SELECT item_type, item_name, current_stock_level, unit, minimum_stock_level
      FROM inventory_items
      ORDER BY item_type, item_name
      LIMIT 10;
    `);

    console.log('\n📦 Sample Inventory Items:');
    console.log('─'.repeat(80));
    sampleData.rows.forEach(row => {
      const status = row.current_stock_level <= row.minimum_stock_level ? '⚠️ LOW' : '✅ OK';
      console.log(`${status} ${row.item_type.padEnd(15)} | ${row.item_name.padEnd(30)} | ${row.current_stock_level} ${row.unit} (Min: ${row.minimum_stock_level})`);
    });

    console.log('\n✅ Inventory table setup complete!');

  } catch (error) {
    console.error('❌ Error creating inventory table:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createInventoryTable();

