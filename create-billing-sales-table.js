// Migration: Create billing_sales table
require('dotenv').config();
const { Client } = require('pg');

async function createBillingSalesTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    await client.query(`
      CREATE TABLE IF NOT EXISTS billing_sales (
        id BIGSERIAL PRIMARY KEY,
        party_id BIGINT NOT NULL,
        date DATE NOT NULL,
        birds INTEGER DEFAULT 0,
        net_weight NUMERIC(10,2) DEFAULT 0,
        avg_weight NUMERIC(10,2) DEFAULT 0,
        rate NUMERIC(10,2) DEFAULT 0,
        discount NUMERIC(14,2) DEFAULT 0,
        total_amount NUMERIC(14,2) DEFAULT 0,
        vehicle_no VARCHAR(50),
        remarks TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT fk_billing_sales_party FOREIGN KEY (party_id) REFERENCES billing_parties(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ billing_sales table created');
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

createBillingSalesTable();
