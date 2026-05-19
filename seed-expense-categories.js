const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.staging') });

const categories = [
    { name: 'Feed', icon: 'wheat', description: 'Poultry feed and supplements' },
    { name: 'Labor', icon: 'users', description: 'Employee salaries and wages' },
    { name: 'Medicine', icon: 'pill', description: 'Medicine and treatment' },
    { name: 'Utilities', icon: 'zap', description: 'Utility bills' },
    { name: 'Equipment', icon: 'wrench', description: 'Farm equipment and tools' },
    { name: 'Maintenance', icon: 'hammer', description: 'Farm maintenance and repairs' },
    { name: 'Transportation', icon: 'truck', description: 'Transportation and logistics' },
    { name: 'Other', icon: 'more-horizontal', description: 'Other expenses' }
];

async function seed() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database. Seeding expense categories...');

        // 0. Alter tables to support dynamic/custom categories and scoping
        console.log('Running schema migrations...');
        await client.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'godown_expenses' 
                      AND column_name = 'category' 
                      AND data_type = 'USER-DEFINED'
                ) THEN
                    ALTER TABLE godown_expenses ALTER COLUMN category TYPE varchar(100);
                END IF;
            END $$;
        `);

        // Ensure applies_to column exists on expense_categories
        await client.query(`
            ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS applies_to varchar(50) DEFAULT 'both';
        `);

        // Update any existing records where applies_to is null or empty to 'both'
        await client.query(`
            UPDATE expense_categories SET applies_to = 'both' WHERE applies_to IS NULL OR applies_to = '';
        `);

        // 1. Insert new categories and collect their IDs
        const categoryIds = {};
        for (const cat of categories) {
            const res = await client.query(
                `INSERT INTO expense_categories (name, icon, description, is_active, is_system, is_default, applies_to) 
                 VALUES ($1, $2, $3, true, true, true, 'both') 
                 ON CONFLICT (name) DO UPDATE SET icon = $2, description = $3
                 RETURNING id`,
                [cat.name, cat.icon, cat.description]
            );
            categoryIds[cat.name] = res.rows[0].id;
            console.log(`Upserted category: ${cat.name} (ID: ${res.rows[0].id})`);
        }

        // 2. Map existing expenses from old categories to new ones
        const allCatsRes = await client.query(`SELECT id, name FROM expense_categories`);
        const oldCats = allCatsRes.rows;

        const mapping = {
            'Diesel (For Big Vehicle)': 'Transportation',
            'Petrol (For Two Wheelers)': 'Transportation',
            'Worker Salary': 'Labor',
            'Worker Incentive': 'Labor',
            'Electricity Bill': 'Utilities',
            'Feed': 'Feed',
            'Shop Rent': 'Other',
            'Stationary': 'Other',
            'Cleaning': 'Other',
            'Snacks (Chai, Samosa, etc.)': 'Other',
            'Misc Expenses (Everything Else)': 'Other',
            'Misc Expenses': 'Other'
        };

        for (const oldCat of oldCats) {
            const newCatName = mapping[oldCat.name];
            if (newCatName && newCatName !== oldCat.name) {
                const newCatId = categoryIds[newCatName];
                if (newCatId) {
                    console.log(`Mapping expenses from "${oldCat.name}" (ID ${oldCat.id}) to "${newCatName}" (ID ${newCatId})`);
                    await client.query(
                        `UPDATE expenses SET category_id = $1 WHERE category_id = $2`,
                        [newCatId, oldCat.id]
                    );
                }
            }
        }

        // 3. Delete old categories
        const newCatNames = categories.map(c => c.name);
        console.log('Deleting old categories...');
        await client.query(
            `DELETE FROM expense_categories WHERE name NOT IN (${newCatNames.map((_, i) => `$${i + 1}`).join(', ')})`,
            newCatNames
        );

        console.log('Seeding and migration successful.');
    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        await client.end();
    }
}

seed();
