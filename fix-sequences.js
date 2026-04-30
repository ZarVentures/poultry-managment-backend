const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fixSequences() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Fix all table sequences
    const tables = [
      'users',
      'farmers',
      'retailers',
      'vehicles',
      'purchase_orders',
      'purchase_order_items',
      'sales',
      'expenses',
      'inventory_items',
      'settings',
      'audit_logs',
      'godown_inward_entries',
      'godown_mortality',
      'godown_expenses',
      'godown_sales'
    ];

    for (const table of tables) {
      try {
        // Get the maximum ID from the table
        const maxIdResult = await client.query(`SELECT MAX(id) as max_id FROM ${table}`);
        const maxId = maxIdResult.rows[0].max_id;

        if (maxId) {
          // Get the sequence name
          const sequenceResult = await client.query(`
            SELECT pg_get_serial_sequence('${table}', 'id') as sequence_name
          `);
          const sequenceName = sequenceResult.rows[0].sequence_name;

          if (sequenceName) {
            // Set the sequence to max_id + 1
            await client.query(`SELECT setval('${sequenceName}', ${maxId}, true)`);
            console.log(`✓ Fixed sequence for ${table}: set to ${maxId}`);
          } else {
            console.log(`⚠ No sequence found for ${table}`);
          }
        } else {
          console.log(`⚠ No data in ${table}, skipping`);
        }
      } catch (err) {
        console.log(`✗ Error fixing ${table}:`, err.message);
      }
    }

    console.log('\n✓ All sequences fixed!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

fixSequences();

