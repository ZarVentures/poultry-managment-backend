/**
 * add-admin-users.js
 *
 * 1. Adds session_token column to users table (if not exists)
 * 2. Creates 3 separate admin accounts for your friends
 *
 * Run: node add-admin-users.js
 */

require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');

const DB_URL = process.env.DATABASE_URL;

// ── 3 admin accounts ──────────────────────────────────────────────────────────
const ADMINS = [
  {
    name: 'Admin One',
    email: 'admin1@azizpoultry.com',
    password: 'AzizAdmin1@2026',
  },
  {
    name: 'Admin Two',
    email: 'admin2@azizpoultry.com',
    password: 'AzizAdmin2@2026',
  },
  {
    name: 'Admin Three',
    email: 'admin3@azizpoultry.com',
    password: 'AzizAdmin3@2026',
  },
];

async function run() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to database');

  // Step 1: Add session_token column if it doesn't exist
  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS session_token TEXT DEFAULT NULL;
  `);
  console.log('✓ session_token column ready');

  // Step 2: Create admin accounts
  for (const admin of ADMINS) {
    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [admin.email],
    );

    if (existing.rows.length > 0) {
      console.log(`  ⚠ ${admin.email} already exists — skipping`);
      continue;
    }

    const passwordHash = await bcrypt.hash(admin.password, 10);

    await client.query(
      `INSERT INTO users (name, email, password_hash, role, status, join_date, created_at, updated_at)
       VALUES ($1, $2, $3, 'admin', 'active', CURRENT_DATE, NOW(), NOW())`,
      [admin.name, admin.email, passwordHash],
    );

    console.log(`  ✓ Created: ${admin.email}  password: ${admin.password}`);
  }

  await client.end();
  console.log('\nDone. Share these credentials with your friends:\n');
  ADMINS.forEach((a) => {
    console.log(`  Email:    ${a.email}`);
    console.log(`  Password: ${a.password}`);
    console.log('');
  });
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
