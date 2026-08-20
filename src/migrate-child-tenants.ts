/**
 * Apply tenant_id to child/lookup tables that were missed by the first migration,
 * plus expense category tenant scoping.
 *
 * Usage:
 *   npx ts-node src/migrate-child-tenants.ts
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

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await AppDataSource.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [table, column],
  );
  return rows.length > 0;
}

async function constraintExists(name: string): Promise<boolean> {
  const rows = await AppDataSource.query(
    `SELECT conname FROM pg_constraint WHERE conname=$1`,
    [name],
  );
  return rows.length > 0;
}

async function main() {
  console.log('Connecting to database...');
  await AppDataSource.initialize();
  console.log('Connected.\n');

  // ── 1. Child tables fed from parents ──────────────────────────────────────
  const childTables: Array<{ table: string; parent: string; fk: string }> = [
    { table: 'sale_payments', parent: 'sales', fk: 'sale_id' },
    { table: 'purchase_order_items', parent: 'purchase_orders', fk: 'purchase_order_id' },
    { table: 'purchase_order_payments', parent: 'purchase_orders', fk: 'purchase_order_id' },
    { table: 'godown_sale_payments', parent: 'godown_sales', fk: 'godown_sale_id' },
  ];

  for (const { table, parent, fk } of childTables) {
    if (!(await columnExists(table, 'tenant_id'))) {
      console.log(`Adding tenant_id to ${table}...`);
      await AppDataSource.query(
        `ALTER TABLE ${table} ADD COLUMN tenant_id BIGINT`,
      );
    } else {
      console.log(`${table}.tenant_id already exists.`);
    }

    const missing = await AppDataSource.query(
      `SELECT COUNT(*)::int AS c FROM ${table} t
       WHERE t.tenant_id IS NULL AND t.${fk} IS NOT NULL`,
    );
    if (missing[0].c > 0) {
      console.log(`Backfilling ${missing[0].c} rows in ${table} from ${parent}.tenant_id...`);
      await AppDataSource.query(
        `UPDATE ${table} t
         SET tenant_id = p.tenant_id
         FROM ${parent} p
         WHERE p.id = t.${fk} AND t.tenant_id IS NULL`,
      );
    }
    if (!(await columnExists(table, 'tenant_id')) ) { /* noop */ }
  }

  // ── 2. Lookup / orphan tables: legacy data belongs to tenant 1 ────────────
  const lookupTables = [
    'failed_accounting_jobs',
    'communication_logs',
    'expense_categories',
  ];
  for (const table of lookupTables) {
    if (!(await columnExists(table, 'tenant_id'))) {
      console.log(`Adding tenant_id to ${table}...`);
      await AppDataSource.query(
        `ALTER TABLE ${table} ADD COLUMN tenant_id BIGINT`,
      );
    } else {
      console.log(`${table}.tenant_id already exists.`);
    }
    const missing = await AppDataSource.query(
      `SELECT COUNT(*)::int AS c FROM ${table} WHERE tenant_id IS NULL`,
    );
    if (missing[0].c > 0) {
      console.log(`Backfilling ${missing[0].c} rows in ${table} to tenant 1...`);
      await AppDataSource.query(
        `UPDATE ${table} SET tenant_id = 1 WHERE tenant_id IS NULL`,
      );
    }
  }

  // ── 3. audit_logs (entity has tenant_id; ensure column exists + backfill) ─
  if (!(await columnExists('audit_logs', 'tenant_id'))) {
    console.log('Adding tenant_id to audit_logs...');
    await AppDataSource.query(`ALTER TABLE audit_logs ADD COLUMN tenant_id BIGINT`);
  }
  const auditMissing = await AppDataSource.query(
    `SELECT COUNT(*)::int AS c FROM audit_logs WHERE tenant_id IS NULL`,
  );
  if (auditMissing[0].c > 0) {
    console.log(`Backfilling ${auditMissing[0].c} rows in audit_logs to tenant 1...`);
    await AppDataSource.query(`UPDATE audit_logs SET tenant_id = 1 WHERE tenant_id IS NULL`);
  }

  // ── 4. expense_categories: unique (tenant_id, name), drop global name unique ──
  const uqName = await AppDataSource.query(
    `SELECT c.conname,
            pg_get_constraintdef(c.oid) AS def
     FROM pg_constraint c
     JOIN pg_class r ON r.oid = c.conrelid AND r.relname='expense_categories'
     JOIN pg_namespace n ON n.oid = r.relnamespace AND n.nspname='public'
     WHERE c.contype='u'`,
  );
  for (const u of uqName) {
    if (u.conname && u.conname !== 'expense_categories_pkey') {
      const isNameOnly =
        u.def.toLowerCase().replace(/\s/g, '') === 'unique(name)';
      if (isNameOnly) {
        console.log(`Dropping global unique constraint ${u.conname} on expense_categories...`);
        await AppDataSource.query(`ALTER TABLE expense_categories DROP CONSTRAINT ${u.conname}`);
      }
    }
  }

  if (!(await constraintExists('expense_categories_tenant_name_uidx'))) {
    console.log('Creating unique index expense_categories_tenant_name_uidx...');
    await AppDataSource.query(
      `CREATE UNIQUE INDEX expense_categories_tenant_name_uidx
       ON expense_categories (tenant_id, name)`,
    );
  }

  // ── 5. Ensure tenant_id indexes on all newly-scoped tables ────────────────
  const indexedTables = [
    'sale_payments',
    'purchase_order_items',
    'purchase_order_payments',
    'godown_sale_payments',
    'failed_accounting_jobs',
    'communication_logs',
    'audit_logs',
    'expense_categories',
  ];
  for (const table of indexedTables) {
    const idx = `${table}_tenant_idx`;
    if (!(await constraintExists(idx))) {
      console.log(`Creating index ${idx}...`);
      await AppDataSource.query(`CREATE INDEX ${idx} ON ${table} (tenant_id)`);
    }
  }

  // ── 6. Verify final state ──────────────────────────────────────────────────
  console.log('\nVerification:');
  for (const table of [...childTables.map((t) => t.table), ...lookupTables, 'audit_logs']) {
    const r = await AppDataSource.query(
      `SELECT COUNT(*)::int AS total, COUNT(tenant_id)::int AS with_tenant FROM ${table}`,
    );
    console.log(`  ${table}: ${r[0].with_tenant}/${r[0].total} rows have tenant_id`);
  }

  console.log('\nMigration complete.');
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
