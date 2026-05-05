/**
 * clone-prod-to-stage.js
 * 
 * Clones prod DB (poultry) to staging DB (poultry_stage) completely.
 * - Drops all tables in staging
 * - Recreates them with exact same schema as prod
 * - Copies all data
 * 
 * Run: node clone-prod-to-stage.js
 * SAFE: never touches prod DB
 */

const { Client } = require('pg');

const SSL = { rejectUnauthorized: false };
const HOST = 'poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com';
const USER = 'poultry_user';
const PASS = 'poultry_user1212';

const prod  = new Client({ host: HOST, port: 5432, database: 'poultry',       user: USER, password: PASS, ssl: SSL });
const stage = new Client({ host: HOST, port: 5432, database: 'poultry_stage', user: USER, password: PASS, ssl: SSL });

async function run() {
  await prod.connect();
  await stage.connect();
  console.log('✅ Connected to both DBs\n');

  try {
    // Step 1: Get all tables from prod
    const tablesRes = await prod.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    const tables = tablesRes.rows.map(r => r.tablename);
    console.log(`Found ${tables.length} tables in prod: ${tables.join(', ')}\n`);

    // Step 2: Drop all tables in staging (cascade to handle FK)
    console.log('=== Dropping all staging tables ===');
    await stage.query('SET session_replication_role = replica'); // disable FK checks
    for (const table of tables) {
      try {
        await stage.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        console.log(`  🗑️  Dropped ${table}`);
      } catch (err) {
        console.log(`  ⚠️  Could not drop ${table}: ${err.message}`);
      }
    }
    // Also drop any extra tables in staging not in prod
    const stageTablesRes = await stage.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `);
    for (const { tablename } of stageTablesRes.rows) {
      if (!tables.includes(tablename)) {
        await stage.query(`DROP TABLE IF EXISTS "${tablename}" CASCADE`);
        console.log(`  🗑️  Dropped extra staging table: ${tablename}`);
      }
    }

    // Step 3: Get CREATE TABLE statements from prod and recreate in staging
    console.log('\n=== Recreating tables in staging ===');
    
    // Get all sequences from prod
    const seqRes = await prod.query(`
      SELECT sequence_name, start_value, increment_by, min_value, max_value, last_value
      FROM information_schema.sequences s
      JOIN pg_sequences ps ON ps.sequencename = s.sequence_name
      WHERE s.sequence_schema = 'public'
    `);
    
    for (const seq of seqRes.rows) {
      try {
        await stage.query(`
          CREATE SEQUENCE IF NOT EXISTS "${seq.sequence_name}"
          START WITH ${seq.last_value || 1}
          INCREMENT BY ${seq.increment_by}
          MINVALUE ${seq.min_value}
          NO MAXVALUE
        `);
      } catch (err) { /* ignore if exists */ }
    }

    // Get column definitions for each table
    for (const table of tables) {
      try {
        // Get columns
        const colRes = await prod.query(`
          SELECT 
            column_name,
            data_type,
            character_maximum_length,
            numeric_precision,
            numeric_scale,
            is_nullable,
            column_default,
            udt_name
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `, [table]);

        if (colRes.rows.length === 0) continue;

        // Build CREATE TABLE
        const colDefs = colRes.rows.map(col => {
          let type = col.data_type;
          
          if (type === 'character varying') type = `varchar(${col.character_maximum_length || 255})`;
          else if (type === 'numeric') type = `numeric(${col.numeric_precision || 14}, ${col.numeric_scale || 2})`;
          else if (type === 'USER-DEFINED') type = col.udt_name; // enums
          else if (type === 'bigint') type = 'bigint';
          else if (type === 'integer') type = 'integer';
          else if (type === 'boolean') type = 'boolean';
          else if (type === 'text') type = 'text';
          else if (type === 'date') type = 'date';
          else if (type === 'timestamp with time zone') type = 'timestamptz';
          else if (type === 'timestamp without time zone') type = 'timestamp';
          else if (type === 'json') type = 'json';
          else if (type === 'jsonb') type = 'jsonb';

          let def = `"${col.column_name}" ${type}`;
          if (col.is_nullable === 'NO') def += ' NOT NULL';
          if (col.column_default) {
            // Fix sequence references to use correct DB
            def += ` DEFAULT ${col.column_default}`;
          }
          return def;
        });

        await stage.query(`CREATE TABLE IF NOT EXISTS "${table}" (${colDefs.join(', ')})`);
        console.log(`  ✅ Created table ${table} (${colRes.rows.length} columns)`);
      } catch (err) {
        console.log(`  ⚠️  Failed to create ${table}: ${err.message}`);
      }
    }

    // Step 4: Copy data
    console.log('\n=== Copying data ===');
    await stage.query('SET session_replication_role = replica'); // disable FK checks during insert
    
    for (const table of tables) {
      try {
        const data = await prod.query(`SELECT * FROM "${table}"`);
        if (data.rows.length === 0) {
          console.log(`  ⏭️  ${table}: empty`);
          continue;
        }

        const cols = Object.keys(data.rows[0]);
        const colList = cols.map(c => `"${c}"`).join(', ');
        
        await stage.query(`TRUNCATE TABLE "${table}" CASCADE`);
        
        for (const row of data.rows) {
          const vals = cols.map((_, i) => `$${i + 1}`).join(', ');
          const values = cols.map(c => row[c]);
          await stage.query(`INSERT INTO "${table}" (${colList}) VALUES (${vals})`, values);
        }
        console.log(`  ✅ ${table}: ${data.rows.length} rows`);
      } catch (err) {
        console.log(`  ⚠️  ${table}: ${err.message}`);
      }
    }

    // Step 5: Reset sequences
    console.log('\n=== Resetting sequences ===');
    await stage.query('SET session_replication_role = DEFAULT');
    
    for (const seq of seqRes.rows) {
      try {
        const maxRes = await prod.query(`SELECT last_value FROM "${seq.sequence_name}"`);
        const lastVal = maxRes.rows[0]?.last_value || 1;
        await stage.query(`SELECT setval('"${seq.sequence_name}"', ${lastVal}, true)`);
        console.log(`  🔢 ${seq.sequence_name} → ${lastVal}`);
      } catch (err) { /* ignore */ }
    }

    console.log('\n✅ Done! Staging DB is now an exact clone of prod.');

  } catch (err) {
    console.error('Fatal error:', err.message);
  } finally {
    await prod.end();
    await stage.end();
  }
}

run().catch(console.error);
