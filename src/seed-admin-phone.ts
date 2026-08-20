/**
 * One-time seed script — assigns a phone number to the existing admin user
 * so you can log in with the new OTP flow.
 *
 * Run once: npx ts-node src/seed-admin-phone.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'poultry',
  url: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  await AppDataSource.initialize();

  const ADMIN_EMAIL = 'admin@azizpoultry.com';
  const ADMIN_PHONE = '+919999999999'; // Change this to your real admin phone number

  await AppDataSource.query(
    `UPDATE users SET phone = $1 WHERE email = $2 AND (phone IS NULL OR phone = '')`,
    [ADMIN_PHONE, ADMIN_EMAIL]
  );

  console.log(`✅ Admin phone set to ${ADMIN_PHONE} for ${ADMIN_EMAIL}`);
  await AppDataSource.destroy();
}

main().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
