-- ============================================
-- Investor Dashboard App - Database Schema
-- ============================================
-- Run this script in your Supabase SQL Editor
-- ============================================

-- Drop existing tables if they exist (use with caution in production)
-- Uncomment the following lines if you need to recreate tables:
-- DROP TABLE IF EXISTS quarter_goal CASCADE;
-- DROP TABLE IF EXISTS pipeline_client CASCADE;
-- DROP TABLE IF EXISTS employee_count CASCADE;
-- DROP TABLE IF EXISTS customer CASCADE;
-- DROP TABLE IF EXISTS monthly_burn CASCADE;
-- DROP TABLE IF EXISTS cash_position CASCADE;
-- DROP TABLE IF EXISTS investor_password CASCADE;

-- ============================================
-- Tables
-- ============================================

-- Investor Password Table
-- Stores passwords for investor authentication
CREATE TABLE IF NOT EXISTS investor_password (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  password TEXT NOT NULL,
  is_artemis_management BOOLEAN NOT NULL DEFAULT false,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cash Position Table
-- Tracks company cash position over time
CREATE TABLE IF NOT EXISTS cash_position (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount FLOAT NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly Burn Table
-- Tracks monthly burn rate
CREATE TABLE IF NOT EXISTS monthly_burn (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount FLOAT NOT NULL,
  month DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Table
-- Stores customer information and metrics
CREATE TABLE IF NOT EXISTS customer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_pilot BOOLEAN NOT NULL,
  contract_value FLOAT,
  arr FLOAT,
  start_date DATE,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employee Count Table
-- Tracks employee count over time (full-time and contractors)
CREATE TABLE IF NOT EXISTS employee_count (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count INTEGER NOT NULL,
  date DATE NOT NULL,
  is_full_time BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pipeline Client Table
-- Tracks potential customers in the sales pipeline
CREATE TABLE IF NOT EXISTS pipeline_client (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  segment TEXT NOT NULL CHECK (segment IN ('smb', 'mid_market', 'large_cap')),
  stage TEXT NOT NULL CHECK (stage IN ('initial_meeting', 'pilot_scoping', 'pilot', 'contracting')),
  estimated_contract_size FLOAT,
  engagement_start_date DATE NOT NULL,
  status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quarter Goal Table
-- Stores quarterly goals and targets
CREATE TABLE IF NOT EXISTS quarter_goal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  target_value FLOAT NOT NULL,
  current_value FLOAT,
  quarter INTEGER NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
  year INTEGER NOT NULL,
  metric_type TEXT CHECK (metric_type IN ('ARR', 'customers', 'pipeline_value', 'custom')),
  "order" INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

-- Cash Position indexes
CREATE INDEX IF NOT EXISTS idx_cash_position_date ON cash_position(date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_position_created_at ON cash_position(created_at DESC);

-- Monthly Burn indexes
CREATE INDEX IF NOT EXISTS idx_monthly_burn_month ON monthly_burn(month DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_burn_created_at ON monthly_burn(created_at DESC);

-- Employee Count indexes
CREATE INDEX IF NOT EXISTS idx_employee_count_date ON employee_count(date DESC);
CREATE INDEX IF NOT EXISTS idx_employee_count_full_time ON employee_count(is_full_time, date DESC);

-- Pipeline Client indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_client_segment ON pipeline_client(segment);
CREATE INDEX IF NOT EXISTS idx_pipeline_client_stage ON pipeline_client(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_client_engagement_date ON pipeline_client(engagement_start_date DESC);

-- Quarter Goal indexes
CREATE INDEX IF NOT EXISTS idx_quarter_goal_quarter_year ON quarter_goal(quarter, year);
CREATE INDEX IF NOT EXISTS idx_quarter_goal_metric_type ON quarter_goal(metric_type);

-- Customer indexes
CREATE INDEX IF NOT EXISTS idx_customer_is_pilot ON customer(is_pilot);
CREATE INDEX IF NOT EXISTS idx_customer_status ON customer(status);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE investor_password ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_position ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_burn ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_count ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_client ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarter_goal ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies (Development)
-- ============================================
-- WARNING: These policies allow all operations for authenticated users.
-- In production, replace these with proper policies that check authentication
-- status from your admin-auth function.

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all for authenticated" ON investor_password;
DROP POLICY IF EXISTS "Allow all for authenticated" ON cash_position;
DROP POLICY IF EXISTS "Allow all for authenticated" ON monthly_burn;
DROP POLICY IF EXISTS "Allow all for authenticated" ON customer;
DROP POLICY IF EXISTS "Allow all for authenticated" ON employee_count;
DROP POLICY IF EXISTS "Allow all for authenticated" ON pipeline_client;
DROP POLICY IF EXISTS "Allow all for authenticated" ON quarter_goal;

-- Create permissive policies for development
-- TODO: Replace with proper authentication checks in production
CREATE POLICY "Allow all for authenticated" ON investor_password 
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated" ON cash_position 
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated" ON monthly_burn 
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated" ON customer 
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated" ON employee_count 
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated" ON pipeline_client 
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated" ON quarter_goal 
  FOR ALL USING (true);

-- ============================================
-- Sample Data (Optional)
-- ============================================
-- Uncomment to insert test data:

-- Insert a test investor password
-- INSERT INTO investor_password (password, is_artemis_management, name)
-- VALUES ('test_password', true, 'Test User');

-- ============================================
-- Verification Queries
-- ============================================
-- Run these to verify tables were created:

-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- ORDER BY table_name;

-- SELECT COUNT(*) FROM investor_password;
-- SELECT COUNT(*) FROM cash_position;
-- SELECT COUNT(*) FROM monthly_burn;
-- SELECT COUNT(*) FROM customer;
-- SELECT COUNT(*) FROM employee_count;
-- SELECT COUNT(*) FROM pipeline_client;
-- SELECT COUNT(*) FROM quarter_goal;

