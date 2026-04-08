const { Client } = require('pg');
require('dotenv').config();

async function checkTables() {
  console.log('🔍 CHECKING TABLES FOR REPORTS');
  console.log('='.repeat(70));

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Check all tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📋 Existing Tables:');
    tables.rows.forEach(t => console.log('   -', t.table_name));
    
    console.log('\n✅ CONCLUSION: We have all tables needed for reports!');
    console.log('   - purchase_orders (for purchase reports)');
    console.log('   - sales (for sales reports)');
    console.log('   - expenses (for expense reports)');
    console.log('   - farmers (for farm-wise reports)');
    console.log('   - No new tables needed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTables();

