/**
 * Complete AWS DB setup script
 * - Drops all tables except users
 * - Recreates all tables with correct schema from TypeORM entities
 */
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

  // ── 1. DROP all tables except users ──────────────────────────
  console.log('Dropping old tables...');
  await client.query(`
    DROP TABLE IF EXISTS
      audit_logs,
      user_permissions,
      role_permissions,
      purchase_order_cages,
      purchase_order_items,
      mortalities,
      godown_expenses,
      godown_mortality,
      godown_sales,
      godown_inward_entries,
      inventory_items,
      sales,
      expenses,
      purchase_orders,
      retailers,
      farmers,
      vehicles,
      products,
      settings
    CASCADE;

    DROP TYPE IF EXISTS
      product_type_enum,
      product_status_enum,
      expense_category_type,
      payment_method_type,
      sale_mode_type,
      sale_product_type,
      payment_status_type,
      purchase_status,
      vehicle_status_type
    CASCADE;
  `);
  console.log('✅ Old tables dropped\n');

  // ── 2. Ensure citext extension ────────────────────────────────
  await client.query(`CREATE EXTENSION IF NOT EXISTS citext;`);

  // ── 3. Ensure users table has correct schema ──────────────────
  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('active', 'inactive');
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email CITEXT UNIQUE NOT NULL,
      phone VARCHAR(20),
      password_hash TEXT NOT NULL,
      role user_role NOT NULL DEFAULT 'manager',
      status user_status NOT NULL DEFAULT 'active',
      join_date DATE NOT NULL DEFAULT CURRENT_DATE,
      last_login TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('✅ users table ready\n');

  // ── 4. CREATE all tables ──────────────────────────────────────
  console.log('Creating tables...');

  await client.query(`
    -- ENUMS
    CREATE TYPE vehicle_status_type AS ENUM ('active', 'inactive');
    CREATE TYPE expense_category_type AS ENUM ('feed','labor','medicine','utilities','equipment','maintenance','transportation','other');
    CREATE TYPE payment_method_type AS ENUM ('cash','bank_transfer','check','credit_card');
    CREATE TYPE sale_product_type AS ENUM ('eggs','meat','chicks','other');
    CREATE TYPE sale_mode_type AS ENUM ('from_vehicle','from_godown');
    CREATE TYPE payment_status_type AS ENUM ('paid','pending','partial');
    CREATE TYPE purchase_status AS ENUM ('pending','received','cancelled');
    CREATE TYPE product_type_enum AS ENUM ('eggs','meat','chicks','feed','medicine','equipment','other');
    CREATE TYPE product_status_enum AS ENUM ('active','inactive');

    -- FARMERS
    CREATE TABLE farmers (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      phone VARCHAR(50),
      email VARCHAR(150),
      address TEXT,
      farmhouse_name VARCHAR(150),
      notes TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- RETAILERS
    CREATE TABLE retailers (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      owner_name VARCHAR(150),
      phone VARCHAR(50),
      email VARCHAR(150),
      address TEXT,
      notes TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- VEHICLES
    CREATE TABLE vehicles (
      id BIGSERIAL PRIMARY KEY,
      vehicle_number VARCHAR(50) NOT NULL UNIQUE,
      vehicle_type VARCHAR(50) NOT NULL,
      driver_name VARCHAR(150) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      owner_name VARCHAR(150),
      address TEXT,
      total_capacity INTEGER,
      petrol_tank_capacity NUMERIC(10,2),
      mileage NUMERIC(10,2),
      join_date DATE NOT NULL,
      status vehicle_status_type NOT NULL DEFAULT 'active',
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- PRODUCTS
    CREATE TABLE products (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      category VARCHAR(50),
      product_type product_type_enum,
      unit VARCHAR(20),
      price NUMERIC(14,2),
      description TEXT,
      status product_status_enum NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- PURCHASE ORDERS
    CREATE TABLE purchase_orders (
      id BIGSERIAL PRIMARY KEY,
      order_number VARCHAR(50) NOT NULL UNIQUE,
      supplier_name VARCHAR(150) NOT NULL,
      order_date DATE NOT NULL,
      due_date DATE,
      status purchase_status NOT NULL DEFAULT 'pending',
      branch VARCHAR(100),
      unit VARCHAR(100),
      gstin VARCHAR(20),
      lifting_time VARCHAR(50),
      party_code VARCHAR(50),
      pr_number VARCHAR(50),
      hsn_code VARCHAR(20) DEFAULT '0105',
      farmer_id BIGINT REFERENCES farmers(id) ON DELETE SET NULL,
      farmer_mobile VARCHAR(20),
      farm_location TEXT,
      vehicle_id BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
      bird_type VARCHAR(50),
      total_weight NUMERIC(10,2) NOT NULL DEFAULT 0,
      rate_per_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      transport_charges NUMERIC(10,2) NOT NULL DEFAULT 0,
      loading_charges NUMERIC(10,2) NOT NULL DEFAULT 0,
      commission NUMERIC(10,2) NOT NULL DEFAULT 0,
      other_charges NUMERIC(10,2) NOT NULL DEFAULT 0,
      weight_shortage NUMERIC(10,2) NOT NULL DEFAULT 0,
      mortality_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
      other_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
      gross_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      net_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      purchase_payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
      advance_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
      outstanding_payment NUMERIC(14,2) NOT NULL DEFAULT 0,
      payment_mode VARCHAR(50),
      total_payment_made NUMERIC(14,2) NOT NULL DEFAULT 0,
      balance_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      notes TEXT,
      invoice_attachment VARCHAR(500),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- PURCHASE ORDER ITEMS
    CREATE TABLE purchase_order_items (
      id BIGSERIAL PRIMARY KEY,
      purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity NUMERIC(14,2) NOT NULL,
      unit VARCHAR(20) NOT NULL,
      unit_cost NUMERIC(14,2) NOT NULL,
      line_total NUMERIC(14,2) NOT NULL
    );

    -- PURCHASE ORDER CAGES
    CREATE TABLE purchase_order_cages (
      id BIGSERIAL PRIMARY KEY,
      purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      cage_id VARCHAR(50),
      bird_type VARCHAR(50),
      number_of_birds INTEGER NOT NULL,
      cage_weight NUMERIC(10,2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- SALES
    CREATE TABLE sales (
      id BIGSERIAL PRIMARY KEY,
      invoice_number VARCHAR(50) NOT NULL UNIQUE,
      customer_name VARCHAR(150) NOT NULL,
      sale_date DATE NOT NULL,
      sale_mode sale_mode_type NOT NULL DEFAULT 'from_vehicle',
      product_type sale_product_type NOT NULL,
      quantity NUMERIC(14,2) NOT NULL,
      unit VARCHAR(20),
      unit_price NUMERIC(14,2) NOT NULL,
      total_amount NUMERIC(14,2) NOT NULL,
      transport_charges NUMERIC(10,2) NOT NULL DEFAULT 0,
      loading_charges NUMERIC(10,2) NOT NULL DEFAULT 0,
      commission NUMERIC(10,2) NOT NULL DEFAULT 0,
      other_charges NUMERIC(10,2) NOT NULL DEFAULT 0,
      weight_shortage NUMERIC(10,2) NOT NULL DEFAULT 0,
      mortality_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
      other_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
      gross_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      net_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      payment_status payment_status_type NOT NULL DEFAULT 'pending',
      amount_received NUMERIC(14,2) NOT NULL DEFAULT 0,
      notes TEXT,
      retailer_id BIGINT REFERENCES retailers(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- EXPENSES
    CREATE TABLE expenses (
      id BIGSERIAL PRIMARY KEY,
      expense_date DATE NOT NULL,
      expense_owner VARCHAR(150),
      category expense_category_type NOT NULL,
      description TEXT NOT NULL,
      amount NUMERIC(14,2) NOT NULL,
      payment_method payment_method_type NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- INVENTORY ITEMS
    CREATE TABLE inventory_items (
      id SERIAL PRIMARY KEY,
      item_type VARCHAR(50) NOT NULL,
      item_name VARCHAR(150) NOT NULL,
      quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
      unit VARCHAR(20) NOT NULL,
      minimum_stock_level NUMERIC(14,2) NOT NULL DEFAULT 0,
      current_stock_level NUMERIC(10,2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- MORTALITIES
    CREATE TABLE mortalities (
      id BIGSERIAL PRIMARY KEY,
      record_number VARCHAR(50) NOT NULL UNIQUE,
      purchase_order_id BIGINT REFERENCES purchase_orders(id) ON DELETE SET NULL,
      purchase_invoice_no VARCHAR(50) NOT NULL,
      purchase_date DATE NOT NULL,
      farmer_name VARCHAR(150) NOT NULL,
      farm_location TEXT,
      cage_id_number VARCHAR(50),
      total_birds_purchased INTEGER NOT NULL DEFAULT 0,
      number_of_birds_died INTEGER NOT NULL,
      cause TEXT NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- SETTINGS
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      category VARCHAR(50),
      description TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- GODOWN INWARD ENTRIES
    CREATE TABLE godown_inward_entries (
      id BIGSERIAL PRIMARY KEY,
      entry_date DATE NOT NULL,
      purchase_invoice_no VARCHAR(50),
      supplier_name VARCHAR(150),
      vehicle_id BIGINT,
      number_of_birds INTEGER NOT NULL,
      average_weight NUMERIC(10,2),
      total_weight NUMERIC(10,2),
      rate_per_kg NUMERIC(10,2),
      total_amount NUMERIC(14,2),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- GODOWN SALES
    CREATE TABLE godown_sales (
      id BIGSERIAL PRIMARY KEY,
      sale_date DATE NOT NULL,
      invoice_number VARCHAR(50),
      customer_name VARCHAR(150) NOT NULL,
      retailer_id BIGINT,
      vehicle_id BIGINT,
      number_of_birds INTEGER NOT NULL,
      average_weight NUMERIC(10,2),
      total_weight NUMERIC(10,2),
      rate_per_kg NUMERIC(10,2),
      total_amount NUMERIC(14,2),
      payment_status payment_status_type NOT NULL,
      amount_received NUMERIC(14,2) NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- GODOWN MORTALITY
    CREATE TABLE godown_mortality (
      id BIGSERIAL PRIMARY KEY,
      mortality_date DATE NOT NULL,
      number_of_birds_died INTEGER NOT NULL,
      reason TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- GODOWN EXPENSES
    CREATE TABLE godown_expenses (
      id BIGSERIAL PRIMARY KEY,
      expense_date DATE NOT NULL,
      category expense_category_type NOT NULL,
      description TEXT NOT NULL,
      amount NUMERIC(14,2) NOT NULL,
      payment_method payment_method_type NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- AUDIT LOGS
    CREATE TABLE audit_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT,
      user_email VARCHAR(255),
      action VARCHAR(50) NOT NULL,
      entity VARCHAR(100) NOT NULL,
      entity_id VARCHAR(100),
      old_values JSONB,
      new_values JSONB,
      ip_address VARCHAR(45),
      user_agent TEXT,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- ROLE PERMISSIONS
    CREATE TABLE role_permissions (
      id BIGSERIAL PRIMARY KEY,
      role VARCHAR(20) NOT NULL,
      resource VARCHAR(50) NOT NULL,
      can_create BOOLEAN NOT NULL DEFAULT false,
      can_read BOOLEAN NOT NULL DEFAULT true,
      can_update BOOLEAN NOT NULL DEFAULT false,
      can_delete BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- USER PERMISSIONS
    CREATE TABLE user_permissions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission_name VARCHAR(100) NOT NULL,
      resource VARCHAR(50) NOT NULL,
      can_create BOOLEAN NOT NULL DEFAULT false,
      can_read BOOLEAN NOT NULL DEFAULT true,
      can_update BOOLEAN NOT NULL DEFAULT false,
      can_delete BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- DEFAULT SETTINGS
    INSERT INTO settings (key, value, category, description) VALUES
      ('farmName', 'Aziz Poultry Farm', 'general', 'Farm name'),
      ('currency', 'PKR', 'general', 'System currency'),
      ('date_format', 'DD/MM/YYYY', 'general', 'Date format'),
      ('language', 'en', 'general', 'System language'),
      ('theme', 'dark', 'general', 'UI theme'),
      ('godown_capacity', '10000', 'godown', 'Maximum godown capacity')
    ON CONFLICT (key) DO NOTHING;
  `);

  console.log('✅ All tables created successfully!\n');

  // ── 5. Verify ─────────────────────────────────────────────────
  const res = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `);
  console.log('Tables in database:');
  res.rows.forEach(r => console.log(' -', r.table_name));

  await client.end();
  console.log('\n✅ Done! Database is clean and ready.');
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
