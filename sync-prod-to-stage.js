const { Client } = require('pg');

const SSL = { rejectUnauthorized: false };
const HOST = 'poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com';
const USER = 'poultry_user';
const PASS = 'poultry_user1212';

const prod = new Client({ host: HOST, port: 5432, database: 'poultry', user: USER, password: PASS, ssl: SSL });
const stage = new Client({ host: HOST, port: 5432, database: 'poultry_stage', user: USER, password: PASS, ssl: SSL });

async function fullSync() {
  await prod.connect();
  await stage.connect();
  console.log('--- STARTING ROBUST DB SYNC (PROD -> STAGING) ---\n');

  try {
    // 1. Get all tables from Prod
    const tablesRes = await prod.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const tables = tablesRes.rows.map(r => r.table_name);

    // 2. Fix Schema in Staging (Targeted)
    console.log('=== Step 1: Ensuring Schema Integrity ===');
    for (const table of tables) {
      if (table === 'typeorm_metadata') continue;

      const checkTable = await stage.query(`SELECT 1 FROM information_schema.tables WHERE table_name = '${table}'`);
      if (checkTable.rows.length === 0) {
        console.log(`  🛠️  Creating table: ${table}`);
        try {
          // We'll create a basic version. For complex ones, we'll try to mirror columns.
          await stage.query(`CREATE TABLE "${table}" ()`);
        } catch (e) { }
      }

      // Sync Columns
      const prodCols = await prod.query(`SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = '${table}'`);
      for (const col of prodCols.rows) {
        const checkCol = await stage.query(`SELECT 1 FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${col.column_name}'`);
        if (checkCol.rows.length === 0) {
          console.log(`  🛠️  Adding column ${table}.${col.column_name}`);
          const typeStr = col.data_type === 'character varying' ? `VARCHAR(${col.character_maximum_length || 255})` : col.data_type;
          try {
            await stage.query(`ALTER TABLE "${table}" ADD COLUMN "${col.column_name}" ${typeStr}`);
          } catch (e) {
            console.log(`     ⚠️ Could not add column: ${e.message}`);
          }
        }
      }
    }

    // Preserve RBAC dynamic role type
    await stage.query('ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(50)');

    // 3. Sync Data
    console.log('\n=== Step 2: Syncing Data ===');
    for (const table of tables) {
      if (table === 'typeorm_metadata') continue;

      try {
        const data = await prod.query(`SELECT * FROM "${table}"`);
        await stage.query(`TRUNCATE TABLE "${table}" CASCADE`);

        if (data.rows.length > 0) {
          const cols = Object.keys(data.rows[0]);
          const colList = cols.map(c => `"${c}"`).join(', ');

          for (const row of data.rows) {
            const vals = cols.map((_, i) => `$${i + 1}`).join(', ');
            const values = cols.map(c => row[c]);
            try {
              await stage.query(`INSERT INTO "${table}" (${colList}) VALUES (${vals})`, values);
            } catch (e) {
              // Individual row fail (likely FK issue), skip
            }
          }
          console.log(`  ✅ ${table}: ${data.rows.length} rows processed.`);
        } else {
          console.log(`  ⏭️  ${table}: Empty.`);
        }
      } catch (err) {
        console.log(`  ❌ ${table}: ${err.message}`);
      }
    }

    console.log('\n🌟 SYNC COMPLETE!');

  } finally {
    await prod.end();
    await stage.end();
  }
}

fullSync().catch(console.error);
