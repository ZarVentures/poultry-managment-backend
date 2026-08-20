/**
 * Run this once to apply all database changes for Phone+OTP authentication.
 * 
 * Usage:
 *   npx ts-node src/migrate-otp-auth.ts
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

async function main() {
  console.log('🔌 Connecting to database...');
  await AppDataSource.initialize();
  console.log('✅ Connected.');

  // ── Step 1: Make phone column nullable (if it's not already) and add unique ──
  console.log('\n📋 Step 1: Updating users table...');
  await AppDataSource.query(`
    ALTER TABLE users 
      ALTER COLUMN phone TYPE VARCHAR(20),
      ALTER COLUMN phone DROP NOT NULL;
  `).catch(() => console.log('   phone column already nullable, skipping'));

  // Drop unique on email if it blocks us (it will be re-added if needed)
  await AppDataSource.query(`
    ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
  `).catch(() => console.log('   password_hash already nullable, skipping'));

  // Email must be nullable so phone-only users can be created
  await AppDataSource.query(`
    ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
  `).catch(() => console.log('   email already nullable, skipping'));

  // Add unique constraint on phone (if not already)
  await AppDataSource.query(`
    ALTER TABLE users ADD CONSTRAINT users_phone_unique UNIQUE (phone);
  `).catch(() => console.log('   phone unique constraint already exists, skipping'));

  // ── Step 2: Assign phone to admin user so they can log in ─────────────────
  console.log('\n📋 Step 2: Setting admin phone number...');
  const ADMIN_EMAIL = 'admin@azizpoultry.com';
  const ADMIN_PHONE = '+919999999999';  // ← Change this to the real admin phone

  const result = await AppDataSource.query(
    `UPDATE users SET phone = $1 WHERE email = $2 AND (phone IS NULL OR phone = '') RETURNING id, name, email, phone`,
    [ADMIN_PHONE, ADMIN_EMAIL]
  );
  if (result.length > 0) {
    console.log(`   ✅ Admin phone set to ${ADMIN_PHONE} for ${result[0].email}`);
  } else {
    console.log('   ℹ️  Admin user already has a phone number or was not found. Skipping.');
  }

  // ── Step 3: Create otp_sessions table ────────────────────────────────────
  console.log('\n📋 Step 3: Creating otp_sessions table...');
  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS otp_sessions (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "phoneNumber" VARCHAR(20)  NOT NULL,
      otp_hash      TEXT         NOT NULL,
      expires_at    TIMESTAMPTZ  NOT NULL,
      is_used       BOOLEAN      NOT NULL DEFAULT FALSE,
      attempts      INTEGER      NOT NULL DEFAULT 0,
      last_requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);
  console.log('   ✅ otp_sessions table ready.');

  // Index for fast phone lookups
  await AppDataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_otp_sessions_phone ON otp_sessions ("phoneNumber");
  `);
  console.log('   ✅ Index on phoneNumber created.');

  console.log('\n🎉 Migration complete! You can now restart your backend and test the OTP login.');
  await AppDataSource.destroy();
}

main().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
