-- ============================================
-- STAGING DATABASE MIGRATIONS
-- Run these SQL commands on poultry_stage database
-- ============================================

-- 1. Add sale_no column to godown_sales table
ALTER TABLE godown_sales 
ADD COLUMN IF NOT EXISTS sale_no VARCHAR(50);

-- 2. Create expense_categories table
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

-- 3. Insert default system categories
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

-- 4. Add category_id column to expenses table
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES expense_categories(id);

-- 5. Migrate existing category data to category_id
UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'Feed') WHERE category = 'feed' AND category_id IS NULL;
UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'Labor') WHERE category = 'labor' AND category_id IS NULL;
UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'Medicine') WHERE category = 'medicine' AND category_id IS NULL;
UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'Utilities') WHERE category = 'utilities' AND category_id IS NULL;
UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'Equipment') WHERE category = 'equipment' AND category_id IS NULL;
UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'Maintenance') WHERE category = 'maintenance' AND category_id IS NULL;
UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'Transportation') WHERE category = 'transportation' AND category_id IS NULL;
UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'Other') WHERE category = 'other' AND category_id IS NULL;

-- 7. Add missing columns to godown_inward_entries
ALTER TABLE godown_inward_entries
ADD COLUMN IF NOT EXISTS actual_weight NUMERIC(10,2);

ALTER TABLE godown_inward_entries
ADD COLUMN IF NOT EXISTS weight_loss NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 6. Verify migrations
SELECT 'godown_sales.sale_no column' as migration, 
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'godown_sales' AND column_name = 'sale_no'
       ) THEN '✓ EXISTS' ELSE '✗ MISSING' END as status
UNION ALL
SELECT 'expense_categories table' as migration,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables 
         WHERE table_name = 'expense_categories'
       ) THEN '✓ EXISTS' ELSE '✗ MISSING' END as status
UNION ALL
SELECT 'expense_categories records' as migration,
       CONCAT('✓ ', COUNT(*)::text, ' categories') as status
FROM expense_categories
UNION ALL
SELECT 'expenses.category_id column' as migration,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'expenses' AND column_name = 'category_id'
       ) THEN '✓ EXISTS' ELSE '✗ MISSING' END as status;
