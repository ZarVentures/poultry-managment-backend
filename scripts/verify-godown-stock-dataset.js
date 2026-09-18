/**
 * Import a known godown dataset and check leftover stock vs expected.
 *
 *   node scripts/verify-godown-stock-dataset.js
 *
 * Uses local Postgres from env (.env / .env.example), isolated tenant.
 * Calls real GodownService.getSummary() when Nest can boot.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.example') });

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const dataset = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'godown-stock-dataset.json'), 'utf8'),
);

function round2(v) {
  return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
}

function n(v) {
  const x = parseFloat(String(v ?? ''));
  return Number.isFinite(x) ? x : 0;
}

function inwardKg(e) {
  const recorded = n(e.totalWeight) || n(e.actualWeight);
  if (recorded > 0) return recorded;
  const birds = n(e.numberOfBirds);
  const avg = n(e.averageWeight);
  return birds > 0 && avg > 0 ? round2(birds * avg) : 0;
}

function computeExpected(data) {
  const inwardBirds = data.inwards.reduce((s, e) => s + n(e.numberOfBirds), 0);
  const inwardKgTotal = data.inwards.reduce((s, e) => s + inwardKg(e), 0);
  const inwardValue = data.inwards.reduce((s, e) => s + n(e.totalAmount), 0);
  const avgKgPerBird = inwardBirds > 0 ? inwardKgTotal / inwardBirds : 0;
  const soldBirds = data.sales.reduce((s, e) => s + n(e.numberOfBirds), 0);
  const billedKg = data.sales.reduce((s, e) => s + n(e.totalWeight), 0);
  const deadBirds = data.mortalities.reduce((s, e) => s + n(e.numberOfBirdsDied), 0);
  const deadRecordedKg = data.mortalities.reduce((s, e) => s + n(e.weightOfDeadBirds), 0);
  const remainingBirds = inwardBirds - soldBirds - deadBirds;
  const remainingKg = remainingBirds <= 0 ? 0 : round2(remainingBirds * avgKgPerBird);
  const inwardRate = inwardKgTotal > 0 ? inwardValue / inwardKgTotal : 0;
  const remainingValue = round2(remainingKg * inwardRate);
  const wrongIfSubtractBilledKg = round2(inwardKgTotal - billedKg - deadRecordedKg);
  return {
    inwardBirds,
    inwardKg: inwardKgTotal,
    avgKgPerBird,
    soldBirds,
    deadBirds,
    remainingBirds,
    remainingKg,
    inwardValue,
    inwardRatePerKg: inwardRate,
    remainingValue,
    billedSaleKg: billedKg,
    wrongIfSubtractBilledKg,
  };
}

function assertClose(label, actual, expected) {
  const a = round2(actual);
  const e = round2(expected);
  const ok = a === e;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${label}: actual=${a} expected=${e}`);
  return ok;
}

function dbConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'poultry',
  };
}

async function connect() {
  const cfg = dbConfig();
  const client = new Client(cfg);
  await client.connect();
  return client;
}

async function cleanup(client, tenantId) {
  if (!tenantId) return;
  await client.query(`DELETE FROM godown_mortality WHERE tenant_id = $1`, [tenantId]);
  await client.query(`DELETE FROM godown_sale_payments WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await client.query(`DELETE FROM godown_sales WHERE tenant_id = $1`, [tenantId]);
  await client.query(`DELETE FROM godown_inward_entries WHERE tenant_id = $1`, [tenantId]);
  await client.query(`DELETE FROM users WHERE tenant_id = $1 AND phone LIKE '99verify%'`, [tenantId]).catch(() => {});
  await client.query(`DELETE FROM tenants WHERE id = $1 AND name = $2`, [tenantId, dataset.marker]);
}

async function importDataset(client) {
  await cleanup(client, (
    await client.query(`SELECT id FROM tenants WHERE name = $1`, [dataset.marker])
  ).rows[0]?.id);

  const tenant = await client.query(
    `INSERT INTO tenants (name, type, status, currency)
     VALUES ($1, 'verify', 'active', 'INR')
     RETURNING id`,
    [dataset.marker],
  );
  const tenantId = String(tenant.rows[0].id);

  for (const e of dataset.inwards) {
    await client.query(
      `INSERT INTO godown_inward_entries
        (entry_date, inward_no, supplier_name, number_of_birds, average_weight,
         total_weight, actual_weight, rate_per_kg, total_amount, notes, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        e.entryDate, e.inwardNo, e.supplierName, e.numberOfBirds, e.averageWeight,
        e.totalWeight, e.actualWeight, e.ratePerKg, e.totalAmount, dataset.marker, tenantId,
      ],
    );
  }

  for (const s of dataset.sales) {
    await client.query(
      `INSERT INTO godown_sales
        (sale_date, sale_no, invoice_number, customer_name, number_of_birds,
         total_weight, rate_per_kg, total_amount, payment_status, amount_received, notes, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',0,$9,$10)`,
      [
        s.saleDate, s.saleNo, s.invoiceNumber, s.customerName, s.numberOfBirds,
        s.totalWeight, s.ratePerKg, s.totalAmount, dataset.marker, tenantId,
      ],
    );
  }

  for (const m of dataset.mortalities) {
    await client.query(
      `INSERT INTO godown_mortality
        (mortality_date, number_of_birds_died, weight_of_dead_birds, reason, notes, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [m.mortalityDate, m.numberOfBirdsDied, m.weightOfDeadBirds, m.reason, dataset.marker, tenantId],
    );
  }

  return tenantId;
}

async function loadImported(client, tenantId) {
  const inwards = (await client.query(
    `SELECT number_of_birds AS "numberOfBirds", average_weight AS "averageWeight",
            total_weight AS "totalWeight", actual_weight AS "actualWeight", total_amount AS "totalAmount"
     FROM godown_inward_entries WHERE tenant_id = $1`,
    [tenantId],
  )).rows;
  const sales = (await client.query(
    `SELECT number_of_birds AS "numberOfBirds", total_weight AS "totalWeight"
     FROM godown_sales WHERE tenant_id = $1`,
    [tenantId],
  )).rows;
  const mortalities = (await client.query(
    `SELECT number_of_birds_died AS "numberOfBirdsDied", weight_of_dead_birds AS "weightOfDeadBirds"
     FROM godown_mortality WHERE tenant_id = $1`,
    [tenantId],
  )).rows;
  return { inwards, sales, mortalities };
}

async function runNestSummary(tenantId) {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'verify-dataset-secret';
  require('reflect-metadata');
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module');
  const { TenantContextService } = require('../dist/tenants/tenant-context.service');
  const { GodownService } = require('../dist/godown/godown.service');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const tenantCtx = app.get(TenantContextService);
    const godown = app.get(GodownService);
    return await tenantCtx.run(String(tenantId), () => godown.getSummary());
  } finally {
    await app.close();
  }
}

async function main() {
  const expected = dataset.expected;
  const recomputed = computeExpected(dataset);

  console.log('\n=== DATASET (what should happen) ===');
  console.log(dataset.purpose);
  console.log(JSON.stringify(expected, null, 2));
  console.log('\nIndependent recompute from dataset rows:');
  console.log(JSON.stringify(recomputed, null, 2));

  let allOk = true;
  console.log('\n=== Check dataset JSON vs independent formula ===');
  allOk = assertClose('remainingBirds', recomputed.remainingBirds, expected.remainingBirds) && allOk;
  allOk = assertClose('remainingKg', recomputed.remainingKg, expected.remainingKg) && allOk;
  allOk = assertClose('remainingValue', recomputed.remainingValue, expected.remainingValue) && allOk;
  allOk = assertClose('avgKgPerBird', recomputed.avgKgPerBird, expected.avgKgPerBird) && allOk;
  allOk = assertClose('wrong billed-kg leftover (must differ)', recomputed.wrongIfSubtractBilledKg, expected.wrongIfSubtractBilledKg) && allOk;
  if (recomputed.remainingKg === recomputed.wrongIfSubtractBilledKg) {
    console.log('  FAIL billed-kg shortcut accidentally equals leftover — dataset is not discriminating');
    allOk = false;
  } else {
    console.log(`  PASS leftover ${recomputed.remainingKg} kg ≠ billed-kg leftover ${recomputed.wrongIfSubtractBilledKg} kg`);
  }

  let client;
  let tenantId;
  try {
    client = await connect();
    console.log('\n=== Import into database ===');
    tenantId = await importDataset(client);
    console.log(`Imported tenant_id=${tenantId} (${dataset.marker})`);

    const imported = await loadImported(client, tenantId);
    const fromDb = computeExpected({
      inwards: imported.inwards,
      sales: imported.sales,
      mortalities: imported.mortalities,
    });
    console.log('\n=== After import, formula on DB rows ===');
    allOk = assertClose('remainingBirds', fromDb.remainingBirds, expected.remainingBirds) && allOk;
    allOk = assertClose('remainingKg', fromDb.remainingKg, expected.remainingKg) && allOk;
    allOk = assertClose('remainingValue', fromDb.remainingValue, expected.remainingValue) && allOk;

    console.log('\n=== GodownService.getSummary() (live code) ===');
    try {
      const summary = await runNestSummary(tenantId);
      console.log({
        currentStock: summary.currentStock,
        currentWeight: summary.currentWeight,
        currentValue: summary.currentValue,
        totalInward: summary.totalInward,
        totalInwardWeight: summary.totalInwardWeight,
        totalSold: summary.totalSold,
        totalMortality: summary.totalMortality,
      });
      allOk = assertClose('summary.currentStock', summary.currentStock, expected.remainingBirds) && allOk;
      allOk = assertClose('summary.currentWeight', summary.currentWeight, expected.remainingKg) && allOk;
      allOk = assertClose('summary.currentValue', summary.currentValue, expected.remainingValue) && allOk;
      if (round2(summary.currentWeight) === expected.wrongIfSubtractBilledKg) {
        console.log('  FAIL service still using inward kg − billed sale kg');
        allOk = false;
      }
    } catch (err) {
      console.log('Nest getSummary skipped:', err.message);
      allOk = false;
    }
  } catch (err) {
    console.log('\nDB import skipped:', err.message);
    allOk = false;
  } finally {
    if (client && tenantId && process.env.KEEP_VERIFY_DATA !== '1') {
      await cleanup(client, tenantId);
      console.log('\nCleaned up verify tenant (set KEEP_VERIFY_DATA=1 to keep).');
    }
    if (client) await client.end();
  }

  console.log(allOk ? '\nRESULT: dataset matches.\n' : '\nRESULT: mismatch — leftover weight formula is wrong.\n');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
