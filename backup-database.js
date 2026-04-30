const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

async function backupDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Render database');

    // Create backup directory
    const backupDir = path.join(__dirname, 'database-backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

    console.log('\n📦 Starting database backup...\n');

    let sqlDump = `-- Database Backup
-- Date: ${new Date().toISOString()}
-- Source: Render PostgreSQL Database
-- Database: Aziz Poultry Management System

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

`;

    // Get all tables
    const tablesResult = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);

    console.log(`Found ${tablesResult.rows.length} tables to backup\n`);

    for (const { tablename } of tablesResult.rows) {
      console.log(`📋 Backing up table: ${tablename}`);

      // Get table structure
      const structureResult = await client.query(`
        SELECT 
          'CREATE TABLE ' || quote_ident(tablename) || ' (' ||
          string_agg(
            quote_ident(column_name) || ' ' || 
            data_type || 
            CASE 
              WHEN character_maximum_length IS NOT NULL 
              THEN '(' || character_maximum_length || ')'
              ELSE ''
            END ||
            CASE 
              WHEN is_nullable = 'NO' THEN ' NOT NULL'
              ELSE ''
            END,
            ', '
          ) || ');' as create_statement
        FROM information_schema.columns
        WHERE table_name = $1
        GROUP BY tablename;
      `, [tablename]);

      if (structureResult.rows.length > 0) {
        sqlDump += `\n-- Table: ${tablename}\n`;
        sqlDump += `DROP TABLE IF EXISTS ${tablename} CASCADE;\n`;
        sqlDump += structureResult.rows[0].create_statement + '\n\n';
      }

      // Get table data
      const dataResult = await client.query(`SELECT * FROM ${tablename}`);
      
      if (dataResult.rows.length > 0) {
        console.log(`   └─ ${dataResult.rows.length} rows`);

        // Get column names
        const columns = Object.keys(dataResult.rows[0]);
        
        for (const row of dataResult.rows) {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (val instanceof Date) return `'${val.toISOString()}'`;
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            return val;
          });

          sqlDump += `INSERT INTO ${tablename} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        sqlDump += '\n';
      } else {
        console.log(`   └─ 0 rows (empty table)`);
      }
    }

    // Write to file
    fs.writeFileSync(backupFile, sqlDump);

    console.log(`\n✅ Backup completed successfully!`);
    console.log(`📁 Backup file: ${backupFile}`);
    console.log(`📊 File size: ${(fs.statSync(backupFile).size / 1024).toFixed(2)} KB`);

    // Also create a JSON backup for easier inspection
    const jsonBackupFile = path.join(backupDir, `backup-${timestamp}.json`);
    const jsonData = {};

    for (const { tablename } of tablesResult.rows) {
      const dataResult = await client.query(`SELECT * FROM ${tablename}`);
      jsonData[tablename] = dataResult.rows;
    }

    fs.writeFileSync(jsonBackupFile, JSON.stringify(jsonData, null, 2));
    console.log(`📁 JSON backup: ${jsonBackupFile}`);
    console.log(`📊 File size: ${(fs.statSync(jsonBackupFile).size / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run backup
backupDatabase().catch(console.error);

