const { Client } = require('pg');

const SSL = { rejectUnauthorized: false };
const HOST = 'poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com';
const USER = 'poultry_user';
const PASS = 'poultry_user1212';

async function runCheck() {
  const stage = new Client({ host: HOST, port: 5432, database: 'poultry_stage', user: USER, password: PASS, ssl: SSL });
  const prod = new Client({ host: HOST, port: 5432, database: 'poultry', user: USER, password: PASS, ssl: SSL });

  await stage.connect();
  await prod.connect();

  console.log('🔍 === DATABASE INSPECTION SCRIPT === 🔍\n');

  // Auto-create billing tables in staging if missing
  const checkBillingParties = await stage.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_parties'`);
  if (checkBillingParties.rows.length === 0) {
    console.log('🛠️ Staging database is missing billing tables. Creating them automatically...');
    try {
      await stage.query(`
        CREATE TABLE IF NOT EXISTS billing_parties (
          id BIGSERIAL PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          type VARCHAR(20) NOT NULL DEFAULT 'Retailer',
          phone VARCHAR(20),
          address TEXT,
          opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
          current_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
          credit_limit NUMERIC(14, 2) NOT NULL DEFAULT 0,
          payment_terms INTEGER NOT NULL DEFAULT 30,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await stage.query(`
        CREATE TABLE IF NOT EXISTS billing_sales (
          id BIGSERIAL PRIMARY KEY,
          party_id BIGINT NOT NULL REFERENCES billing_parties(id) ON DELETE CASCADE,
          date DATE NOT NULL,
          birds INTEGER NOT NULL DEFAULT 0,
          net_weight NUMERIC(10, 2) NOT NULL DEFAULT 0,
          avg_weight NUMERIC(10, 2) NOT NULL DEFAULT 0,
          rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
          discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
          total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
          vehicle_no VARCHAR(50),
          remarks TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await stage.query(`
        CREATE TABLE IF NOT EXISTS billing_payments (
          id BIGSERIAL PRIMARY KEY,
          party_id BIGINT NOT NULL REFERENCES billing_parties(id) ON DELETE CASCADE,
          date DATE NOT NULL,
          mode VARCHAR(20) NOT NULL DEFAULT 'Cash',
          amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
          reference VARCHAR(100),
          remarks TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'Pending',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await stage.query(`
        CREATE TABLE IF NOT EXISTS billing_ledger (
          id BIGSERIAL PRIMARY KEY,
          party_id BIGINT NOT NULL REFERENCES billing_parties(id) ON DELETE CASCADE,
          reference_type VARCHAR(20) NOT NULL,
          reference_id VARCHAR(50),
          debit NUMERIC(14, 2) NOT NULL DEFAULT 0,
          credit NUMERIC(14, 2) NOT NULL DEFAULT 0,
          balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
          date DATE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      console.log('✅ Billing tables successfully created in staging database!\n');
    } catch (err) {
      console.log(`❌ Error auto-creating billing tables: ${err.message}\n`);
    }
  } else {
    console.log('✅ Billing tables already exist in staging.\n');
  }

  // 1. Table Counts Comparison
  console.log('📊 --- TABLE ROW COUNTS COMPARISON ---');
  const tables = ['farmers', 'purchase_orders', 'purchase_order_payments', 'cages', 'sales', 'sale_payments', 'billing_parties', 'billing_sales', 'billing_payments', 'billing_ledger'];
  for (const table of tables) {
    try {
      const prodRes = await prod.query(`SELECT COUNT(*) FROM "${table}"`);
      const stageRes = await stage.query(`SELECT COUNT(*) FROM "${table}"`);
      console.log(`   📦 ${table.padEnd(25)}: PROD = ${prodRes.rows[0].count.padStart(5)} rows | STAGE = ${stageRes.rows[0].count.padStart(5)} rows`);
    } catch (e) {
      // If table is not in prod, just show staging count
      try {
        const stageRes = await stage.query(`SELECT COUNT(*) FROM "${table}"`);
        console.log(`   📦 ${table.padEnd(25)}: PROD = (no table) | STAGE = ${stageRes.rows[0].count.padStart(5)} rows`);
      } catch (e2) {
        console.log(`   📦 ${table.padEnd(25)}: ERROR checking count: ${e.message}`);
      }
    }
  }

  // 2. Search for Wahid
  console.log('\n👤 --- SEARCHING FOR "WAHID" ---');
  try {
    const wahidFarmersProd = await prod.query(`SELECT id, name FROM farmers WHERE LOWER(name) LIKE '%wahid%'`);
    console.log('   PROD farmers matching "wahid":');
    wahidFarmersProd.rows.forEach(r => console.log(`     - [ID: ${r.id}] ${r.name}`));

    const wahidFarmersStage = await stage.query(`SELECT id, name FROM farmers WHERE LOWER(name) LIKE '%wahid%'`);
    console.log('   STAGE farmers matching "wahid":');
    wahidFarmersStage.rows.forEach(r => console.log(`     - [ID: ${r.id}] ${r.name}`));

    const wahidPurchasesProd = await prod.query(`SELECT DISTINCT supplier_name FROM purchase_orders WHERE LOWER(supplier_name) LIKE '%wahid%'`);
    console.log('   PROD purchase order suppliers matching "wahid":');
    wahidPurchasesProd.rows.forEach(r => console.log(`     - ${r.supplier_name}`));

    const wahidPurchasesStage = await stage.query(`SELECT DISTINCT supplier_name FROM purchase_orders WHERE LOWER(supplier_name) LIKE '%wahid%'`);
    console.log('   STAGE purchase order suppliers matching "wahid":');
    wahidPurchasesStage.rows.forEach(r => console.log(`     - ${r.supplier_name}`));
  } catch (e) {
    console.log(`   ⚠️ Error searching for Wahid: ${e.message}`);
  }

  // 3. Distinct Suppliers List
  console.log('\n🧾 --- DISTINCT SUPPLIERS IN STAGE PURCHASE_ORDERS ---');
  try {
    const suppliers = await stage.query(`SELECT DISTINCT supplier_name FROM purchase_orders ORDER BY supplier_name LIMIT 20`);
    if (suppliers.rows.length === 0) {
      console.log('   (No purchase orders found in staging yet)');
    } else {
      suppliers.rows.forEach(r => console.log(`     - ${r.supplier_name}`));
      if (suppliers.rows.length === 20) {
        console.log('     ... (truncated list)');
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Error listing suppliers: ${e.message}`);
  }

  console.log('\n=======================================');
  await stage.end();
  await prod.end();
}

runCheck().catch(console.error);
