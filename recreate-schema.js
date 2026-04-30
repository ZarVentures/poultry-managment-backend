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
  console.log('✅ Connected to AWS RDS\n');

  // ── STEP 1: Clear all data except users ──────────────────────
  console.log('🗑  Clearing all data (keeping users)...');
  await client.q