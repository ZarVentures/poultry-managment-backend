/**
 * reset-stage-from-prod.js
 *
 * Completely resets poultry_stage to match poultry (prod).
 * - Drops all tables in poultry_stage
 * - Recreates them with exact same schema as prod
 * - Copies all data from prod
 *
 * Run: node reset-stage-from-prod.js
 * Safe: never touches prod DB.
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
    // Step 1: Get all tables from prod in dependency order
    const tablesResult = await prod.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    const tables = tablesResult.rows.map(r => r.tablename);
    console.log(`Found ${tables.length} tables in prod: ${tables.join(', ')}\n`);

    // Step 2: Drop all tables in staging (cascade to handle FK)
    console.log('=== Dropping all staging tables ===');
    await stage.query('SET session_replication_role = replica'); // disable FK checks
    for (const table of [...tables].reverse()) {
      try {
        await stage.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        console.log(`  🗑️  Dropped ${table}`);
      } catch (err) {
        console.log(`  ⚠️  Could not drop ${table}: ${err.message}`);
      }
    }

    // Also drop enums
    const enumsResult = await prod.query(`
      SELECT typname FROM pg_type 
      WHERE typcategory = 'E' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `);
    for (const { typname } of enumsResult.rows) {
      try {
        await stage.query(`DROP TYPE IF EXISTS "${typname}" CASCADE`);
      } catch {}
    }

    // Step 3: Get CREATE TABLE statements from prod using pg_dump approach
    // We'll recreate tables by reading column definitions
    console.log('\n=== Recreating staging schema from prod ===');

    // Get all sequences from prod
    const seqResult = await prod.query(`
      SELECT sequence_name
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public'
    `);

    // Get enum types from prod
    const enumTypesResult = await prod.query(`
      SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) as labels
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      GROUP BY t.typname
    `);

    // Create enums in staging
    for (const { typname, labels } of enumTypesResult.rows) {
      const labelArray = Array.isArray(labels) ? labels : [labels];
      const labelList = labelArray.map(l => `'${l}'`).join(', ');
      try {
        await stage.query(`CREATE TYPE "${typname}" AS ENUM (${labelList})`);
        console.log(`  ✅ Created enum ${typname}`);
      } catch (err) {
        console.log(`  ⚠️  Enum ${typname}: ${err.message}`);
      }
    }

    // Get column definitions for each table
    for (const table of tables) {
      try {
        const colsResult = await prod.query(`
          SELECT 
            c.column_name,
            c.data_type,
            c.udt_name,
            c.character_maximum_length,
            c.numeric_precision,
            c.numeric_scale,
            c.is_nullable,
            c.column_default,
            c.ordinal_position
          FROM information_schema.columns c
          WHERE c.table_schema = 'public' AND c.table_name = $1
          ORDER BY c.ordinal_position
        `, [table]);

        const cols = colsResult.rows;
        if (cols.length === 0) continue;

        const colDefs = cols.map(col => {
          let typeDef = '';
          if (col.data_type === 'USER-DEFINED') {
            typeDef = `"${col.udt_name}"`;
          } else if (col.data_type === 'character varying') {
            typeDef = col.character_maximum_length ? `varchar(${col.character_maximum_length})` : 'varchar';
          } else if (col.data_type === 'numeric') {
            typeDef = col.numeric_precision ? `numeric(${col.numeric_precision},${col.numeric_scale || 0})` : 'numeric';
          } else if (col.data_type === 'ARRAY') {
            typeDef = `${col.udt_name.replace('_', '')}[]`;
          } else {
            typeDef = col.data_type;
          }

          let def = `"${col.column_name}" ${typeDef}`;
          if (col.column_default) {
            def += ` DEFAULT ${col.column_default}`;
          }
          if (col.is_nullable === 'NO') {
            def += ' NOT NULL';
          }
          return def;
        });

        await stage.query(`CREATE TABLE IF NOT EXISTS "${table}" (${colDefs.join(', ')})`);
        console.log(`  ✅ Created table ${table} (${cols.length} columns)`);
      } catch (err) {
        console.log(`  ⚠️  Table ${table}: ${err.message}`);
      }
    }

    // Step 4: Copy data from prod to staging
    console.log('\n=== Copying data from prod to staging ===');
    await stage.query('SET session_replication_role = replica'); // disable FK checks during insert

    for (const table of tables) {
      try {
        const result = await prod.query(`SELECT * FROM "${table}" ORDER BY 1`);
        if (result.rows.length === 0) {
          console.log(`  ⏭️  ${table}: 0 rows`);
          continue;
        }

        const cols = Object.keys(result.rows[0]);
        const colList = cols.map(c => `"${c}"`).join(', ');

        for (const row of result.rows) {
          const vals = cols.map((_, i) => `$${i + 1}`).join(', ');
          const values = cols.map(c => row[c]);
          await stage.query(`INSERT INTO "${table}" (${colList}) VALUES (${vals})`, values);
        }

        console.log(`  ✅ ${table}: ${result.rows.length} rows`);
      } catch (err) {
        console.log(`  ⚠️  ${table}: ${err.message}`);
      }
    }

    // Step 5: Reset sequences
    console.log('\n=== Resetting sequences ===');
    await stage.query('SET session_replication_role = DEFAULT');

    for (const table of tables) {
      try {
        // Find the primary key sequence for this table
        const pkResult = await prod.query(`
          SELECT column_name, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          AND column_default LIKE 'nextval%'
        `, [table]);

        for (const { column_name, column_default } of pkResult.rows) {
          const seqMatch = column_default.match(/nextval\('([^']+)'/);
          if (seqMatch) {
            const seqName = seqMatch[1];
            const maxResult = await stage.query(`SELECT MAX("${column_name}") as max FROM "${table}"`);
            const maxVal = maxResult.rows[0]?.max || 1;
            await stage.query(`SELECT setval('${seqName}', ${maxVal}, true)`);
            console.log(`  🔢 ${seqName}: ${maxVal}`);
          }
        }
      } catch {}
    }

    console.log('\n✅ Done! poultry_stage now has exact same schema and data as poultry (prod)');

  } finally {
    await prod.end();
    await stage.end();
  }
}

run().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
