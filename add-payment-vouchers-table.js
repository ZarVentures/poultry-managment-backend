const { Client } = require('pg');
// Staging DB: EC2 often uses `.env.stage`; local may use `.env.staging` or `.env`
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

const client = new Client(pgConfigFromEnv());

async function createPaymentVouchersTable() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Create payment_vouchers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_vouchers (
        id SERIAL PRIMARY KEY,
        voucher_number VARCHAR(50) UNIQUE NOT NULL,
        voucher_date DATE NOT NULL,
        payee_type VARCHAR(20) NOT NULL CHECK (payee_type IN ('farmer', 'retailer', 'supplier', 'employee', 'other')),
        payee_id INTEGER,
        payee_name VARCHAR(255) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'cheque', 'bank_transfer', 'upi', 'card')),
        cheque_number VARCHAR(50),
        bank_name VARCHAR(100),
        transaction_reference VARCHAR(100),
        purpose VARCHAR(255) NOT NULL,
        description TEXT,
        reference_type VARCHAR(20) CHECK (reference_type IN ('purchase', 'expense', 'sale', 'other')),
        reference_id INTEGER,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
        paid_date DATE,
        attachment_url VARCHAR(500),
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        approved_by INTEGER REFERENCES users(id),
        approved_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ payment_vouchers table created');

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_vouchers_voucher_number ON payment_vouchers(voucher_number);
      CREATE INDEX IF NOT EXISTS idx_payment_vouchers_voucher_date ON payment_vouchers(voucher_date);
      CREATE INDEX IF NOT EXISTS idx_payment_vouchers_payee_type ON payment_vouchers(payee_type);
      CREATE INDEX IF NOT EXISTS idx_payment_vouchers_status ON payment_vouchers(status);
      CREATE INDEX IF NOT EXISTS idx_payment_vouchers_reference ON payment_vouchers(reference_type, reference_id);
    `);
    console.log('✅ Indexes created');

    // Insert sample data
    await client.query(`
      INSERT INTO payment_vouchers (
        voucher_number, voucher_date, payee_type, payee_name, amount, 
        payment_method, purpose, description, status
      ) VALUES 
      ('PV-2026-001', '2026-05-01', 'supplier', 'ABC Feeds Supplier', 50000.00, 'bank_transfer', 'Feed Purchase Payment', 'Payment for chicken feed order #1234', 'paid'),
      ('PV-2026-002', '2026-05-03', 'farmer', 'Rajesh Kumar', 25000.00, 'cash', 'Chicken Purchase', 'Payment for 500 chickens', 'paid'),
      ('PV-2026-003', '2026-05-05', 'employee', 'Driver - Ramesh', 5000.00, 'cash', 'Salary Advance', 'Monthly salary advance', 'pending')
      ON CONFLICT (voucher_number) DO NOTHING;
    `);
    console.log('✅ Sample data inserted');

    console.log('\n✅ Payment Vouchers table setup complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

createPaymentVouchersTable();
