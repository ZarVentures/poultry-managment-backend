require('dotenv').config();
const { Client } = require('pg');

async function checkSchema() {
  const databaseUrl = process.env.DATABASE_URL;
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }, // AWS RDS requires SSL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    const tables = ['godown_inward_entries', 'godown_sales', 'godown_mortality', 'godown_expenses'];
    
    for (const table of tables) {
      console.log(`\n📋 ${table}:`);
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = '${table}'
        ORDER BY ordinal_position;
      `);
      
      result.rows.forEach(row => {
        console.log(`   ${row.column_name} (${row.data_type}) ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSchema();
