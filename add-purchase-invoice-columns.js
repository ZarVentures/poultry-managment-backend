require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();
  console.log('Connected to DB');

  const columns = [
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS branch VARCHAR(100)`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS unit VARCHAR(100)`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS gstin VARCHAR(20)`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS lifting_time VARCHAR(50)`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS party_code VARCHAR(50)`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS pr_number VARCHAR(50)`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20) DEFAULT '0105'`,
  ];

  for (const sql of columns) {
    await client.query(sql);
    console.log('OK:', sql.split('ADD COLUMN IF NOT EXISTS')[1]?.trim().split(' ')[0]);
  }

  console.log('All columns added successfully');
  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
