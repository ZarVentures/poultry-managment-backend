/**
 * AWS DB Migration Script
 * Run this on the AWS server after git pull:
 *   node run-aws-migrations.js
 *
 * Safely adds all missing columns/tables without touching existing data.
 */

const { Client } = require('pg')
require('dotenv').config()

const DB_URL = process.env.DATABASE_URL || `postgresql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`

const migrations = [
  // ── farmers ──────────────────────────────────────────────────
  {
    name: 'farmers.farmhouse_name',
    sql: `ALTER TABLE farmers ADD COLUMN IF NOT EXISTS farmhouse_name VARCHAR(150)`,
  },

  // ── purchase_order_items ──────────────────────────────────────
  {
    name: 'create purchase_order_items',
    sql: `CREATE TABLE IF NOT EXISTS purchase_order_items (
      id BIGSERIAL PRIMARY KEY,
      purchase_order_id BIGINT REFERENCES purchase_orders(id) ON DELETE CASCADE,
      description VARCHAR(255),
      quantity NUMERIC(14,2) DEFAULT 0,
      unit VARCHAR(20),
      unit_cost NUMERIC(14,2) DEFAULT 0,
      line_total NUMERIC(14,2) DEFAULT 0
    )`,
  },

  // ── purchase_order_cages ──────────────────────────────────────
  {
    name: 'create purchase_order_cages',
    sql: `CREATE TABLE IF NOT EXISTS purchase_order_cages (
      id BIGSERIAL PRIMARY KEY,
      purchase_order_id BIGINT REFERENCES purchase_orders(id) ON DELETE CASCADE,
      cage_id VARCHAR(50),
      bird_type VARCHAR(50),
      number_of_birds INTEGER DEFAULT 0,
      cage_weight NUMERIC(10,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },

  // ── purchase_orders extra columns ────────────────────────────
  { name: 'purchase_orders.branch',             sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS branch VARCHAR(100)` },
  { name: 'purchase_orders.unit',               sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS unit VARCHAR(100)` },
  { name: 'purchase_orders.gstin',              sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS gstin VARCHAR(50)` },
  { name: 'purchase_orders.lifting_time',       sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS lifting_time VARCHAR(20)` },
  { name: 'purchase_orders.party_code',         sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS party_code VARCHAR(50)` },
  { name: 'purchase_orders.pr_number',          sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS pr_number VARCHAR(50)` },
  { name: 'purchase_orders.hsn_code',           sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20) DEFAULT '0105'` },
  { name: 'purchase_orders.farmer_id',          sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS farmer_id BIGINT` },
  { name: 'purchase_orders.farmer_mobile',      sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS farmer_mobile VARCHAR(50)` },
  { name: 'purchase_orders.farm_location',      sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS farm_location TEXT` },
  { name: 'purchase_orders.vehicle_id',         sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vehicle_id BIGINT` },
  { name: 'purchase_orders.bird_type',          sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS bird_type VARCHAR(50)` },
  { name: 'purchase_orders.total_weight',       sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS total_weight NUMERIC(14,2) DEFAULT 0` },
  { name: 'purchase_orders.rate_per_kg',        sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rate_per_kg NUMERIC(10,2) DEFAULT 0` },
  { name: 'purchase_orders.transport_charges',  sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS transport_charges NUMERIC(10,2) DEFAULT 0` },
  { name: 'purchase_orders.loading_charges',    sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS loading_charges NUMERIC(10,2) DEFAULT 0` },
  { name: 'purchase_orders.commission',         sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS commission NUMERIC(10,2) DEFAULT 0` },
  { name: 'purchase_orders.other_charges',      sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS other_charges NUMERIC(10,2) DEFAULT 0` },
  { name: 'purchase_orders.weight_shortage',    sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS weight_shortage NUMERIC(10,2) DEFAULT 0` },
  { name: 'purchase_orders.mortality_deduction',sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS mortality_deduction NUMERIC(10,2) DEFAULT 0` },
  { name: 'purchase_orders.other_deduction',    sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS other_deduction NUMERIC(10,2) DEFAULT 0` },
  { name: 'purchase_orders.gross_amount',       sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(14,2) DEFAULT 0` },
  { name: 'purchase_orders.net_amount',         sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS net_amount NUMERIC(14,2) DEFAULT 0` },
  { name: 'purchase_orders.purchase_payment_status', sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS purchase_payment_status VARCHAR(20) DEFAULT 'pending'` },
  { name: 'purchase_orders.advance_paid',       sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS advance_paid NUMERIC(14,2) DEFAULT 0` },
  { name: 'purchase_orders.outstanding_payment',sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS outstanding_payment NUMERIC(14,2) DEFAULT 0` },
  { name: 'purchase_orders.payment_mode',       sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50)` },
  { name: 'purchase_orders.total_payment_made', sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS total_payment_made NUMERIC(14,2) DEFAULT 0` },
  { name: 'purchase_orders.balance_amount',     sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(14,2) DEFAULT 0` },
  { name: 'purchase_orders.invoice_attachment', sql: `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS invoice_attachment TEXT` },

  // ── inventory_items ───────────────────────────────────────────
  {
    name: 'create inventory_items',
    sql: `CREATE TABLE IF NOT EXISTS inventory_items (
      id SERIAL PRIMARY KEY,
      item_type VARCHAR(50) NOT NULL,
      item_name VARCHAR(150) NOT NULL,
      quantity DECIMAL(14,2) DEFAULT 0,
      unit VARCHAR(20) NOT NULL,
      minimum_stock_level DECIMAL(14,2) DEFAULT 0,
      current_stock_level DECIMAL(10,2) DEFAULT 0,
      notes TEXT,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },

  // ── mortalities ───────────────────────────────────────────────
  {
    name: 'create mortalities',
    sql: `CREATE TABLE IF NOT EXISTS mortalities (
      id BIGSERIAL PRIMARY KEY,
      record_number VARCHAR(50) UNIQUE NOT NULL,
      purchase_order_id BIGINT,
      purchase_invoice_no VARCHAR(50) NOT NULL,
      purchase_date DATE NOT NULL,
      farmer_name VARCHAR(150) NOT NULL,
      farm_location TEXT,
      cage_id_number VARCHAR(50),
      total_birds_purchased INTEGER DEFAULT 0,
      number_of_birds_died INTEGER NOT NULL,
      cause TEXT NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },
  { name: 'mortalities.purchase_order_id col', sql: `ALTER TABLE mortalities ADD COLUMN IF NOT EXISTS purchase_order_id BIGINT` },

  // ── user_permissions ──────────────────────────────────────────
  {
    name: 'create user_permissions',
    sql: `CREATE TABLE IF NOT EXISTS user_permissions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      permission_name VARCHAR(100) NOT NULL,
      resource VARCHAR(100) NOT NULL,
      can_create BOOLEAN DEFAULT false,
      can_read BOOLEAN DEFAULT true,
      can_update BOOLEAN DEFAULT false,
      can_delete BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },

  // ── role_permissions ──────────────────────────────────────────
  {
    name: 'create role_permissions',
    sql: `CREATE TABLE IF NOT EXISTS role_permissions (
      id BIGSERIAL PRIMARY KEY,
      role VARCHAR(50) NOT NULL,
      permission_name VARCHAR(100) NOT NULL,
      resource VARCHAR(100) NOT NULL,
      can_create BOOLEAN DEFAULT false,
      can_read BOOLEAN DEFAULT true,
      can_update BOOLEAN DEFAULT false,
      can_delete BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },

  // ── settings ──────────────────────────────────────────────────
  {
    name: 'create settings',
    sql: `CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      key VARCHAR(100) UNIQUE NOT NULL,
      value TEXT,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },

  // ── audit_logs ────────────────────────────────────────────────
  {
    name: 'create audit_logs',
    sql: `CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT,
      action VARCHAR(50) NOT NULL,
      entity VARCHAR(100),
      entity_id VARCHAR(50),
      changes JSONB,
      ip_address VARCHAR(50),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },

  // ── godown tables ─────────────────────────────────────────────
  {
    name: 'create godown_inward_entries',
    sql: `CREATE TABLE IF NOT EXISTS godown_inward_entries (
      id BIGSERIAL PRIMARY KEY,
      entry_number VARCHAR(50) UNIQUE NOT NULL,
      entry_date DATE NOT NULL,
      source VARCHAR(100),
      item_type VARCHAR(50),
      quantity NUMERIC(14,2) DEFAULT 0,
      unit VARCHAR(20),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },
  {
    name: 'create godown_sales',
    sql: `CREATE TABLE IF NOT EXISTS godown_sales (
      id BIGSERIAL PRIMARY KEY,
      sale_number VARCHAR(50) UNIQUE NOT NULL,
      sale_date DATE NOT NULL,
      customer_name VARCHAR(150),
      item_type VARCHAR(50),
      quantity NUMERIC(14,2) DEFAULT 0,
      unit VARCHAR(20),
      unit_price NUMERIC(14,2) DEFAULT 0,
      total_amount NUMERIC(14,2) DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },
  {
    name: 'create godown_mortalities',
    sql: `CREATE TABLE IF NOT EXISTS godown_mortalities (
      id BIGSERIAL PRIMARY KEY,
      record_number VARCHAR(50) UNIQUE NOT NULL,
      record_date DATE NOT NULL,
      item_type VARCHAR(50),
      quantity NUMERIC(14,2) DEFAULT 0,
      cause TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },
  {
    name: 'create godown_expenses',
    sql: `CREATE TABLE IF NOT EXISTS godown_expenses (
      id BIGSERIAL PRIMARY KEY,
      expense_number VARCHAR(50) UNIQUE NOT NULL,
      expense_date DATE NOT NULL,
      category VARCHAR(100),
      amount NUMERIC(14,2) DEFAULT 0,
      description TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },

  // ── products ──────────────────────────────────────────────────
  {
    name: 'create products',
    sql: `CREATE TABLE IF NOT EXISTS products (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      description TEXT,
      unit VARCHAR(20),
      price NUMERIC(14,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },

  // ── sales extra columns ───────────────────────────────────────
  { name: 'sales.sale_mode',           sql: `ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_mode VARCHAR(20) DEFAULT 'from_vehicle'` },
  { name: 'sales.weight_shortage',     sql: `ALTER TABLE sales ADD COLUMN IF NOT EXISTS weight_shortage NUMERIC(10,2) DEFAULT 0` },
  { name: 'sales.mortality_deduction', sql: `ALTER TABLE sales ADD COLUMN IF NOT EXISTS mortality_deduction NUMERIC(10,2) DEFAULT 0` },
  { name: 'sales.other_deduction',     sql: `ALTER TABLE sales ADD COLUMN IF NOT EXISTS other_deduction NUMERIC(10,2) DEFAULT 0` },
  { name: 'sales.gross_amount',        sql: `ALTER TABLE sales ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(14,2) DEFAULT 0` },
  { name: 'sales.net_amount',          sql: `ALTER TABLE sales ADD COLUMN IF NOT EXISTS net_amount NUMERIC(14,2) DEFAULT 0` },
  { name: 'sales.retailer_id',         sql: `ALTER TABLE sales ADD COLUMN IF NOT EXISTS retailer_id BIGINT` },
  { name: 'sales.sale_attachment',     sql: `ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_attachment TEXT` },
  { name: 'sales.weight_shortage_kg', sql: `ALTER TABLE sales ADD COLUMN IF NOT EXISTS weight_shortage_kg NUMERIC(10,2) DEFAULT 0` },
  { name: 'sales.backfill_weight_shortage_kg', sql: `UPDATE sales SET weight_shortage_kg = weight_shortage / NULLIF(unit_price, 0) WHERE (weight_shortage_kg IS NULL OR weight_shortage_kg = 0) AND weight_shortage > 0 AND unit_price > 0` },

  // ── PG extensions ─────────────────────────────────────────────
  {
    name: 'enable pgcrypto extension',
    sql: `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,
  },

  // ── Custom PG Enum Types ──────────────────────────────────────
  {
    name: 'create return_reason_type enum',
    sql: `DO $$ BEGIN
      CREATE TYPE return_reason_type AS ENUM ('dead', 'sick', 'underweight', 'quality_issue', 'customer_request', 'other');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,
  },
  {
    name: 'create return_status_type enum',
    sql: `DO $$ BEGIN
      CREATE TYPE return_status_type AS ENUM ('pending', 'approved', 'rejected', 'processed');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,
  },

  // ── billing_parties ───────────────────────────────────────────
  {
    name: 'create billing_parties',
    sql: `CREATE TABLE IF NOT EXISTS billing_parties (
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
    )`,
  },

  // ── billing_sales ─────────────────────────────────────────────
  {
    name: 'create billing_sales',
    sql: `CREATE TABLE IF NOT EXISTS billing_sales (
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
    )`,
  },

  // ── billing_payments ──────────────────────────────────────────
  {
    name: 'create billing_payments',
    sql: `CREATE TABLE IF NOT EXISTS billing_payments (
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
    )`,
  },

  // ── billing_ledger ────────────────────────────────────────────
  {
    name: 'create billing_ledger',
    sql: `CREATE TABLE IF NOT EXISTS billing_ledger (
      id BIGSERIAL PRIMARY KEY,
      party_id BIGINT NOT NULL REFERENCES billing_parties(id) ON DELETE CASCADE,
      reference_type VARCHAR(20) NOT NULL,
      reference_id VARCHAR(50),
      debit NUMERIC(14, 2) NOT NULL DEFAULT 0,
      credit NUMERIC(14, 2) NOT NULL DEFAULT 0,
      balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
      date DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },

  // ── expense_categories ────────────────────────────────────────
  {
    name: 'create expense_categories',
    sql: `CREATE TABLE IF NOT EXISTS expense_categories (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      icon VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      is_system BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },
  {
    name: 'seed default expense categories',
    sql: `INSERT INTO expense_categories (name, description, icon, is_system) VALUES
      ('Feed', 'Animal feed and nutrition', '🌾', true),
      ('Labor', 'Labor and wages', '👷', true),
      ('Medicine', 'Veterinary medicine and healthcare', '💊', true),
      ('Utilities', 'Electricity, water, and other utilities', '💡', true),
      ('Equipment', 'Equipment purchase and rental', '🔧', true),
      ('Maintenance', 'Repairs and maintenance', '🔨', true),
      ('Transportation', 'Vehicle and transportation costs', '🚚', true),
      ('Other', 'Miscellaneous expenses', '📝', true)
      ON CONFLICT (name) DO NOTHING`,
  },
  {
    name: 'expenses.category_id referencing expense_categories',
    sql: `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES expense_categories(id)`,
  },
  {
    name: 'migrate existing expenses category column values to category_id',
    sql: `DO $$ BEGIN
      UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'Feed') WHERE category = 'feed' AND category_id IS NULL;
      UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'Labor') WHERE category = 'labor' AND category_id IS NULL;
      UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'Medicine') WHERE category = 'medicine' AND category_id IS NULL;
      UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'Utilities') WHERE category = 'utilities' AND category_id IS NULL;
      UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'Equipment') WHERE category = 'equipment' AND category_id IS NULL;
      UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'Maintenance') WHERE category = 'maintenance' AND category_id IS NULL;
      UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'Transportation') WHERE category = 'transportation' AND category_id IS NULL;
      UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'Other') WHERE category = 'other' AND category_id IS NULL;
    END $$;`,
  },

  // ── godown_sales column ───────────────────────────────────────
  {
    name: 'godown_sales.sale_no column',
    sql: `ALTER TABLE godown_sales ADD COLUMN IF NOT EXISTS sale_no VARCHAR(50)`,
  },

  // ── godown_inward_entries columns ─────────────────────────────
  {
    name: 'godown_inward_entries.actual_weight column',
    sql: `ALTER TABLE godown_inward_entries ADD COLUMN IF NOT EXISTS actual_weight NUMERIC(10,2)`,
  },
  {
    name: 'godown_inward_entries.weight_loss column',
    sql: `ALTER TABLE godown_inward_entries ADD COLUMN IF NOT EXISTS weight_loss NUMERIC(10,2) NOT NULL DEFAULT 0`,
  },

  // ── sales column ──────────────────────────────────────────────
  {
    name: 'sales.number_of_birds column',
    sql: `ALTER TABLE sales ADD COLUMN IF NOT EXISTS number_of_birds INTEGER DEFAULT 0`,
  },

  // ── payment_vouchers ──────────────────────────────────────────
  {
    name: 'create payment_vouchers',
    sql: `CREATE TABLE IF NOT EXISTS payment_vouchers (
      id SERIAL PRIMARY KEY,
      voucher_number VARCHAR(50) UNIQUE NOT NULL,
      voucher_date DATE NOT NULL,
      payee_type VARCHAR(20) NOT NULL CHECK (payee_type IN ('farmer', 'retailer', 'supplier', 'employee', 'other')),
      payee_id INTEGER,
      payee_name VARCHAR(255) NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'cheque', 'bank_transfer', 'upi', 'card')),
      cheque_number VARCHAR(50),
      bank_name VARCHAR(100),
      transaction_reference VARCHAR(100),
      purpose VARCHAR(255) NOT NULL,
      description TEXT,
      reference_type VARCHAR(20) CHECK (reference_type IN ('purchase', 'expense', 'sale', 'other')),
      reference_id INTEGER,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
      paid_date DATE,
      attachment_url VARCHAR(500),
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      approved_by INTEGER REFERENCES users(id),
      approved_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    name: 'create payment_vouchers indexes',
    sql: `DO $$ BEGIN
      CREATE INDEX IF NOT EXISTS idx_payment_vouchers_voucher_number ON payment_vouchers(voucher_number);
      CREATE INDEX IF NOT EXISTS idx_payment_vouchers_voucher_date ON payment_vouchers(voucher_date);
      CREATE INDEX IF NOT EXISTS idx_payment_vouchers_payee_type ON payment_vouchers(payee_type);
      CREATE INDEX IF NOT EXISTS idx_payment_vouchers_status ON payment_vouchers(status);
      CREATE INDEX IF NOT EXISTS idx_payment_vouchers_reference ON payment_vouchers(reference_type, reference_id);
    END $$;`,
  },

  // ── communication_logs ────────────────────────────────────────
  {
    name: 'create communication_logs',
    sql: `CREATE TABLE IF NOT EXISTS communication_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recipient VARCHAR(150) NOT NULL,
      channel VARCHAR(20) NOT NULL,
      "messageType" VARCHAR(50) NOT NULL,
      "contentPreview" TEXT,
      status VARCHAR(20) NOT NULL,
      "errorMessage" TEXT,
      sent_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },

  // ── bird_returns ──────────────────────────────────────────────
  {
    name: 'create bird_returns',
    sql: `CREATE TABLE IF NOT EXISTS bird_returns (
      id BIGSERIAL PRIMARY KEY,
      return_number VARCHAR(50) UNIQUE NOT NULL,
      return_date DATE NOT NULL,
      sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      customer_name VARCHAR(150) NOT NULL,
      retailer_id BIGINT REFERENCES retailers(id) ON DELETE SET NULL,
      number_of_birds_returned INTEGER NOT NULL,
      weight_returned NUMERIC(10, 2),
      return_reason return_reason_type NOT NULL,
      reason_description TEXT,
      refund_amount NUMERIC(14, 2) DEFAULT 0,
      adjustment_amount NUMERIC(14, 2) DEFAULT 0,
      status return_status_type DEFAULT 'pending',
      returned_to_inventory BOOLEAN DEFAULT false,
      inventory_location VARCHAR(100),
      approved_by VARCHAR(150),
      approved_at TIMESTAMPTZ,
      processed_by VARCHAR(150),
      processed_at TIMESTAMPTZ,
      notes TEXT,
      attachment_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },
  {
    name: 'create bird_returns indexes',
    sql: `DO $$ BEGIN
      CREATE INDEX IF NOT EXISTS idx_bird_returns_sale_id ON bird_returns(sale_id);
      CREATE INDEX IF NOT EXISTS idx_bird_returns_retailer_id ON bird_returns(retailer_id);
      CREATE INDEX IF NOT EXISTS idx_bird_returns_return_date ON bird_returns(return_date);
      CREATE INDEX IF NOT EXISTS idx_bird_returns_status ON bird_returns(status);
      CREATE INDEX IF NOT EXISTS idx_bird_returns_return_number ON bird_returns(return_number);
    END $$;`,
  },

  // ── vehicle_bird_returns ──────────────────────────────────────
  {
    name: 'create vehicle_bird_returns',
    sql: `CREATE TABLE IF NOT EXISTS vehicle_bird_returns (
      id BIGSERIAL PRIMARY KEY,
      return_number VARCHAR(50) UNIQUE NOT NULL,
      return_date DATE NOT NULL,
      sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      customer_name VARCHAR(150) NOT NULL,
      retailer_id BIGINT REFERENCES retailers(id) ON DELETE SET NULL,
      number_of_birds_returned INTEGER NOT NULL,
      weight_returned NUMERIC(10, 2),
      return_reason return_reason_type NOT NULL,
      reason_description TEXT,
      refund_amount NUMERIC(14, 2) DEFAULT 0,
      adjustment_amount NUMERIC(14, 2) DEFAULT 0,
      status return_status_type DEFAULT 'pending',
      returned_to_inventory BOOLEAN DEFAULT false,
      inventory_location VARCHAR(100),
      approved_by VARCHAR(150),
      approved_at TIMESTAMPTZ,
      processed_by VARCHAR(150),
      processed_at TIMESTAMPTZ,
      notes TEXT,
      attachment_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },
  {
    name: 'create vehicle_bird_returns indexes',
    sql: `DO $$ BEGIN
      CREATE INDEX IF NOT EXISTS idx_vehicle_returns_sale_id ON vehicle_bird_returns(sale_id);
      CREATE INDEX IF NOT EXISTS idx_vehicle_returns_retailer_id ON vehicle_bird_returns(retailer_id);
      CREATE INDEX IF NOT EXISTS idx_vehicle_returns_return_date ON vehicle_bird_returns(return_date);
      CREATE INDEX IF NOT EXISTS idx_vehicle_returns_status ON vehicle_bird_returns(status);
      CREATE INDEX IF NOT EXISTS idx_vehicle_returns_return_number ON vehicle_bird_returns(return_number);
    END $$;`,
  },

  // ── Extra Staging Gaps ────────────────────────────────────────
  {
    name: 'godown_sales.weight_loss column',
    sql: `ALTER TABLE godown_sales ADD COLUMN IF NOT EXISTS weight_loss NUMERIC(10,2) DEFAULT 0`,
  },
  {
    name: 'godown_inward_entries.inward_no column',
    sql: `ALTER TABLE godown_inward_entries ADD COLUMN IF NOT EXISTS inward_no VARCHAR(50)`,
  },
  {
    name: 'expense_categories.is_default column',
    sql: `ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false`,
  },
  {
    name: 'expense_categories.sort_order column',
    sql: `ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`,
  },
  {
    name: 'expense_categories.applies_to column',
    sql: `ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS applies_to VARCHAR(50) DEFAULT 'both'`,
  },
]

async function run() {
  const ssl = DB_URL.includes('rds.amazonaws.com')
    ? { rejectUnauthorized: false }
    : false

  const client = new Client({ connectionString: DB_URL, ssl })

  try {
    console.log('Connecting to database...')
    await client.connect()
    console.log('Connected.\n')

    let passed = 0, failed = 0

    for (const m of migrations) {
      try {
        await client.query(m.sql)
        console.log(`  ✓ ${m.name}`)
        passed++
      } catch (err) {
        console.log(`  ✗ ${m.name}: ${err.message}`)
        failed++
      }
    }

    console.log(`\n========================================`)
    console.log(`Done! ${passed} passed, ${failed} failed`)
    console.log(`========================================`)
  } finally {
    await client.end()
  }
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
