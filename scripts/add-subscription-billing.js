const { Client } = require('pg');
require('dotenv').config({ path: '.env.stage' });
if (!process.env.DB_HOST && !process.env.DATABASE_URL) {
  require('dotenv').config({ path: '.env.staging' });
}
if (!process.env.DB_HOST && !process.env.DATABASE_URL) {
  require('dotenv').config({ path: '.env' });
}

function pgConfigFromEnv() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return { connectionString: databaseUrl, ssl: { rejectUnauthorized: false } };
  }
  return {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false,
  };
}

async function migrate() {
  const client = new Client(pgConfigFromEnv());
  await client.connect();
  console.log('Connected to database');

  await client.query(`
    ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS plan VARCHAR(50),
      ADD COLUMN IF NOT EXISTS billing_period VARCHAR(20),
      ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20),
      ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS current_period_ends_at TIMESTAMPTZ;
  `);
  console.log('Tenant subscription columns ready');

  await client.query(`
    UPDATE tenants
    SET subscription_status = 'active'
    WHERE subscription_status IS NULL;
  `);
  console.log('Existing tenants grandfathered as active');

  await client.query(`
    CREATE TABLE IF NOT EXISTS subscription_payments (
      id BIGSERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL REFERENCES tenants(id),
      plan VARCHAR(50) NOT NULL,
      billing_period VARCHAR(20) NOT NULL,
      amount_paise INTEGER NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      razorpay_order_id VARCHAR(100) NOT NULL,
      razorpay_payment_id VARCHAR(100),
      status VARCHAR(30) NOT NULL DEFAULT 'created',
      raw_payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('subscription_payments table ready');

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_order_uidx
      ON subscription_payments (razorpay_order_id);
    CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_payment_uidx
      ON subscription_payments (razorpay_payment_id)
      WHERE razorpay_payment_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS subscription_payments_tenant_idx
      ON subscription_payments (tenant_id);
  `);
  console.log('Indexes ready');

  await client.end();
  console.log('Subscription billing migration complete');
}

migrate().catch((err) => {
  console.error('Migration failed', err);
  process.exit(1);
});
