const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB = {
  host: 'poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com',
  port: 5432,
  user: 'poultry_user',
  password: 'poultry_user1212',
  database: 'poultry',
  ssl: { rejectUnauthorized: false },
};

const BACKUP_DIR = path.join(__dirname, 'database-backup-2026-03-12');

function read(file) {
  const p = path.join(BACKUP_DIR, file);
  if (!fs.existsSync(p)) return [];
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  return Array.isArray(data) ? data : [];
}

async function run() {
  const client = new Client(DB);
  await client.connect();
  console.log('✅ Connected to AWS RDS\n');

  // ── CREATE TABLES ──────────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'staff',
      status VARCHAR(50) DEFAULT 'active',
      phone VARCHAR(50),
      notes TEXT,
      join_date TIMESTAMPTZ,
      last_login TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS farmers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      email VARCHAR(255),
      address TEXT,
      notes TEXT,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS retailers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      owner_name VARCHAR(255),
      phone VARCHAR(50),
      email VARCHAR(255),
      address TEXT,
      notes TEXT,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id SERIAL PRIMARY KEY,
      vehicle_number VARCHAR(100) NOT NULL,
      vehicle_type VARCHAR(100),
      driver_name VARCHAR(255),
      phone VARCHAR(50),
      owner_name VARCHAR(255),
      address TEXT,
      total_capacity INTEGER,
      petrol_tank_capacity NUMERIC(10,2),
      mileage NUMERIC(10,2),
      join_date TIMESTAMPTZ,
      status VARCHAR(50) DEFAULT 'active',
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id SERIAL PRIMARY KEY,
      order_number VARCHAR(100),
      supplier_name VARCHAR(255),
      order_date TIMESTAMPTZ,
      due_date TIMESTAMPTZ,
      status VARCHAR(50) DEFAULT 'pending',
      total_amount NUMERIC(12,2) DEFAULT 0,
      notes TEXT,
      transport_charges NUMERIC(12,2) DEFAULT 0,
      loading_charges NUMERIC(12,2) DEFAULT 0,
      commission NUMERIC(12,2) DEFAULT 0,
      other_charges NUMERIC(12,2) DEFAULT 0,
      weight_shortage NUMERIC(12,2) DEFAULT 0,
      mortality_deduction NUMERIC(12,2) DEFAULT 0,
      other_deduction NUMERIC(12,2) DEFAULT 0,
      gross_amount NUMERIC(12,2) DEFAULT 0,
      net_amount NUMERIC(12,2) DEFAULT 0,
      farmer_id INTEGER REFERENCES farmers(id) ON DELETE SET NULL,
      farmer_mobile VARCHAR(50),
      farm_location TEXT,
      vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
      bird_type VARCHAR(50),
      total_weight NUMERIC(12,2) DEFAULT 0,
      rate_per_kg NUMERIC(12,2) DEFAULT 0,
      purchase_payment_status VARCHAR(50) DEFAULT 'pending',
      advance_paid NUMERIC(12,2) DEFAULT 0,
      outstanding_payment NUMERIC(12,2) DEFAULT 0,
      payment_mode VARCHAR(50),
      total_payment_made NUMERIC(12,2) DEFAULT 0,
      balance_amount NUMERIC(12,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS purchase_order_cages (
      id SERIAL PRIMARY KEY,
      purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
      cage_id VARCHAR(50),
      num_birds INTEGER,
      weight NUMERIC(10,2),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      invoice_number VARCHAR(100),
      customer_name VARCHAR(255),
      sale_date TIMESTAMPTZ,
      product_type VARCHAR(50),
      quantity NUMERIC(12,2),
      unit VARCHAR(50),
      unit_price NUMERIC(12,2),
      total_amount NUMERIC(12,2) DEFAULT 0,
      payment_status VARCHAR(50) DEFAULT 'pending',
      amount_received NUMERIC(12,2) DEFAULT 0,
      notes TEXT,
      retailer_id INTEGER REFERENCES retailers(id) ON DELETE SET NULL,
      sale_mode VARCHAR(50),
      transport_charges NUMERIC(12,2) DEFAULT 0,
      loading_charges NUMERIC(12,2) DEFAULT 0,
      commission NUMERIC(12,2) DEFAULT 0,
      other_charges NUMERIC(12,2) DEFAULT 0,
      weight_shortage NUMERIC(12,2) DEFAULT 0,
      mortality_deduction NUMERIC(12,2) DEFAULT 0,
      other_deduction NUMERIC(12,2) DEFAULT 0,
      gross_amount NUMERIC(12,2) DEFAULT 0,
      net_amount NUMERIC(12,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      expense_date TIMESTAMPTZ,
      category VARCHAR(100),
      description TEXT,
      amount NUMERIC(12,2),
      payment_method VARCHAR(50),
      notes TEXT,
      expense_owner VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS mortalities (
      id SERIAL PRIMARY KEY,
      mortality_date TIMESTAMPTZ,
      bird_type VARCHAR(50),
      count INTEGER,
      cause VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT,
      category VARCHAR(100) DEFAULT 'general',
      description TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS godown_sales (
      id SERIAL PRIMARY KEY,
      sale_date TIMESTAMPTZ,
      customer_name VARCHAR(255),
      product_type VARCHAR(50),
      quantity NUMERIC(12,2),
      unit VARCHAR(50),
      unit_price NUMERIC(12,2),
      total_amount NUMERIC(12,2),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS godown_expenses (
      id SERIAL PRIMARY KEY,
      expense_date TIMESTAMPTZ,
      category VARCHAR(100),
      description TEXT,
      amount NUMERIC(12,2),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS godown_mortality (
      id SERIAL PRIMARY KEY,
      mortality_date TIMESTAMPTZ,
      bird_type VARCHAR(50),
      count INTEGER,
      cause VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('✅ All tables created\n');

  // ── INSERT DATA ────────────────────────────────────────────────
  async function insertWithId(table, rows, cols, vals) {
    if (!rows.length) { console.log(`   ${table}: 0 rows (empty)`); return; }
    let count = 0;
    for (const r of rows) {
      try {
        const v = vals(r);
        await client.query(
          `INSERT INTO ${table} (${cols}) VALUES (${v.map((_,i)=>`$${i+1}`).join(',')}) ON CONFLICT (id) DO NOTHING`,
          v
        );
        count++;
      } catch(e) { console.warn(`   ⚠ ${table} row ${r.id}: ${e.message}`); }
    }
    // reset sequence
    await client.query(`SELECT setval('${table}_id_seq', (SELECT MAX(id) FROM ${table}))`).catch(()=>{});
    console.log(`   ✅ ${table}: ${count} rows inserted`);
  }

  console.log('Inserting data...');

  // users
  await insertWithId('users', read('users.json'),
    'id,name,email,password_hash,role,status,phone,notes,join_date,last_login,created_at,updated_at',
    r => [r.id, r.name, r.email, r.password_hash, r.role, r.status, r.phone||null, r.notes||null,
          r.join_date||null, r.last_login||null, r.created_at, r.updated_at]
  );

  // farmers
  await insertWithId('farmers', read('farmers.json'),
    'id,name,phone,email,address,notes,status,created_at,updated_at',
    r => [r.id, r.name, r.phone||null, r.email||null, r.address||null, r.notes||null,
          r.status||'active', r.created_at, r.updated_at]
  );

  // retailers
  await insertWithId('retailers', read('retailers.json'),
    'id,name,owner_name,phone,email,address,notes,status,created_at,updated_at',
    r => [r.id, r.name, r.owner_name||null, r.phone||null, r.email||null,
          r.address||null, r.notes||null, r.status||'active', r.created_at, r.updated_at]
  );

  // vehicles
  await insertWithId('vehicles', read('vehicles.json'),
    'id,vehicle_number,vehicle_type,driver_name,phone,owner_name,address,total_capacity,petrol_tank_capacity,mileage,join_date,status,note,created_at,updated_at',
    r => [r.id, r.vehicle_number, r.vehicle_type||null, r.driver_name||null, r.phone||null,
          r.owner_name||null, r.address||null, r.total_capacity||null, r.petrol_tank_capacity||null,
          r.mileage||null, r.join_date||null, r.status||'active', r.note||null, r.created_at, r.updated_at]
  );

  // purchase_orders
  await insertWithId('purchase_orders', read('purchase_orders.json'),
    'id,order_number,supplier_name,order_date,due_date,status,total_amount,notes,transport_charges,loading_charges,commission,other_charges,weight_shortage,mortality_deduction,other_deduction,gross_amount,net_amount,farmer_id,farmer_mobile,farm_location,vehicle_id,bird_type,total_weight,rate_per_kg,purchase_payment_status,advance_paid,outstanding_payment,payment_mode,total_payment_made,balance_amount,created_at,updated_at',
    r => [r.id, r.order_number, r.supplier_name, r.order_date||null, r.due_date||null,
          r.status||'pending', r.total_amount||0, r.notes||null, r.transport_charges||0,
          r.loading_charges||0, r.commission||0, r.other_charges||0, r.weight_shortage||0,
          r.mortality_deduction||0, r.other_deduction||0, r.gross_amount||0, r.net_amount||0,
          r.farmer_id||null, r.farmer_mobile||null, r.farm_location||null, r.vehicle_id||null,
          r.bird_type||null, r.total_weight||0, r.rate_per_kg||0,
          r.purchase_payment_status||'pending', r.advance_paid||0, r.outstanding_payment||0,
          r.payment_mode||null, r.total_payment_made||0, r.balance_amount||0,
          r.created_at, r.updated_at]
  );

  // sales
  await insertWithId('sales', read('sales.json'),
    'id,invoice_number,customer_name,sale_date,product_type,quantity,unit,unit_price,total_amount,payment_status,amount_received,notes,retailer_id,sale_mode,transport_charges,loading_charges,commission,other_charges,weight_shortage,mortality_deduction,other_deduction,gross_amount,net_amount,created_at,updated_at',
    r => [r.id, r.invoice_number, r.customer_name, r.sale_date||null, r.product_type||null,
          r.quantity||0, r.unit||null, r.unit_price||0, r.total_amount||0,
          r.payment_status||'pending', r.amount_received||0, r.notes||null,
          r.retailer_id||null, r.sale_mode||null, r.transport_charges||0, r.loading_charges||0,
          r.commission||0, r.other_charges||0, r.weight_shortage||0, r.mortality_deduction||0,
          r.other_deduction||0, r.gross_amount||0, r.net_amount||0, r.created_at, r.updated_at]
  );

  // expenses
  await insertWithId('expenses', read('expenses.json'),
    'id,expense_date,category,description,amount,payment_method,notes,expense_owner,created_at,updated_at',
    r => [r.id, r.expense_date||null, r.category||null, r.description||null,
          r.amount||0, r.payment_method||null, r.notes||null, r.expense_owner||null,
          r.created_at, r.updated_at]
  );

  // settings (no id sequence)
  const settings = read('settings.json');
  for (const s of settings) {
    await client.query(
      `INSERT INTO settings (key,value,category,description,updated_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
      [s.key, s.value, s.category||'general', s.description||null, s.updated_at]
    ).catch(e => console.warn(`   ⚠ settings ${s.key}: ${e.message}`));
  }
  console.log(`   ✅ settings: ${settings.length} rows inserted`);

  console.log('\n✅ Restore complete!');
  await client.end();
}

run().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1); });
