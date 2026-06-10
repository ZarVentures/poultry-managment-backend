/**
 * check-duplicate-parties.js
 * 
 * Checks for duplicate farmer and retailer names in the database.
 * If duplicates are found, it reports them so they can be cleaned up.
 * 
 * Run: node check-duplicate-parties.js
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

    // Check for duplicate farmers
    console.log('🔍 Checking for duplicate FARMERS...');
    const farmerDuplicates = await client.query(`
      SELECT name, phone, status, COUNT(*) as count, array_agg(id) as ids
      FROM farmers
      WHERE status = 'active'
      GROUP BY name, phone, status
      HAVING COUNT(*) > 1
      ORDER BY count DESC;
    `);

    if (farmerDuplicates.rows.length > 0) {
      console.log('⚠️  Found duplicate farmers:');
      farmerDuplicates.rows.forEach((row) => {
        console.log(`   - "${row.name}" (${row.phone}): ${row.count} entries - IDs: ${row.ids}`);
      });
    } else {
      console.log('✅ No duplicate farmers found\n');
    }

    // Check for duplicate retailers
    console.log('\n🔍 Checking for duplicate RETAILERS...');
    const retailerDuplicates = await client.query(`
      SELECT name, phone, status, COUNT(*) as count, array_agg(id) as ids
      FROM retailers
      WHERE status = 'active'
      GROUP BY name, phone, status
      HAVING COUNT(*) > 1
      ORDER BY count DESC;
    `);

    if (retailerDuplicates.rows.length > 0) {
      console.log('⚠️  Found duplicate retailers:');
      retailerDuplicates.rows.forEach((row) => {
        console.log(`   - "${row.name}" (${row.phone}): ${row.count} entries - IDs: ${row.ids}`);
      });
    } else {
      console.log('✅ No duplicate retailers found\n');
    }

    // Summary
    console.log('\n📊 SUMMARY:');
    const farmerCount = await client.query("SELECT COUNT(*) FROM farmers WHERE status = 'active'");
    const retailerCount = await client.query("SELECT COUNT(*) FROM retailers WHERE status = 'active'");
    console.log(`   Total active farmers: ${farmerCount.rows[0].count}`);
    console.log(`   Total active retailers: ${retailerCount.rows[0].count}`);

    if (farmerDuplicates.rows.length === 0 && retailerDuplicates.rows.length === 0) {
      console.log('\n✅ No duplicates found - database is clean!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
