const { Client } = require('pg');
require('dotenv').config();

async function checkFarmers() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT id, name, phone, email, address, status, created_at 
      FROM farmers 
      ORDER BY created_at DESC
    `);
    
    console.log('👨‍🌾 FARMERS IN DATABASE:');
    console.log('='.repeat(70));
    
    if (result.rows.length === 0) {
      console.log('No farmers found');
    } else {
      result.rows.forEach((farmer, index) => {
        console.log(`\n${index + 1}. ${farmer.name}`);
        console.log(`   ID: ${farmer.id}`);
        console.log(`   Phone: ${farmer.phone || 'N/A'}`);
        console.log(`   Email: ${farmer.email || 'N/A'}`);
        console.log(`   Address: ${farmer.address || 'N/A'}`);
        console.log(`   Status: ${farmer.status}`);
        console.log(`   Created: ${farmer.created_at}`);
      });
    }
    
    console.log('\n' + '='.repeat(70));
    console.log(`✅ Total: ${result.rows.length} farmers in database`);
    console.log('✅ These are stored in PostgreSQL, NOT localStorage!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkFarmers();

