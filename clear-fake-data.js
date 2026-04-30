const { Client } = require('pg');
require('dotenv').config();

async function clearFakeData() {
  console.log('🗑️  CLEARING FAKE DATA (KEEPING USERS TABLE)');
  console.log('='.repeat(70));
  console.log('⚠️  WARNING: This will delete ALL data except users!');
  console.log('='.repeat(70));

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Database connected\n');

    // Tables to clear (in order to respect foreign key constraints)
    const tablesToClear = [
      // Clear child tables first (those with foreign keys)
      { name: 'purchase_order_items', description: 'Purchase Order Items' },
      { name: 'purchase_order_cages', description: 'Purchase Order Cages' },
      { name: 'mortalities', description: 'Mortality Records' },
      { name: 'godown_sales', description: 'Godown Sales' },
      { name: 'godown_mortality', description: 'Godown Mortality' },
      { name: 'godown_expenses', description: 'Godown Expenses' },
      { name: 'godown_inward', description: 'Godown Inward' },
      
      // Then parent tables
      { name: 'sales', description: 'Sales' },
      { name: 'expenses', description: 'Expenses' },
      { name: 'purchase_orders', description: 'Purchase Orders' },
      { name: 'inventory', description: 'Inventory Items' },
      { name: 'vehicles', description: 'Vehicles' },
      { name: 'retailers', description: 'Retailers' },
      { name: 'farmers', description: 'Farmers' },
      { name: 'settings', description: 'Settings' },
    ];

    console.log('Starting data deletion...\n');

    let totalDeleted = 0;

    for (const table of tablesToClear) {
      try {
        // Count records before deletion
        const countResult = await client.query(`SELECT COUNT(*) FROM ${table.name}`);
        const count = parseInt(countResult.rows[0].count);

        if (count > 0) {
          // Delete all records
          await client.query(`DELETE FROM ${table.name}`);
          console.log(`✅ ${table.description.padEnd(30)} - ${count} records deleted`);
          totalDeleted += count;
        } else {
          console.log(`⚪ ${table.description.padEnd(30)} - Already empty`);
        }
      } catch (error) {
        console.log(`⚠️  ${table.description.padEnd(30)} - Error: ${error.message}`);
      }
    }

    // Check users table (should NOT be deleted)
    const usersResult = await client.query(`SELECT COUNT(*) FROM users`);
    const usersCount = parseInt(usersResult.rows[0].count);

    console.log('\n' + '='.repeat(70));
    console.log('✅ DATA CLEARING COMPLETE');
    console.log(`📊 Total Records Deleted: ${totalDeleted}`);
    console.log(`👤 Users Remaining: ${usersCount} (NOT deleted)`);
    console.log('='.repeat(70));
    console.log('\n✅ Database is now clean and ready for client data!');
    console.log('🔐 You can still login with: admin@azizpoultry.com / admin123');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

clearFakeData();

