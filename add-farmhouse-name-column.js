const { Client } = require('pg');
require('dotenv').config();

async function addFarmhouseNameColumn() {
  console.log('🔧 ADDING FARMHOUSE_NAME COLUMN TO FARMERS TABLE');
  console.log('='.repeat(70));

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Database connected\n');

    // Check if column already exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'farmers' AND column_name = 'farmhouse_name'
    `);

    if (checkResult.rows.length > 0) {
      console.log('⚠️  Column farmhouse_name already exists');
      return;
    }

    // Add the column
    await client.query(`
      ALTER TABLE farmers 
      ADD COLUMN farmhouse_name VARCHAR(150)
    `);

    console.log('✅ Column farmhouse_name added successfully');

    // Verify the column was added
    const verifyResult = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'farmers' AND column_name = 'farmhouse_name'
    `);

    if (verifyResult.rows.length > 0) {
      const col = verifyResult.rows[0];
      console.log(`\n📋 Column details:`);
      console.log(`   Name: ${col.column_name}`);
      console.log(`   Type: ${col.data_type}`);
      console.log(`   Max Length: ${col.character_maximum_length}`);
    }

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

addFarmhouseNameColumn();

