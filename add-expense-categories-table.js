const { Client } = require('pg');
require('dotenv').config();

async function addExpenseCategoriesTable() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Create expense_categories table
    console.log('Creating expense_categories table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS expense_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        "isActive" BOOLEAN DEFAULT true,
        "isDefault" BOOLEAN DEFAULT false,
        "sortOrder" INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ expense_categories table created');

    // Add category_id column to expenses table
    console.log('Adding category_id column to expenses table...');
    await client.query(`
      ALTER TABLE expenses 
      ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES expense_categories(id);
    `);
    console.log('✅ category_id column added to expenses table');

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run the seed endpoint: POST http://your-api/expense-categories/seed');
    console.log('2. Or use the backend to seed default categories');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

addExpenseCategoriesTable();
