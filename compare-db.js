const { Client } = require('pg');

const SSL = { rejectUnauthorized: false };
const HOST = 'poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com';
const USER = 'poultry_user';
const PASS = 'poultry_user1212';

const prod = new Client({ host: HOST, port: 5432, database: 'poultry', user: USER, password: PASS, ssl: SSL });
const stage = new Client({ host: HOST, port: 5432, database: 'poultry_stage', user: USER, password: PASS, ssl: SSL });

async function compare() {
    await prod.connect();
    await stage.connect();
    console.log('--- DATABASE COMPARISON: PROD vs STAGE ---\n');

    try {
        // 1. Compare Tables
        const prodTables = await prod.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        const stageTables = await stage.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");

        const prodSet = new Set(prodTables.rows.map(r => r.table_name));
        const stageSet = new Set(stageTables.rows.map(r => r.table_name));

        console.log('--- Missing Tables in STAGING ---');
        prodSet.forEach(t => { if (!stageSet.has(t)) console.log(`  ❌ ${t}`); });

        console.log('\n--- New Tables in STAGING (Not in Prod) ---');
        stageSet.forEach(t => { if (!prodSet.has(t)) console.log(`  ✨ ${t}`); });

        // 2. Compare Columns for shared tables
        console.log('\n--- Column Mismatches in Shared Tables ---');
        for (const table of prodSet) {
            if (stageSet.has(table)) {
                const prodCols = await prod.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}'`);
                const stageCols = await stage.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}'`);

                const pCols = new Map(prodCols.rows.map(r => [r.column_name, r.data_type]));
                const sCols = new Map(stageCols.rows.map(r => [r.column_name, r.data_type]));

                pCols.forEach((type, col) => {
                    if (!sCols.has(col)) {
                        console.log(`  ⚠️  [${table}] Missing column in STAGE: ${col} (${type})`);
                    } else if (sCols.get(col) !== type) {
                        console.log(`  🔄 [${table}] Type mismatch for ${col}: Prod=${type} vs Stage=${sCols.get(col)}`);
                    }
                });
            }
        }

    } finally {
        await prod.end();
        await stage.end();
    }
}

compare().catch(console.error);
