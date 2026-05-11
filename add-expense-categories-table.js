const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USERNAME || 'poultry_user',
  password: process.env.DB_PASSWORD || 'poultry_user1212',
  database: process.env.DB_NAME || 'poultry_stage',
});

async function createExpenseCategoriesTable() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Create expense_categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS expense_categories (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        icon VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        is_system BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ Created expense_categories table');

    // Insert default system categories
    await client.query(`
      INSERT INTO expense_categories (name, description, icon, is_system) VALUES
      ('Feed', 'Animal feed and nutrition', '🌾', true),
      ('Labor', 'Labor and wages', '👷', true),
      ('Medicine', 'Veterinary medicine and healthcare', '💊', true),
      ('Utilities', 'Electricity, water, and other utilities', '💡', true),
      ('Equipment', 'Equipment purchase and rental', '🔧', true),
      ('Maintenance', 'Repairs and maintenance', '🔨', true),
      ('Transportation', 'Vehicle and transportation costs', '🚚', true),
      ('Other', 'Miscellaneous expenses', '📝', true)
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log('✓ Inserted default expense categories');

    // Add category_id column to expenses table
    await client.query(`
      ALTER TABLE expenses 
      ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES expense_categories(id);
    `);
    console.log('✓ Added category_id column to expenses table');

    // Migrate existing category data to category_id
    const categories = await client.query('SELECT id, name FROM expense_categories');
    const categoryMap = {
      'feed': 'Feed',
      'labor': 'Labor',
      'medicine': 'Medicine',
      'utilities': 'Utilities',
      'equipment': 'Equipment',
      'maintenance': 'Maintenance',
      'transportation': 'Transportation',
      'other': 'Other'
    };

    for (const [oldValue, newName] of Object.entries(categoryMap)) {
      const category = categories.rows.find(c => c.name === newName);
      if (category) {
        await client.query(
          `UPDATE expenses SET category_id = $1 WHERE category = $2 AND category_id IS NULL`,
          [category.id, oldValue]
        );
        console.log(`✓ Migrated '${oldValue}' expenses to category_id ${category.id}`);
      }
    }

    console.log('\n✅ Expense categories table created and data migrated successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

createExpenseCategoriesTable();
