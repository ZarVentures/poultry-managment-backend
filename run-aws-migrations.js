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
]

async function run() {
  const ssl = DB_URL.includes('rds.amazonaws.com') || DB_URL.includes('render.com')
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
