const { Client } = require('pg');

const SSL = { rejectUnauthorized: false };
const HOST = 'poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com';
const USER = 'poultry_user';
const PASS = 'poultry_user1212';

const prod = new Client({ host: HOST, port: 5432, database: 'poultry', user: USER, password: PASS, ssl: SSL });
const stage = new Client({ host: HOST, port: 5432, database: 'poultry_stage', user: USER, password: PASS, ssl: SSL });

// EXACT FK-safe order: every parent must appear before its children
const ORDERED_TABLES = [
  'users',
  'farmers',
  'retailers',
  'vehicles',
  'settings',
  'products',
  'inventory_items',
  'purchase_orders',
  'cages',
  'purchase_order_items',
  'purchase_order_payments',
  'sales',            // ← parent of sale_payments
  'sale_payments',    // ← child of sales
  'mortalities',
  'expenses',
  'godown_inward_entries',
  'godown_sales',     // ← parent of godown_sale_payments
  'godown_sale_payments',
  'godown_mortality',
  'godown_expenses',
  'role_permissions',
  'user_permissions',
  'payment_vouchers',
  'billing_parties',
  'billing_sales',
  'billing_payments',
  'billing_ledger',
];

async function syncTable(stage, prod, table) {
  // 1. Check existence
  const checkProd = await prod.query(`SELECT 1 FROM information_schema.tables WHERE table_name = '${table}'`);
  const checkStage = await stage.query(`SELECT 1 FROM information_schema.tables WHERE table_name = '${table}'`);
  if (checkProd.rows.length === 0) { console.log(`     ⏭️  Not in prod, skipping.`); return; }
  if (checkStage.rows.length === 0) { console.log(`     ⏭️  Not in stage, skipping.`); return; }

  // 2. Get prod data
  const data = await prod.query(`SELECT * FROM "${table}"`);
  if (data.rows.length === 0) { console.log(`     ⏭️  Empty in prod.`); return; }

  // 3. Truncation moved to orderedSync to satisfy FK constraints

  // 4. Get non-generated columns from staging database
  const columnsRes = await stage.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = $1 
      AND is_generated = 'NEVER'
  `, [table]);
  const prodCols = Object.keys(data.rows[0]);
  const cols = columnsRes.rows.map(r => r.column_name).filter(c => prodCols.includes(c));

  const colList = cols.map(c => `"${c}"`).join(', ');
  let inserted = 0;
  let failed = 0;
  for (const row of data.rows) {
    const vals = cols.map((_, i) => `$${i + 1}`).join(', ');
    const values = cols.map(c => row[c]);
    try {
      await stage.query(`INSERT INTO "${table}" (${colList}) VALUES (${vals})`, values);
      inserted++;
    } catch (e) {
      failed++;
      if (failed <= 2) console.log(`     ⚠️  Row skip: ${e.message.split('\n')[0]}`);
    }
  }
  console.log(`     ✅ ${inserted} inserted, ${failed} skipped.`);
}

async function orderedSync() {
  await prod.connect();
  await stage.connect();
  console.log('--- ORDERED FK-SAFE SYNC (PROD -> STAGING) ---\n');

  try {
    // Truncate all tables in reverse order to satisfy foreign keys
    console.log('🧹 Clearing staging tables in reverse order...');
    for (const table of [...ORDERED_TABLES].reverse()) {
      try {
        const checkStage = await stage.query(`SELECT 1 FROM information_schema.tables WHERE table_name = '${table}'`);
        if (checkStage.rows.length > 0) {
          await stage.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
        }
      } catch (e) {
        console.log(`     ⚠️  Truncate failed for ${table}: ${e.message.split('\n')[0]}`);
      }
    }
    console.log('🧹 Clearing complete!\n');

    for (const table of ORDERED_TABLES) {
      console.log(`  📦 ${table}`);
      try {
        await syncTable(stage, prod, table);
      } catch (err) {
        console.log(`     ❌ TABLE ERROR: ${err.message.split('\n')[0]}`);
      }
    }

    // Reset sequences
    console.log('\n=== Resetting sequences ===');
    const sequences = await stage.query("SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'");
    for (const seq of sequences.rows) {
      try {
        const owner = await stage.query(`
          SELECT t.relname as tbl, a.attname as col
          FROM pg_class s
          JOIN pg_depend d ON d.objid = s.oid
          JOIN pg_class t ON d.refobjid = t.oid
          JOIN pg_attribute a ON (d.refobjid = a.attrelid AND d.refobjsubid = a.attnum)
          WHERE s.relname = '${seq.sequence_name}'`);
        if (owner.rows.length > 0) {
          const { tbl, col } = owner.rows[0];
          await stage.query(`SELECT setval('${seq.sequence_name}', COALESCE((SELECT MAX("${col}") FROM "${tbl}"), 1), true)`);
        }
      } catch (e) { }
    }
    console.log('\n🌟 ALL DONE!');
  } finally {
    await prod.end();
    await stage.end();
  }
}

orderedSync().catch(console.error);
