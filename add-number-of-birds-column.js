const { Client } = require('pg');
require('dotenv').config();

async function addNumberOfBirdsColumn() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();

  try {
    console.log('🔍 Checking if number_of_birds column exists in sales table...');
    
    const result = await client.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'sales' AND column_name = 'number_of_birds'`
    );

    if (result.rows.length > 0) {
      console.log('✅ Column number_of_birds already exists in sales table');
    } else {
      console.log('➕ Adding number_of_birds column to sales table...');
      await client.query(`
        ALTER TABLE sales 
        ADD COLUMN number_of_birds INTEGER DEFAULT 0
      `);
      console.log('✅ Successfully added number_of_birds column to sales table');
    }

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

addNumberOfBirdsColumn()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
