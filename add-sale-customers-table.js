const { Client } = require('pg');

const DB = {
  host: 'poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com',
  port: 5432,
  user: 'poultry_user',
  password: 'poultry_user1212',
  database: 'poultry',
  ssl: { rejectUnauthorized: false },
};

async function run() {
  const client = new Client(DB);
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS sale_customers (
      id BIGSERIAL PRIMARY KEY,
      sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      customer_name VARCHAR(150) NOT NULL,
      num_birds INTEGER NOT NULL DEFAULT 0,
      weight NUMERIC(10,2) NOT NULL DEFAULT 0,
      rate_per_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
      amount NUMERIC(14,2) GENERATED ALWAYS AS (weight * rate_per_kg) STORED,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sale_customers_sale_id ON sale_customers(sale_id);
  `);

  // Also update sales table: add total_birds and total_weight columns if missing
  await client.query(`
    ALTER TABLE sales
      ADD COLUMN IF NOT EXISTS total_birds INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_weight NUMERIC(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS average_weight NUMERIC(10,2) GENERATED ALWAYS AS (
        CASE WHEN total_birds > 0 THEN ROUND(total_weight / total_birds, 3) ELSE 0 END
      ) STORED;
  `);

  console.log('✅ sale_customers table created');
  console.log('✅ sales table updated with total_birds, total_weight, average_weight');
  await client.end();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
