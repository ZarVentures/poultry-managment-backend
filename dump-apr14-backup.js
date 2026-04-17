/**
 * dump-apr14-backup.js
 * Dumps ALL tables from the Apr 14 backup RDS instance into ./database-backup-apr14/
 * Run: node dump-apr14-backup.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const BACKUP_DB = {
  host: 'backupto14.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com',
  port: 5432,
  user: 'poultry_user',
  password: 'poultry_user1212',
  database: 'poultry',
  ssl: { rejectUnauthorized: false },
};

const OUTPUT_DIR = path.join(__dirname, 'database-backup-apr14');

async function dump() {
  const client = new Client(BACKUP_DB);

  try {
    console.log('Connecting to Apr 14 backup DB...');
    await client.connect();
    console.log('Connected.\n');

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Get all tables
    const tablesResult = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);

    const tables = tablesResult.rows.map(r => r.tablename);
    console.log(`Found ${tables.length} tables:\n${tables.join(', ')}\n`);

    const summary = { exportedAt: new Date().toISOString(), tables: {} };

    for (const table of tables) {
      try {
        const result = await client.query(`SELECT * FROM "${table}" ORDER BY 1`);
        const filePath = path.join(OUTPUT_DIR, `${table}.json`);
        fs.writeFileSync(filePath, JSON.stringify(result.rows, null, 2));
        summary.tables[table] = result.rows.length;
        console.log(`✅ ${table}: ${result.rows.length} rows`);
      } catch (err) {
        console.log(`⚠️  ${table}: FAILED - ${err.message}`);
        summary.tables[table] = `ERROR: ${err.message}`;
      }
    }

    // Write summary
    fs.writeFileSync(
      path.join(OUTPUT_DIR, '_summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log(`\n✅ Done! All data saved to: ${OUTPUT_DIR}`);
    console.log('Summary:', JSON.stringify(summary.tables, null, 2));

  } catch (err) {
    console.error('Connection failed:', err.message);
    console.log('\nTry with different credentials if this fails.');
  } finally {
    await client.end();
  }
}

dump();
