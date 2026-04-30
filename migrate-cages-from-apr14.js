/**
 * migrate-cages-from-apr14.js
 *
 * Migrates cage data from Apr 14 backup (purchase_order_cages table)
 * into the current prod cages table — without duplicates, without data loss.
 *
 * Strategy:
 * - For each cage in Apr 14 backup, check if a cage with same
 *   (purchase_order_id, cage_id) already exists in prod cages table
 * - If NOT exists → INSERT it (preserving cage_weight as purchase_weight)
 * - If EXISTS → skip (don't overwrite newer data)
 * - Also updates purchase_weight = 0 rows in prod with real weight from Apr 14
 *
 * Run: node migrate-cages-from-apr14.js
 * Add --dry-run to preview without writing
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

const PROD_DB = {
  host: 'poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com',
  port: 5432,
  user: 'poultry_user',
  password: 'poultry_user1212',
  database: 'poultry',
  ssl: { rejectUnauthorized: false },
};

async function migrate() {
  // Load Apr 14 backup data
  const apr14Cages = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'database-backup-apr14', 'purchase_order_cages.json'), 'utf8')
  );
  const apr14POs = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'database-backup-apr14', 'purchase_orders.json'), 'utf8')
  );

  console.log(`Apr 14 backup: ${apr14Cages.length} cages across ${apr14POs.length} purchase orders`);
  console.log(DRY_RUN ? '\n🔍 DRY RUN MODE — no changes will be written\n' : '\n🚀 LIVE MODE — changes will be written to prod\n');

  const client = new Client(PROD_DB);
  await client.connect();
  console.log('Connected to prod DB\n');

  try {
    // Get current prod cages
    const prodCagesResult = await client.query('SELECT * FROM cages');
    const prodCages = prodCagesResult.rows;
    console.log(`Current prod cages: ${prodCages.length}\n`);

    // Build lookup: "purchase_order_id:cage_id" → prod cage row
    const prodCageLookup = new Map();
    for (const c of prodCages) {
      const key = `${c.purchase_order_id}:${c.cage_id}`;
      prodCageLookup.set(key, c);
    }

    // Get current prod purchase order IDs (only migrate cages for POs that exist in prod)
    const prodPOsResult = await client.query('SELECT id, order_number FROM purchase_orders');
    const prodPOIds = new Set(prodPOsResult.rows.map(r => String(r.id)));
    const prodPOByOrderNumber = new Map(prodPOsResult.rows.map(r => [r.order_number, r.id]));

    // Build Apr 14 PO id → order_number map
    const apr14POMap = new Map(apr14POs.map(p => [String(p.id), p.order_number]));

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let noPO = 0;

    for (const cage of apr14Cages) {
      const apr14POId = String(cage.purchase_order_id);
      const orderNumber = apr14POMap.get(apr14POId);

      // Find matching prod PO by order_number
      let prodPOId = null;
      if (orderNumber && prodPOByOrderNumber.has(orderNumber)) {
        prodPOId = String(prodPOByOrderNumber.get(orderNumber));
      } else if (prodPOIds.has(apr14POId)) {
        // Same ID exists in prod
        prodPOId = apr14POId;
      }

      if (!prodPOId) {
        console.log(`  ⚠️  Cage ${cage.cage_id} (PO ${apr14POId} / ${orderNumber}) — PO not found in prod, skipping`);
        noPO++;
        continue;
      }

      const key = `${prodPOId}:${cage.cage_id}`;
      const existing = prodCageLookup.get(key);

      if (!existing) {
        // INSERT new cage
        console.log(`  ➕ INSERT cage ${cage.cage_id} for PO ${prodPOId} (${orderNumber}) — weight: ${cage.cage_weight} kg, birds: ${cage.number_of_birds}`);
        if (!DRY_RUN) {
          await client.query(`
            INSERT INTO cages (cage_id, purchase_order_id, number_of_birds, purchase_weight, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
          `, [cage.cage_id, prodPOId, cage.number_of_birds, cage.cage_weight]);
        }
        inserted++;
      } else if (Number(existing.purchase_weight) === 0 && Number(cage.cage_weight) > 0) {
        // UPDATE weight if prod has 0 but Apr 14 has real weight
        console.log(`  🔄 UPDATE cage ${cage.cage_id} for PO ${prodPOId} — fix weight: 0 → ${cage.cage_weight} kg`);
        if (!DRY_RUN) {
          await client.query(`
            UPDATE cages SET purchase_weight = $1, updated_at = NOW()
            WHERE id = $2
          `, [cage.cage_weight, existing.id]);
        }
        updated++;
      } else {
        skipped++;
      }
    }

    console.log('\n========== MIGRATION SUMMARY ==========');
    console.log(`✅ Inserted: ${inserted} new cages`);
    console.log(`🔄 Updated:  ${updated} cages (fixed zero weight)`);
    console.log(`⏭️  Skipped:  ${skipped} cages (already exist with data)`);
    console.log(`⚠️  No PO:    ${noPO} cages (purchase order not in prod)`);
    console.log(`📊 Total processed: ${apr14Cages.length}`);

    if (DRY_RUN) {
      console.log('\n🔍 DRY RUN complete — run without --dry-run to apply changes');
    } else {
      // Verify final count
      const finalCount = await client.query('SELECT COUNT(*) FROM cages');
      console.log(`\n✅ Prod cages table now has: ${finalCount.rows[0].count} rows`);
    }

  } finally {
    await client.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
