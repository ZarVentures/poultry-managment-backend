require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();

  await client.query(`
    DO $$ BEGIN
      CREATE TYPE godown_status_enum AS ENUM ('active', 'inactive');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS godowns (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      code VARCHAR(50) NOT NULL,
      location VARCHAR(150),
      address TEXT,
      capacity_birds INTEGER,
      manager_name VARCHAR(150),
      phone VARCHAR(30),
      status godown_status_enum NOT NULL DEFAULT 'active',
      notes TEXT,
      tenant_id BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_godowns_tenant_code
      ON godowns (tenant_id, code);
  `);

  await client.query(`
    ALTER TABLE godown_inward_entries ADD COLUMN IF NOT EXISTS godown_id BIGINT;
    ALTER TABLE godown_sales ADD COLUMN IF NOT EXISTS godown_id BIGINT;
    ALTER TABLE godown_mortality ADD COLUMN IF NOT EXISTS godown_id BIGINT;
    ALTER TABLE godown_expenses ADD COLUMN IF NOT EXISTS godown_id BIGINT;
  `);

  await client.query(`
    INSERT INTO godowns (name, code, location, status, tenant_id)
    SELECT 'Default Godown', 'DEFAULT', 'Default', 'active', tenants.tenant_id
    FROM (
      SELECT DISTINCT tenant_id FROM godown_inward_entries
      UNION SELECT DISTINCT tenant_id FROM godown_sales
      UNION SELECT DISTINCT tenant_id FROM godown_mortality
      UNION SELECT DISTINCT tenant_id FROM godown_expenses
      UNION SELECT NULL::BIGINT AS tenant_id
    ) tenants
    WHERE NOT EXISTS (
      SELECT 1 FROM godowns g
      WHERE g.code = 'DEFAULT'
        AND COALESCE(g.tenant_id, 0) = COALESCE(tenants.tenant_id, 0)
    );
  `);

  for (const table of ['godown_inward_entries', 'godown_sales', 'godown_mortality', 'godown_expenses']) {
    await client.query(`
      UPDATE ${table} t
      SET godown_id = g.id
      FROM godowns g
      WHERE t.godown_id IS NULL
        AND g.code = 'DEFAULT'
        AND COALESCE(g.tenant_id, 0) = COALESCE(t.tenant_id, 0);
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_${table}_godown_id ON ${table} (godown_id);`);
  }

  await client.query(`
    WITH desired(role, resource, can_create, can_read, can_update, can_delete) AS (
      VALUES
        ('admin', 'godowns', true, true, true, true),
        ('manager', 'godowns', true, true, true, true),
        ('staff', 'godowns', false, true, false, false)
    ),
    updated AS (
      UPDATE role_permissions rp
      SET can_create = d.can_create,
          can_read = d.can_read,
          can_update = d.can_update,
          can_delete = d.can_delete,
          updated_at = NOW()
      FROM desired d
      WHERE rp.role = d.role
        AND rp.resource = d.resource
        AND rp.tenant_id IS NULL
      RETURNING rp.role, rp.resource
    )
    INSERT INTO role_permissions (role, resource, can_create, can_read, can_update, can_delete)
    SELECT d.role, d.resource, d.can_create, d.can_read, d.can_update, d.can_delete
    FROM desired d
    WHERE NOT EXISTS (
      SELECT 1
      FROM updated u
      WHERE u.role = d.role AND u.resource = d.resource
    )
    AND NOT EXISTS (
      SELECT 1
      FROM role_permissions rp
      WHERE rp.role = d.role
        AND rp.resource = d.resource
        AND rp.tenant_id IS NULL
    );
  `).catch((err) => {
    if (!String(err.message).includes('relation "role_permissions" does not exist')) throw err;
  });

  await client.query(`
    ALTER TABLE godown_inward_entries
      ADD CONSTRAINT fk_godown_inward_godown
      FOREIGN KEY (godown_id) REFERENCES godowns(id) ON DELETE SET NULL;
  `).catch((err) => {
    if (!String(err.message).includes('already exists')) throw err;
  });

  await client.query(`
    ALTER TABLE godown_sales
      ADD CONSTRAINT fk_godown_sales_godown
      FOREIGN KEY (godown_id) REFERENCES godowns(id) ON DELETE SET NULL;
  `).catch((err) => {
    if (!String(err.message).includes('already exists')) throw err;
  });

  await client.query(`
    ALTER TABLE godown_mortality
      ADD CONSTRAINT fk_godown_mortality_godown
      FOREIGN KEY (godown_id) REFERENCES godowns(id) ON DELETE SET NULL;
  `).catch((err) => {
    if (!String(err.message).includes('already exists')) throw err;
  });

  await client.query(`
    ALTER TABLE godown_expenses
      ADD CONSTRAINT fk_godown_expenses_godown
      FOREIGN KEY (godown_id) REFERENCES godowns(id) ON DELETE SET NULL;
  `).catch((err) => {
    if (!String(err.message).includes('already exists')) throw err;
  });

  await client.end();
  console.log('Multi-godown schema migration completed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
