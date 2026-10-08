require('dotenv').config();
const { Client } = require('pg');

const connectionConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'poultry',
    };

async function run() {
  const client = new Client(connectionConfig);
  try {
    await client.connect();
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS deleted_by BIGINT NULL,
        ADD COLUMN IF NOT EXISTS deletion_reason TEXT NULL,
        ADD COLUMN IF NOT EXISTS recovery_expires_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS status_before_deletion VARCHAR(20) NULL,
        ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS purged_phone_hash TEXT NULL,
        ADD COLUMN IF NOT EXISTS purged_email_hash TEXT NULL,
        ADD COLUMN IF NOT EXISTS recovery_nonce TEXT NULL
    `);
    await client.query(`ALTER TABLE users ALTER COLUMN phone DROP NOT NULL`);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_pending_purge
      ON users (recovery_expires_at)
      WHERE deleted_at IS NOT NULL AND purged_at IS NULL
    `);
    await client.query(`
      ALTER TABLE otp_sessions
        ADD COLUMN IF NOT EXISTS purpose VARCHAR(32) NOT NULL DEFAULT 'login'
    `);
    const phoneCol = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'otp_sessions' AND column_name IN ('phoneNumber', 'phone_number')`,
    );
    const phoneColumn = phoneCol.rows[0]?.column_name;
    if (phoneColumn) {
      await client.query(
        `ALTER TABLE otp_sessions ALTER COLUMN "${phoneColumn}" TYPE VARCHAR(255)`,
      );
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_otp_sessions_phone_purpose
        ON otp_sessions ("${phoneColumn}", purpose, created_at DESC)
      `);
    }
    console.log('Account deletion columns are ready.');
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('Account deletion migration failed:', error);
  process.exit(1);
});
