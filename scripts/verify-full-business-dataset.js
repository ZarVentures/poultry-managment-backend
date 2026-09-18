/**
 * Full flow dataset: purchase → cages → godown inward → vehicle sale →
 * godown sale → travel mortality → godown mortality → expenses → P&L.
 *
 *   node scripts/verify-full-business-dataset.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.example') });

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const dataset = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'full-business-dataset.json'), 'utf8'),
);

function round2(v) {
  return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
}

function n(v) {
  const x = parseFloat(String(v ?? ''));
  return Number.isFinite(x) ? x : 0;
}

function computeExpected(d) {
  const p = d.purchase;
  const inward = d.inward;
  const gs = d.godownSale;
  const vs = d.vehicleSale;
  const gm = d.godownMortality;
  const tm = d.transportMortality;

  const purchaseKg = n(p.totalWeight);
  const purchaseNet = n(p.netAmount);
  const purchaseBirds = p.cages.reduce((s, c) => s + n(c.numberOfBirds), 0);
  const purchaseRate = n(p.ratePerKg) > 0 ? n(p.ratePerKg) : (purchaseKg > 0 ? purchaseNet / purchaseKg : 0);

  const inwardBirds = n(inward.numberOfBirds);
  const inwardKg = n(inward.totalWeight) || n(inward.actualWeight);
  const inwardValue = n(inward.totalAmount);
  const godownAvg = inwardBirds > 0 ? inwardKg / inwardBirds : 0;
  const godownRate = n(inward.ratePerKg) > 0 ? n(inward.ratePerKg) : (inwardKg > 0 ? inwardValue / inwardKg : 0);

  const godownSoldBirds = n(gs.numberOfBirds);
  const godownBilledKg = n(gs.totalWeight);
  const godownDeadBirds = n(gm.numberOfBirdsDied);
  const godownRemainingBirds = inwardBirds - godownSoldBirds - godownDeadBirds;
  const godownRemainingKg = godownRemainingBirds <= 0 ? 0 : round2(godownRemainingBirds * godownAvg);
  const godownStockValue = round2(godownRemainingKg * godownRate);

  const vehicleSoldKg = n(vs.quantity);
  const vehicleSoldBirds = n(vs.numberOfBirds);
  const transportDeadKg = n(tm.weightOfDeadBirds);
  const transportDeadBirds = n(tm.numberOfBirdsDied);
  const vehicleRemainingKg = Math.max(0, round2(purchaseKg - inwardKg - vehicleSoldKg - transportDeadKg));
  const vehicleRemainingBirds = Math.max(0, purchaseBirds - inwardBirds - vehicleSoldBirds - transportDeadBirds);
  const vehicleStockValue = round2(vehicleRemainingKg * purchaseRate);

  const vehicleRevenue = n(vs.netAmount);
  const godownRevenue = n(gs.totalAmount);
  const totalRevenue = round2(vehicleRevenue + godownRevenue);
  const vehicleCogs = round2(vehicleSoldKg * purchaseRate);
  const godownSoldStockKg = godownSoldBirds > 0 && godownAvg > 0 ? round2(godownSoldBirds * godownAvg) : godownBilledKg;
  const godownCogs = round2(godownSoldStockKg * godownRate);
  const cogs = round2(vehicleCogs + godownCogs);
  const totalExpenses = round2(n(d.expense.amount) + n(d.godownExpense.amount));
  const netProfit = round2(totalRevenue - cogs - totalExpenses);
  const wrongGodownKgIfSubtractBilled = round2(inwardKg - godownBilledKg - n(gm.weightOfDeadBirds));

  return {
    purchaseBirds,
    purchaseKg,
    purchaseNet,
    purchaseRate,
    inwardBirds,
    inwardKg,
    inwardValue,
    godownAvgKgPerBird: godownAvg,
    godownSoldBirds,
    godownBilledKg,
    godownDeadBirds,
    godownRemainingBirds,
    godownRemainingKg,
    godownStockValue,
    vehicleSoldBirds,
    vehicleSoldKg,
    vehicleRevenue,
    godownRevenue,
    totalRevenue,
    transportDeadBirds,
    transportDeadKg,
    transportMortalityAmount: n(tm.amount),
    vehicleRemainingKg,
    vehicleRemainingBirds,
    vehicleStockValue,
    availableStock: round2(godownStockValue + vehicleStockValue),
    openingStock: 0,
    vehicleCogs,
    godownCogs,
    cogs,
    totalExpenses,
    netProfit,
    wrongGodownKgIfSubtractBilled,
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

async function cleanup(client, tenantId) {
  const ids = [];
  if (tenantId) ids.push(tenantId);
  const named = await client.query(`SELECT id FROM tenants WHERE name = $1`, [dataset.marker]);
  for (const row of named.rows) ids.push(String(row.id));
  const unique = [...new Set(ids)];
  for (const id of unique) {
    await client.query(`DELETE FROM godown_sale_payments WHERE tenant_id = $1`, [id]).catch(() => {});
    await client.query(`DELETE FROM godown_sales WHERE tenant_id = $1`, [id]);
    await client.query(`DELETE FROM godown_mortality WHERE tenant_id = $1`, [id]);
    await client.query(`DELETE FROM godown_expenses WHERE tenant_id = $1`, [id]);
    await client.query(`DELETE FROM godown_inward_entries WHERE tenant_id = $1`, [id]);
    await client.query(`DELETE FROM sale_payments WHERE tenant_id = $1`, [id]).catch(() => {});
    await client.query(`DELETE FROM sales WHERE tenant_id = $1`, [id]);
    await client.query(`DELETE FROM mortalities WHERE tenant_id = $1`, [id]);
    await client.query(`DELETE FROM expenses WHERE tenant_id = $1`, [id]);
    await client.query(`DELETE FROM cages WHERE tenant_id = $1`, [id]);
    await client.query(`DELETE FROM purchase_order_payments WHERE tenant_id = $1`, [id]).catch(() => {});
    await client.query(`DELETE FROM purchase_order_items WHERE tenant_id = $1`, [id]).catch(() => {});
    await client.query(
      `DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE tenant_id = $1)`,
      [id],
    ).catch(() => {});
    await client.query(`DELETE FROM purchase_orders WHERE tenant_id = $1`, [id]);
    await client.query(`DELETE FROM users WHERE tenant_id = $1`, [id]).catch(() => {});
    await client.query(`DELETE FROM tenants WHERE id = $1 AND name = $2`, [id, dataset.marker]);
  }
  await client.query(`DELETE FROM sales WHERE invoice_number LIKE 'VERIFY-FULL-%'`).catch(() => {});
  await client.query(`DELETE FROM purchase_orders WHERE order_number LIKE 'VERIFY-FULL-%'`).catch(() => {});
  await client.query(`DELETE FROM mortalities WHERE record_number LIKE 'VERIFY-FULL-%'`).catch(() => {});
  await client.query(`DELETE FROM godown_sales WHERE sale_no LIKE 'VERIFY-FULL-%'`).catch(() => {});
  await client.query(`DELETE FROM godown_inward_entries WHERE inward_no LIKE 'VERIFY-FULL-%'`).catch(() => {});
}

async function importDataset(client) {
  await cleanup(client, null);
  const tenant = await client.query(
    `INSERT INTO tenants (name, type, status, currency)
     VALUES ($1, 'verify', 'active', 'INR') RETURNING id`,
    [dataset.marker],
  );
  const tenantId = String(tenant.rows[0].id);
  const p = dataset.purchase;

  const po = await client.query(
    `INSERT INTO purchase_orders
      (order_number, supplier_name, order_date, status, total_weight, rate_per_kg,
       total_amount, gross_amount, net_amount, purchase_payment_status, notes, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11)
     RETURNING id`,
    [
      p.orderNumber, p.supplierName, p.orderDate, p.status, p.totalWeight, p.ratePerKg,
      p.totalAmount, p.grossAmount, p.netAmount, dataset.marker, tenantId,
    ],
  );
  const purchaseId = String(po.rows[0].id);

  const inward = dataset.inward;
  const inwardRow = await client.query(
    `INSERT INTO godown_inward_entries
      (entry_date, inward_no, purchase_invoice_no, supplier_name, number_of_birds,
       average_weight, total_weight, actual_weight, rate_per_kg, total_amount, notes, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id`,
    [
      inward.entryDate, inward.inwardNo, inward.purchaseInvoiceNo, inward.supplierName,
      inward.numberOfBirds, inward.averageWeight, inward.totalWeight, inward.actualWeight,
      inward.ratePerKg, inward.totalAmount, dataset.marker, tenantId,
    ],
  );
  const inwardId = String(inwardRow.rows[0].id);

  for (const c of p.cages) {
    await client.query(
      `INSERT INTO cages
        (cage_id, purchase_order_id, number_of_birds, purchase_weight, status,
         godown_inward_id, godown_inward_weight, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        c.cageId, purchaseId, c.numberOfBirds, c.purchaseWeight, c.status,
        c.status === 'in_godown' ? inwardId : null,
        c.status === 'in_godown' ? c.purchaseWeight : null,
        tenantId,
      ],
    );
  }

  const tm = dataset.transportMortality;
  await client.query(
    `INSERT INTO mortalities
      (record_number, purchase_order_id, purchase_invoice_no, purchase_date, farmer_name,
       number_of_birds_died, weight_of_dead_birds, rate_per_kg, amount, cause, source,
       total_birds_purchased, notes, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      tm.recordNumber, purchaseId, tm.purchaseInvoiceNo, tm.purchaseDate, tm.farmerName,
      tm.numberOfBirdsDied, tm.weightOfDeadBirds, tm.ratePerKg, tm.amount, tm.cause, tm.source,
      tm.totalBirdsPurchased, dataset.marker, tenantId,
    ],
  );

  const vs = dataset.vehicleSale;
  await client.query(
    `INSERT INTO sales
      (invoice_number, sale_no, sale_date, customer_name, sale_mode, product_type,
       number_of_birds, quantity, unit, unit_price, total_amount, gross_amount, net_amount,
       payment_status, amount_received, notes, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,0,$15,$16)`,
    [
      vs.invoiceNumber, vs.saleNo, vs.saleDate, vs.customerName, vs.saleMode, vs.productType,
      vs.numberOfBirds, vs.quantity, vs.unit, vs.unitPrice, vs.totalAmount, vs.grossAmount, vs.netAmount,
      vs.paymentStatus, dataset.marker, tenantId,
    ],
  );

  const gs = dataset.godownSale;
  await client.query(
    `INSERT INTO godown_sales
      (sale_date, sale_no, invoice_number, customer_name, number_of_birds, total_weight,
       rate_per_kg, total_amount, payment_status, amount_received, notes, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      gs.saleDate, gs.saleNo, gs.invoiceNumber, gs.customerName, gs.numberOfBirds, gs.totalWeight,
      gs.ratePerKg, gs.totalAmount, gs.paymentStatus, gs.amountReceived, dataset.marker, tenantId,
    ],
  );

  const gm = dataset.godownMortality;
  await client.query(
    `INSERT INTO godown_mortality
      (mortality_date, godown_inward_id, number_of_birds_died, weight_of_dead_birds, reason, notes, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [gm.mortalityDate, inwardId, gm.numberOfBirdsDied, gm.weightOfDeadBirds, gm.reason, dataset.marker, tenantId],
  );

  const ex = dataset.expense;
  await client.query(
    `INSERT INTO expenses
      (expense_date, description, amount, category, payment_method, notes, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [ex.expenseDate, ex.description, ex.amount, ex.category, ex.paymentMethod, dataset.marker, tenantId],
  );

  const ge = dataset.godownExpense;
  await client.query(
    `INSERT INTO godown_expenses
      (expense_date, category, description, amount, payment_method, notes, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [ge.expenseDate, ge.category, ge.description, ge.amount, ge.paymentMethod, dataset.marker, tenantId],
  );

  return tenantId;
}

async function runLive(tenantId) {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'verify-dataset-secret';
  require('reflect-metadata');
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module');
  const { TenantContextService } = require('../dist/tenants/tenant-context.service');
  const { GodownService } = require('../dist/godown/godown.service');
  const { ReportsService } = require('../dist/reports/reports.service');
  const { BalanceSheetService } = require('../dist/reports/balance-sheet.service');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const tenantCtx = app.get(TenantContextService);
    return await tenantCtx.run(String(tenantId), async () => {
      const godown = app.get(GodownService);
      const reports = app.get(ReportsService);
      const balance = app.get(BalanceSheetService);
      const { startDate, endDate } = dataset.period;
      const [summary, pnl, valuation] = await Promise.all([
        godown.getSummary(),
        reports.getProfitLossReport(startDate, endDate),
        balance.getInventoryValuation(endDate),
      ]);
      return { summary, pnl: pnl.summary, valuation };
    });
  } finally {
    await app.close();
  }
}

async function main() {
  const expected = dataset.expected;
  const recomputed = computeExpected(dataset);
  let allOk = true;

  console.log('\n=== FULL FLOW DATASET ===');
  console.log(dataset.story);
  console.log('\nExpected:');
  console.log(JSON.stringify(expected, null, 2));

  console.log('\n=== Independent recompute vs JSON expected ===');
  for (const key of [
    'purchaseNet', 'inwardKg', 'godownRemainingBirds', 'godownRemainingKg', 'godownStockValue',
    'vehicleRemainingKg', 'vehicleStockValue', 'availableStock', 'totalRevenue',
    'vehicleCogs', 'godownCogs', 'cogs', 'totalExpenses', 'netProfit',
  ]) {
    allOk = assertClose(key, recomputed[key], expected[key]) && allOk;
  }
  if (recomputed.godownRemainingKg === recomputed.wrongGodownKgIfSubtractBilled) {
    console.log('  FAIL dataset does not distinguish leftover kg vs billed-kg leftover');
    allOk = false;
  } else {
    console.log(`  PASS leftover ${recomputed.godownRemainingKg} kg ≠ billed-kg leftover ${recomputed.wrongGodownKgIfSubtractBilled} kg`);
  }

  const client = new Client(dbConfig());
  let tenantId;
  try {
    await client.connect();
    console.log('\n=== Import purchase → inward → sales → mortality → expenses ===');
    tenantId = await importDataset(client);
    console.log(`tenant_id=${tenantId}`);

    console.log('\n=== Live GodownService + ReportsService + inventory valuation ===');
    const live = await runLive(tenantId);
    console.log('Godown summary', {
      currentStock: live.summary.currentStock,
      currentWeight: live.summary.currentWeight,
      currentValue: live.summary.currentValue,
    });
    console.log('P&L', {
      totalRevenue: live.pnl.totalRevenue,
      poultryRevenue: live.pnl.poultryRevenue,
      godownRevenue: live.pnl.godownRevenue,
      totalPurchase: live.pnl.totalPurchase,
      availableStock: live.pnl.availableStock,
      godownStock: live.pnl.godownStock,
      vehicleStock: live.pnl.vehicleStock,
      cogs: live.pnl.cogs,
      vehicleCogs: live.pnl.vehicleCogs,
      godownCogs: live.pnl.godownCogs,
      totalExpenses: live.pnl.totalExpenses,
      netProfit: live.pnl.netProfit,
      openingStock: live.pnl.openingStock,
    });
    console.log('Valuation', {
      vehicleWeight: live.valuation.vehicleWeight,
      vehicleInventory: live.valuation.vehicleInventory,
      purchaseRate: live.valuation.purchaseRate,
    });

    allOk = assertClose('summary.currentStock', live.summary.currentStock, expected.godownRemainingBirds) && allOk;
    allOk = assertClose('summary.currentWeight', live.summary.currentWeight, expected.godownRemainingKg) && allOk;
    allOk = assertClose('summary.currentValue', live.summary.currentValue, expected.godownStockValue) && allOk;
    allOk = assertClose('pnl.totalPurchase', live.pnl.totalPurchase, expected.purchaseNet) && allOk;
    allOk = assertClose('pnl.poultryRevenue', live.pnl.poultryRevenue, expected.vehicleRevenue) && allOk;
    allOk = assertClose('pnl.godownRevenue', live.pnl.godownRevenue, expected.godownRevenue) && allOk;
    allOk = assertClose('pnl.totalRevenue', live.pnl.totalRevenue, expected.totalRevenue) && allOk;
    allOk = assertClose('pnl.godownStock', live.pnl.godownStock, expected.godownStockValue) && allOk;
    allOk = assertClose('pnl.vehicleStock', live.pnl.vehicleStock, expected.vehicleStockValue) && allOk;
    allOk = assertClose('pnl.availableStock', live.pnl.availableStock, expected.availableStock) && allOk;
    allOk = assertClose('pnl.vehicleCogs', live.pnl.vehicleCogs, expected.vehicleCogs) && allOk;
    allOk = assertClose('pnl.godownCogs', live.pnl.godownCogs, expected.godownCogs) && allOk;
    allOk = assertClose('pnl.cogs', live.pnl.cogs, expected.cogs) && allOk;
    allOk = assertClose('pnl.totalExpenses', live.pnl.totalExpenses, expected.totalExpenses) && allOk;
    allOk = assertClose('pnl.netProfit', live.pnl.netProfit, expected.netProfit) && allOk;
    allOk = assertClose('pnl.openingStock', live.pnl.openingStock, expected.openingStock) && allOk;
    allOk = assertClose('valuation.vehicleWeight', live.valuation.vehicleWeight, expected.vehicleRemainingKg) && allOk;
  } catch (err) {
    console.error('\nImport/live check failed:', err);
    allOk = false;
  } finally {
    if (client && tenantId && process.env.KEEP_VERIFY_DATA !== '1') {
      await cleanup(client, tenantId);
      console.log('\nCleaned up verify tenant (KEEP_VERIFY_DATA=1 to keep).');
    }
    if (client) await client.end().catch(() => {});
  }

  console.log(allOk ? '\nRESULT: full dataset matches live code.\n' : '\nRESULT: mismatch.\n');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
