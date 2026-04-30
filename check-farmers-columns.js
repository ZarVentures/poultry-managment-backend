const { Client } = require('pg');
require('dotenv').config();

async function checkColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const farmers = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'farmers' 
      ORDER BY ordinal_position
    `);
    console.log('Farmers columns:', farmers.rows);
    
    const retailers = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'retailers' 
      ORDER BY ordinal_position
    `);
    console.log('\nRetailers columns:', retailers.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkColumns();

