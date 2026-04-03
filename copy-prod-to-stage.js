/**
 * Copy production data to staging DB
 * Run: node copy-prod-to-stage.js
 * Safe: only copies, never touches prod
 */

const { Client } = require('pg')

const SSL = { rejectUnauthorized: false }
const HOST = 'poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com'
const USER = 'poultry_user'
const PASS = 'poultry_user1212'

const prod  = new Client({ host: HOST, port: 5432, database: 'poultry',       user: USER, password: PASS, ssl: SSL })
const stage = new Client({ host: HOST, port: 5432, database: 'poultry_stage', user: USER, password: PASS, ssl: SSL })

// Tables to copy in order (respecting foreign keys)
const TABLES = [
  'users', 'farmers', 'retailers', 'vehicles',
  'purchase_orders', 'purchase_order_items', 'purchase_order_cages',
  'sales', 'expenses', 'mortalities', 'inventory_items', 'settings'
]

async function copyTable(table) {
  try {
    const { rows } = await prod.query(`SELECT * FROM "${table}"`)
    if (rows.length === 0) { console.log(`  ⊘ ${table}: empty`); return }

    // Clear staging table
    await stage.query(`TRUNCATE TABLE "${table}" CASCADE`)

    // Insert all rows
    for (const row of rows) {
      const cols = Object.keys(row).map(k => `"${k}"`).join(', ')
      const vals = Object.values(row)
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ')
      await stage.query(`INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`, vals)
    }

    console.log(`  ✓ ${table}: ${rows.length} rows copied`)
  } catch (err) {
    console.log(`  ✗ ${table}: ${err.message}`)
  }
}

async function run() {
  console.log('Connecting...')
  await prod.connect()
  await stage.connect()
  console.log('Connected.\n')

  for (const table of TABLES) {
    await copyTable(table)
  }

  // Reset sequences so new inserts don't conflict
  console.log('\nResetting sequences...')
  for (const table of TABLES) {
    try {
      await stage.query(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`)
      console.log(`  ✓ ${table} sequence reset`)
    } catch {}
  }

  await prod.end()
  await stage.end()
  console.log('\nDone! Staging DB now has a copy of production data.')
  console.log('Changes in staging will NOT affect production.')
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
