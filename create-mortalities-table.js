const { Client } = require('pg');
require('dotenv').config();

async function createMortalitiesTable() {
  console.log('🔧 CREATING MORTALITIES TABLE');
  console.log('='.repeat(70));

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Database connected\n');

    // Create mortalities table
    await client.query(`
      CREATE TABLE IF NOT EXISTS mortalities (
        id BIGSERIAL PRIMARY KEY,
        record_number VARCHAR(50) UNIQUE NOT NULL,
        purchase_order_id BIGINT REFERENCES purchase_orders(id) ON DELETE SET NULL,
        purchase_invoice_no VARCHAR(50) NOT NULL,
        purchase_date DATE NOT NULL,
        farmer_name VARCHAR(150) NOT NULL,
        farm_location TEXT,
        cage_id_number VARCHAR(50),
        total_birds_purchased INTEGER DEFAULT 0,
        number_of_birds_died INTEGER NOT NULL,
        cause TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log('✅ Mortalities table created successfully');

    // Check if table exists
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'mortalities'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Table structure:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('✅ MIGRATION COMPLETE');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

createMortalitiesTable();

