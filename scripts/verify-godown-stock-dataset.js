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

function measuredKg(value) {
  if (value === null || value === undefined || value === '') return null;
  const x = parseFloat(String(value));
  if (!Number.isFinite(x) || x < 0) return null;
  return x;
}

function expectedKg(e) {
  const birds = n(e.numberOfBirds);
  if (birds <= 0) return 0;
  const avg = n(e.averageWeight);
  if (avg > 0) return birds * avg;
  const recorded = measuredKg(e.totalWeight) ?? measuredKg(e.actualWeight);
  return recorded != null && recorded > 0 ? recorded : 0;
}

function lineRate(e, kg) {
  const rate = measuredKg(e.ratePerKg);
  if (rate != null && rate > 0) return rate;
  const amount = measuredKg(e.totalAmount);
  if (amount != null && amount > 0 && kg > 0) return amount / kg;
  return null;
}

function stockKg(birds, avg) {
  if (n(birds) > 0 && avg > 0) return round2(n(birds) * avg);
  return 0;
}

function lossKg(stock, weighed) {
  if (weighed == null) return null;
  return Math.max(0, round2(n(stock) - weighed));
}

function computeExpected(data) {
  let inwardBirds = 0;
  let inwardExpected = 0;
  let rateKg = 0;
  let rateValue = 0;
  for (const e of data.inwards) {
    const birds = n(e.numberOfBirds);
    if (birds <= 0) continue;
    const kg = expectedKg(e);
    const rate = lineRate(e, kg);
    inwardBirds += birds;
    inwardExpected += kg;
    if (rate != null && rate > 0 && kg > 0) {
      rateKg += kg;
      rateValue += kg * rate;
    }
  }
  const avgKgPerBird = inwardBirds > 0 && inwardExpected > 0 ? inwardExpected / inwardBirds : 0;
  const inwardRate = rateKg > 0 ? rateValue / rateKg : 0;
  const soldBirds = data.sales.reduce((s, e) => s + n(e.numberOfBirds), 0);
  const billedKg = data.sales.reduce((s, e) => s + n(e.totalWeight), 0);
  const deadBirds = data.mortalities.reduce((s, e) => s + n(e.numberOfBirdsDied), 0);
  const deadRecordedKg = data.mortalities.reduce((s, e) => s + n(e.weightOfDeadBirds), 0);
  const recordedInwardKg = data.inwards.reduce((s, e) => s + (n(e.totalWeight) || n(e.actualWeight)), 0);
  const remainingBirds = inwardBirds - soldBirds - deadBirds;
  const remainingKg = remainingBirds <= 0 ? 0 : round2(remainingBirds * avgKgPerBird);
  const remainingValue = round2(remainingKg * inwardRate);
  const mortalityStockKg = stockKg(deadBirds, avgKgPerBird);
  const soldKg = data.sales.reduce((s, e) => {
    const billed = measuredKg(e.totalWeight);
    return s + (billed != null ? billed : stockKg(e.numberOfBirds, avgKgPerBird));
  }, 0);
  const rawLoss = round2(0 + round2(inwardExpected) - soldKg - mortalityStockKg - remainingKg);
  const weightLoss = rawLoss > 0 ? rawLoss : 0;
  const wrongIfSubtractBilledKg = round2(recordedInwardKg - billedKg - deadRecordedKg);
  return {
    inwardBirds,
    inwardKg: round2(inwardExpected),
    avgKgPerBird,
    soldBirds,
    deadBirds,
    remainingBirds,
    remainingKg,
    inwardValue: round2(rateValue),
    inwardRatePerKg: inwardRate,
    remainingValue,
    billedSaleKg: billedKg,
    weightLoss,
    weightLossValue: round2(weightLoss * inwardRate),
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
            total_weight AS "totalWeight", actual_weight AS "actualWeight",
            rate_per_kg AS "ratePerKg", total_amount AS "totalAmount"
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
    return await tenantCtx.run(String(tenantId), async () => ({
      summary: await godown.getSummary(),
      ledger: await godown.getStockLedger(),
    }));
  } finally {
    await app.close();
  }
}

async function cleanupNamed(client, marker) {
  const existing = await client.query(`SELECT id FROM tenants WHERE name = $1`, [marker]);
  for (const row of existing.rows) {
    const id = row.id;
    await client.query(`DELETE FROM bird_returns WHERE tenant_id = $1`, [id]).catch(() => {});
    await client.query(`DELETE FROM godown_mortality WHERE tenant_id = $1`, [id]);
    await client.query(`DELETE FROM godown_sales WHERE tenant_id = $1`, [id]);
    await client.query(`DELETE FROM godown_inward_entries WHERE tenant_id = $1`, [id]);
    await client.query(`DELETE FROM tenants WHERE id = $1`, [id]);
  }
}

async function runEdgeChecks(client) {
  console.log('\n=== Edge cases: fallbacks, missing weight, returns, uncapped COGS ===');
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'verify-dataset-secret';
  require('reflect-metadata');
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module');
  const { TenantContextService } = require('../dist/tenants/tenant-context.service');
  const { GodownService } = require('../dist/godown/godown.service');
  const { ReportsService } = require('../dist/reports/reports.service');

  const edgeMarker = 'VERIFY_GODOWN_EDGE_CASES';
  const capMarker = 'VERIFY_GODOWN_COGS_CAP';
  await cleanupNamed(client, edgeMarker);
  await cleanupNamed(client, capMarker);

  const edgeTenant = await client.query(
    `INSERT INTO tenants (name, type, status, currency) VALUES ($1, 'verify', 'active', 'INR') RETURNING id`,
    [edgeMarker],
  );
  const edgeId = String(edgeTenant.rows[0].id);
  const capTenant = await client.query(
    `INSERT INTO tenants (name, type, status, currency) VALUES ($1, 'verify', 'active', 'INR') RETURNING id`,
    [capMarker],
  );
  const capId = String(capTenant.rows[0].id);

  await client.query(
    `INSERT INTO godown_inward_entries
      (entry_date, inward_no, supplier_name, number_of_birds, average_weight, total_weight, actual_weight, rate_per_kg, total_amount, notes, tenant_id)
     VALUES
      ('2026-09-01','EDGE-INW-1','A',100,2,100,100,50,5000,$2,$1),
      ('2026-09-02','EDGE-INW-2','B',40,NULL,60,60,NULL,9000,$2,$1),
      ('2026-09-03','EDGE-INW-0','Z',0,NULL,10,10,999,9990,$2,$1),
      ('2026-12-01','EDGE-INW-F','F',50,3,150,150,10,1500,$2,$1)`,
    [edgeId, edgeMarker],
  );
  const sale = await client.query(
    `INSERT INTO godown_sales
      (sale_date, sale_no, invoice_number, customer_name, number_of_birds, total_weight, rate_per_kg, total_amount, payment_status, amount_received, notes, tenant_id)
     VALUES ('2026-09-05','EDGE-GDS-1','EDGE-GDS-1','Buyer',15,40,80,3200,'pending',0,$2,$1)
     RETURNING id`,
    [edgeId, edgeMarker],
  );
  await client.query(
    `INSERT INTO godown_sales
      (sale_date, sale_no, invoice_number, customer_name, number_of_birds, total_weight, rate_per_kg, total_amount, payment_status, amount_received, notes, tenant_id)
     VALUES ('2026-09-06','EDGE-GDS-2','EDGE-GDS-2','Missing Weight',10,NULL,80,0,'pending',0,$2,$1)`,
    [edgeId, edgeMarker],
  );
  await client.query(
    `INSERT INTO bird_returns
      (return_number, return_date, sale_id, customer_name, number_of_birds_returned, weight_returned, return_reason, status, returned_to_inventory, refund_amount, notes, tenant_id)
     VALUES ('EDGE-RET-1','2026-09-20',$1,'Buyer',5,5,'customer_request','processed',true,0,$3,$2)`,
    [sale.rows[0].id, edgeId, edgeMarker],
  );
  await client.query(
    `INSERT INTO godown_mortality
      (mortality_date, number_of_birds_died, weight_of_dead_birds, reason, notes, tenant_id)
     VALUES ('2026-09-07',5,4,'measured',$2,$1), ('2026-09-08',2,NULL,'missing',$2,$1)`,
    [edgeId, edgeMarker],
  );
  await client.query(
    `INSERT INTO godown_inward_entries
      (entry_date, inward_no, supplier_name, number_of_birds, average_weight, total_weight, actual_weight, rate_per_kg, total_amount, notes, tenant_id)
     VALUES ('2026-09-01','CAP-INW','Cap',10,2,10,10,100,1000,$2,$1)`,
    [capId, capMarker],
  );
  await client.query(
    `INSERT INTO godown_sales
      (sale_date, sale_no, invoice_number, customer_name, number_of_birds, total_weight, rate_per_kg, total_amount, payment_status, amount_received, notes, tenant_id)
     VALUES ('2026-09-02','CAP-GDS','CAP-GDS','Cap Buyer',10,10,150,1500,'pending',0,$2,$1)`,
    [capId, capMarker],
  );

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  let ok = true;
  try {
    const tenantCtx = app.get(TenantContextService);
    const godown = app.get(GodownService);
    const reports = app.get(ReportsService);
    const memory = godown.inwardAverages([
      { entryDate: '2026-09-01', numberOfBirds: 100, averageWeight: 2, ratePerKg: 50, totalWeight: 100, totalAmount: 5000 },
      { entryDate: '2026-09-02', numberOfBirds: 40, totalWeight: 60, actualWeight: 60, totalAmount: 9000 },
      { entryDate: '2026-09-03', numberOfBirds: 0, totalWeight: 10, ratePerKg: 999, totalAmount: 9990 },
      { entryDate: '2026-12-01', numberOfBirds: 50, averageWeight: 3, ratePerKg: 10, totalWeight: 150 },
      { entryDate: 'not-a-date', numberOfBirds: 10, averageWeight: 1, ratePerKg: 80 },
      { entryDate: '2026-09-02', numberOfBirds: 10, averageWeight: 1, ratePerKg: -5 },
    ], '2026-09-30');
    ok = assertClose('helper.avgWeight', memory.avgWeight, 270 / 150) && ok;
    ok = assertClose('helper.avgRate', memory.avgRate, 19000 / 260) && ok;
    ok = assertClose('helper.birds ignores zero, future, and bad dates', memory.birds, 150) && ok;
    if (godown.measuredKg(null) !== null || godown.measuredKg('') !== null) {
      console.log('  FAIL missing weight was treated as a number');
      ok = false;
    } else {
      console.log('  PASS missing weight stays missing');
    }
    if (godown.shrinkageKg(10, null) !== null) {
      console.log('  FAIL missing scale weight became a verified loss');
      ok = false;
    } else {
      console.log('  PASS missing scale weight is not a zero loss');
    }
    ok = assertClose('explicit zero kg is a real measurement', godown.shrinkageKg(10, 0), 10) && ok;
    const sample = godown.reconcileGodownWeight({
      openingWeight: 100,
      inwardWeight: 1000,
      soldWeight: 1050,
      closingWeight: 30,
      returnWeightIn: 0,
      mortalityWeight: 0,
      returnWeightOut: 0,
      rate: 119.09,
    });
    ok = assertClose('example weight loss', sample.weightLoss, 20) && ok;
    ok = assertClose('example weight loss cost', sample.weightLossCost, 2381.8) && ok;
    ok = assertClose('example weight loss percent', sample.weightLossPercent, round2((20 / 1100) * 100)) && ok;
    ok = assertClose('example average rate', round2(godown.weightedAverageRate(100, 11000, 1000, 120000)), 119.09) && ok;
    const oversold = godown.reconcileGodownWeight({
      openingWeight: 0,
      inwardWeight: 10,
      soldWeight: 15,
      closingWeight: 0,
    });
    ok = assertClose('negative difference is not weight loss', oversold.weightLoss, 0) && ok;
    ok = assertClose('negative difference is flagged', oversold.discrepancyKg, -5) && ok;
    const empty = godown.reconcileGodownWeight({
      openingWeight: 0,
      inwardWeight: 0,
      soldWeight: 0,
      closingWeight: 0,
    });
    ok = assertClose('zero stock weight loss', empty.weightLoss, 0) && ok;
    ok = assertClose('zero stock percent', empty.weightLossPercent, 0) && ok;

    await tenantCtx.run(edgeId, async () => {
      const asOf = await godown.getInwardAverages('2026-09-30');
      ok = assertClose('db.avgWeight', asOf.avgWeight, 260 / 140) && ok;
      ok = assertClose('db.avgRate', asOf.avgRate, 19000 / 260) && ok;
      const opening = await godown.getStockLedger({ endDate: '2026-09-04' });
      ok = assertClose('opening birds before sales', opening.closing.birds, 140) && ok;
      ok = assertClose('opening kg = birds x avg', opening.closing.weight, 260) && ok;
      const beforeReturn = await godown.getStockLedger({ startDate: '2026-09-01', endDate: '2026-09-10' });
      ok = assertClose('birds out before return restores original sale', beforeReturn.period.birdsOut, 20 + 10 + 5 + 2) && ok;
      ok = assertClose('closing before return', beforeReturn.closing.birds, 140 - 20 - 10 - 5 - 2) && ok;
      const afterReturn = await godown.getStockLedger({ startDate: '2026-09-01', endDate: '2026-09-30' });
      ok = assertClose('closing after restock', afterReturn.closing.birds, 140 - 20 - 10 - 5 - 2 + 5) && ok;
      if ((beforeReturn.period.unmeasuredLossCount || 0) < 2) {
        console.log(`  FAIL expected unmeasured sale and mortality, got ${beforeReturn.period.unmeasuredLossCount}`);
        ok = false;
      } else {
        console.log(`  PASS unmeasured movements are not zero loss (${beforeReturn.period.unmeasuredLossCount})`);
      }
      const soldBefore = await godown.countGodownSoldBirds('2026-09-01', '2026-09-10');
      const soldAfter = await godown.countGodownSoldBirds('2026-09-01', '2026-09-30');
      ok = assertClose('COGS birds add back a later return', soldBefore, 30) && ok;
      ok = assertClose('COGS birds keep an in-period return net', soldAfter, 25) && ok;
      const lossReport = await reports.getWeightLossReport('2026-09-01', '2026-09-30');
      for (const key of ['godown_sales', 'godown_inward', 'godown_mortality']) {
        const lines = (lossReport.details || []).filter((row) => row.channel === key);
        const lineSum = round2(lines.reduce((sum, row) => sum + (row.weightLoss == null ? 0 : row.weightLoss), 0));
        const channel = (lossReport.byChannel || []).find((row) => row.key === key);
        ok = assertClose(`${key} loss equals its lines`, channel?.weightLoss, lineSum) && ok;
      }
      const missingLine = (lossReport.details || []).find((row) => row.documentNo === 'EDGE-GDS-2');
      const missingMortality = (lossReport.details || []).find((row) => row.channel === 'godown_mortality' && row.party === 'missing');
      if (!missingLine || missingLine.weightLoss !== null || !missingMortality || missingMortality.weightLoss !== null) {
        console.log('  FAIL a document with no weighed kg was given a verified loss');
        ok = false;
      } else {
        console.log('  PASS sale and mortality with no weighed kg have a null loss');
      }
    });

    await tenantCtx.run(capId, async () => {
      const pnl = await reports.getProfitLossReport('2026-09-01', '2026-09-30');
      ok = assertClose('uncapped godown COGS', pnl.summary.godownCogs, 2000) && ok;
      ok = assertClose('vehicle COGS unchanged at zero', pnl.summary.vehicleCogs, 0) && ok;
      if (pnl.summary.godownCogs <= 1000) {
        console.log('  FAIL godown COGS was still capped at inward total_amount');
        ok = false;
      } else {
        console.log('  PASS godown COGS 2000 is above the old inward-cost cap of 1000');
      }
    });
  } finally {
    await app.close();
    await cleanupNamed(client, edgeMarker);
    await cleanupNamed(client, capMarker);
  }
  return ok;
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
  allOk = assertClose('weightLoss', recomputed.weightLoss, expected.weightLoss) && allOk;
  allOk = assertClose('weightLossValue', recomputed.weightLossValue, expected.weightLossValue) && allOk;
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
      const live = await runNestSummary(tenantId);
      const summary = live.summary;
      const ledger = live.ledger;
      console.log({
        currentStock: summary.currentStock,
        currentWeight: summary.currentWeight,
        currentValue: summary.currentValue,
        totalInward: summary.totalInward,
        totalInwardWeight: summary.totalInwardWeight,
        totalSold: summary.totalSold,
        totalMortality: summary.totalMortality,
        avgWeight: ledger.avgWeight,
        avgRate: ledger.avgRate,
        weightLoss: ledger.period?.weightLoss,
        weightLossValue: ledger.period?.weightLossValue,
      });
      allOk = assertClose('summary.currentStock', summary.currentStock, expected.remainingBirds) && allOk;
      allOk = assertClose('summary.currentWeight', summary.currentWeight, expected.remainingKg) && allOk;
      allOk = assertClose('summary.currentValue', summary.currentValue, expected.remainingValue) && allOk;
      allOk = assertClose('ledger.avgWeight', ledger.avgWeight, expected.avgKgPerBird) && allOk;
      allOk = assertClose('ledger.avgRate', ledger.avgRate, expected.inwardRatePerKg) && allOk;
      allOk = assertClose('ledger.weightLoss', ledger.period?.weightLoss, expected.weightLoss) && allOk;
      allOk = assertClose('ledger.weightLossValue', ledger.period?.weightLossValue, expected.weightLossValue) && allOk;
      if (round2(summary.currentWeight) === expected.wrongIfSubtractBilledKg) {
        console.log('  FAIL service still using inward kg − billed sale kg');
        allOk = false;
      }
    } catch (err) {
      console.log('Nest getSummary skipped:', err.message);
      allOk = false;
    }

    try {
      allOk = await runEdgeChecks(client) && allOk;
    } catch (err) {
      console.log('Edge checks failed:', err.message);
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
