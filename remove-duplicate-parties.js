/**
 * remove-duplicate-parties.js
 * 
 * Removes duplicate farmer and retailer entries from the database.
 * Keeps the first entry (lowest ID) and deletes subsequent duplicates.
 * 
 * Run: node remove-duplicate-parties.js
 */

require('dotenv').config();
const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL;

async function run() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Remove duplicate farmers (keep the one with the lowest ID)
    console.log('🔧 Removing duplicate FARMERS...');
    const farmerDeleteResult = await client.query(`
      DELETE FROM farmers
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY name, phone ORDER BY id) as rn
          FROM farmers
          WHERE status = 'active'
        ) t
        WHERE rn > 1
      );
    `);
    console.log(`✅ Deleted ${farmerDeleteResult.rowCount} duplicate farmer entries`);

    // Remove duplicate retailers (keep the one with the lowest ID)
    console.log('🔧 Removing duplicate RETAILERS...');
    const retailerDeleteResult = await client.query(`
      DELETE FROM retailers
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY name, phone ORDER BY id) as rn
          FROM retailers
          WHERE status = 'active'
        ) t
        WHERE rn > 1
      );
    `);
    console.log(`✅ Deleted ${retailerDeleteResult.rowCount} duplicate retailer entries`);

    // Verify the cleanup
    console.log('\n📊 VERIFICATION:');
    
    const farmerVerify = await client.query(`
      SELECT name, phone, COUNT(*) as count
      FROM farmers
      WHERE status = 'active'
      GROUP BY name, phone
      HAVING COUNT(*) > 1;
    `);
    
    const retailerVerify = await client.query(`
      SELECT name, phone, COUNT(*) as count
      FROM retailers
      WHERE status = 'active'
      GROUP BY name, phone
      HAVING COUNT(*) > 1;
    `);

    if (farmerVerify.rows.length === 0) {
      console.log('✅ No duplicate farmers remaining');
    } else {
      console.log(`⚠️  Found ${farmerVerify.rows.length} duplicate farmer groups`);
    }

    if (retailerVerify.rows.length === 0) {
      console.log('✅ No duplicate retailers remaining');
    } else {
      console.log(`⚠️  Found ${retailerVerify.rows.length} duplicate retailer groups`);
    }

    console.log('\n✅ Cleanup completed successfully!');
    console.log('💡 Tip: Refresh the form in your browser to see the updated dropdown.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
