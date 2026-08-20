/**
 * Run this once to apply the multi-tenant (business) migration.
 *
 * - Creates the `tenants` table + a default tenant (id=1) for existing data
 * - Adds tenant_id to users + all business tables, backfilling existing rows to tenant 1
 * - Converts `settings` primary key to (tenant_id, key)
 *
 * Usage:
 *   npx ts-node src/migrate-multi-tenant.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || undefined,
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'poultry',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

// Tables that get a tenant_id column + backfill (child tables accessed via
// their parent are intentionally excluded).
const BUSINESS_TABLES = [
  'farmers',
  'retailers',
  'vehicles',
  'sales',
  'bird_returns',
  'vehicle_bird_returns',
  'purchase_orders',
  'expenses',
  'products',
  'inventory_items',
  'godown_inward_entries',
  'godown_sales',
  'godown_mortality',
  'godown_expenses',
  'mortalities',
  'cages',
  'billing_parties',
  'billing_payments',
  'billing_ledger',
  'payment_vouchers',
  'role_permissions',
  'user_permissions',
  'audit_logs',
];

async function main() {
  console.log('🔌 Connecting to database...');
  await AppDataSource.initialize();
  console.log('✅ Connected.');

  // ── Step 1: tenants table ────────────────────────────────────────────────
  console.log('\n📋 Step 1: Creating tenants table...');
  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id           BIGSERIAL PRIMARY KEY,
      name         VARCHAR(150) NOT NULL,
      type         VARCHAR(50),
      phone        VARCHAR(50),
      email        VARCHAR(150),
      address      TEXT,
      currency     VARCHAR(20) NOT NULL DEFAULT 'INR',
      country_code VARCHAR(10) NOT NULL DEFAULT '+91',
      status       VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('   ✅ tenants table ready.');

  // Default tenant for all legacy data
  await AppDataSource.query(`
    INSERT INTO tenants (id, name)
    SELECT 1, COALESCE((SELECT value FROM settings WHERE key = 'farmName' LIMIT 1), 'Default Business')
    ON CONFLICT (id) DO NOTHING;
  `);
  console.log('   ✅ Default tenant (id=1) ready.');

  // ── Step 2: users.tenant_id ──────────────────────────────────────────────
  console.log('\n📋 Step 2: Adding tenant_id to users...');
  await AppDataSource.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
  `);
  await AppDataSource.query(`
    UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL;
  `);
  await AppDataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_users_tenant ON users (tenant_id);
  `);
  console.log('   ✅ users scoped.');

  // ── Step 3: business tables ──────────────────────────────────────────────
  console.log('\n📋 Step 3: Adding tenant_id to business tables...');
  for (const table of BUSINESS_TABLES) {
    try {
      await AppDataSource.query(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS tenant_id BIGINT;`
      );
      await AppDataSource.query(
        `UPDATE ${table} SET tenant_id = 1 WHERE tenant_id IS NULL;`
      );
      await AppDataSource.query(
        `CREATE INDEX IF NOT EXISTS idx_${table}_tenant ON ${table} (tenant_id);`
      );
      console.log(`   ✅ ${table}`);
    } catch (err: any) {
      console.log(`   ⚠️  ${table} skipped: ${err.message}`);
    }
  }

  // ── Step 4: settings composite primary key ───────────────────────────────
  console.log('\n📋 Step 4: Settings → (tenant_id, key) primary key...');
  await AppDataSource.query(`
    ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;
  `);
  await AppDataSource.query(`
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1;
  `);
  await AppDataSource.query(`
    ALTER TABLE settings ADD PRIMARY KEY (tenant_id, key);
  `).catch((err: any) => {
    console.log(`   ⚠️  composite PK already present: ${err.message}`);
  });
  console.log('   ✅ settings scoped.');

  console.log('\n🎉 Multi-tenant migration complete! Restart the backend to pick up the new module.');
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});