/**
 * sync-prod-to-stage.js
 * Copies all prod data to staging DB, clears billing tables in staging.
 * Run: node sync-prod-to-stage.js
 * Safe: never touches prod DB.
 */

const { Client } = require('pg');

const SSL = { rejectUnauthorized: false };
const HOST = 'poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com';
const USER = 'poultry_user';
const PASS = 'poultry_user1212';

const prod  = new Client({ host: HOST, port: 5432, database: 'poultry',       user: USER, password: PASS, ssl: SSL });
const stage = new Client({ host: HOST, port: 5432, database: 'poultry_stage', user: USER, password: PASS, ssl: SSL });

// Tables to copy in FK order (parents before children)
const TABLES = [
  'users',
  'farmers',
  'retailers',
  'vehicles',
  'settings',
  'purchase_orders',
  'purchase_order_items',
  'purchase_order_payments',
  'cages',
  'sales',
  'sale_payments',
  'expenses',
  'mortalities',
  'godown_inward_entries',
  'godown_sales',
  'godown_mortality',
  'godown_expenses',
];

// Billing tables to CLEAR in staging (not copy from prod — they're staging-only)
const BILLING_TABLES_TO_CLEAR = [
  'billing_ledger',
  'billing_payments',
  'billing_sales',
  'billing_parties',
];

async function sync() {
  await prod.connect();
  await stage.connect();
  console.log('Connected to both DBs\n');

  try {
    // Step 1: Clear billing tables in staging
    console.log('=== Clearing staging billing tables ===');
    for (const table of BILLING_TABLES_TO_CLEAR) {
      try {
        await stage.query(`TRUNCATE TABLE "${table}" CASCADE`);
        console.log(`  🗑️  Cleared ${table}`);
      } catch (err) {
        console.log(`  ⚠️  ${table}: ${err.message} (may not exist, skipping)`);
      }
    }

    // Step 2: Copy prod tables to staging
    console.log('\n=== Copying prod data to staging ===');
    for (const table of TABLES) {
      try {
        // Get prod data
        const result = await prod.query(`SELECT * FROM "${table}" ORDER BY 1`);
        const rows = result.rows;

        if (rows.length === 0) {
          console.log(`  ⏭️  ${table}: 0 rows, skipping`);
          continue;
        }

        // Clear staging table
        await stage.query(`TRUNCATE TABLE "${table}" CASCADE`);

        // Insert prod data
        const cols = Object.keys(rows[0]);
        const colList = cols.map(c => `"${c}"`).join(', ');

        for (const row of rows) {
          const vals = cols.map((_, i) => `$${i + 1}`).join(', ');
          const values = cols.map(c => row[c]);
          await stage.query(`INSERT INTO "${table}" (${colList}) VALUES (${vals})`, values);
        }

        console.log(`  ✅ ${table}: ${rows.length} rows copied`);
      } catch (err) {
        console.log(`  ⚠️  ${table}: FAILED - ${err.message}`);
      }
    }

    // Step 3: Reset sequences so new inserts don't conflict
    console.log('\n=== Resetting sequences ===');
    const seqResult = await stage.query(`
      SELECT sequence_name FROM information_schema.sequences 
      WHERE sequence_schema = 'public'
    `);
    for (const { sequence_name } of seqResult.rows) {
      try {
        // Find the table/column this sequence belongs to
        const maxResult = await stage.query(`SELECT last_value FROM "${sequence_name}"`);
        const lastVal = maxResult.rows[0]?.last_value || 1;
        await stage.query(`SELECT setval('${sequence_name}', ${lastVal}, true)`);
        console.log(`  🔢 ${sequence_name}: set to ${lastVal}`);
      } catch (err) {
        // ignore
      }
    }

    console.log('\n✅ Sync complete! Staging DB now mirrors prod data.');
    console.log('Billing tables in staging have been cleared.');

  } finally {
    await prod.end();
    await stage.end();
  }
}

sync().catch(err => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
