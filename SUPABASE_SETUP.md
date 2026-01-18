# Supabase Setup Guide

## Database Schema

Run these SQL commands in your Supabase SQL Editor to create the required tables:

```sql
-- Investor Password Table
CREATE TABLE investor_password (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  password TEXT NOT NULL,
  is_artemis_management BOOLEAN NOT NULL DEFAULT false,
  name TEXT
);

-- Cash Position Table
CREATE TABLE cash_position (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount FLOAT NOT NULL,
  date DATE NOT NULL,
  notes TEXT
);

-- Monthly Burn Table
CREATE TABLE monthly_burn (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount FLOAT NOT NULL,
  month DATE NOT NULL,
  notes TEXT
);

-- Customer Table
CREATE TABLE customer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_pilot BOOLEAN NOT NULL,
  contract_value FLOAT,
  arr FLOAT,
  start_date DATE,
  status TEXT
);

-- Employee Count Table
CREATE TABLE employee_count (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count INTEGER NOT NULL,
  date DATE NOT NULL,
  is_full_time BOOLEAN NOT NULL
);

-- Pipeline Client Table
CREATE TABLE pipeline_client (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  segment TEXT NOT NULL CHECK (segment IN ('smb', 'mid_market', 'large_cap')),
  stage TEXT NOT NULL CHECK (stage IN ('initial_meeting', 'pilot_scoping', 'pilot', 'contracting')),
  estimated_contract_size FLOAT,
  engagement_start_date DATE NOT NULL,
  status TEXT,
  notes TEXT
);

-- Quarter Goal Table
CREATE TABLE quarter_goal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  target_value FLOAT NOT NULL,
  current_value FLOAT,
  quarter INTEGER NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
  year INTEGER NOT NULL,
  metric_type TEXT CHECK (metric_type IN ('ARR', 'customers', 'pipeline_value', 'custom')),
  "order" INTEGER
);

-- Create indexes for better query performance
CREATE INDEX idx_cash_position_date ON cash_position(date DESC);
CREATE INDEX idx_monthly_burn_month ON monthly_burn(month DESC);
CREATE INDEX idx_employee_count_date ON employee_count(date DESC);
CREATE INDEX idx_employee_count_full_time ON employee_count(is_full_time, date DESC);
CREATE INDEX idx_pipeline_client_segment ON pipeline_client(segment);
CREATE INDEX idx_quarter_goal_quarter_year ON quarter_goal(quarter, year);
```

## Row Level Security (RLS)

Enable RLS on all tables. For now, you can disable RLS during development, but in production you should implement proper RLS policies that check for authentication via the admin-auth function.

```sql
-- Enable RLS on all tables
ALTER TABLE investor_password ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_position ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_burn ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_count ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_client ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarter_goal ENABLE ROW LEVEL SECURITY;

-- For development, you can temporarily allow all operations:
-- (Remove these in production and implement proper policies)
CREATE POLICY "Allow all for authenticated" ON investor_password FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON cash_position FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON monthly_burn FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON customer FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON employee_count FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON pipeline_client FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON quarter_goal FOR ALL USING (true);
```

## Edge Function Deployment

1. Install Supabase CLI if you haven't already:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link your project:
```bash
supabase link --project-ref your-project-ref
```

4. Deploy the admin-auth function:
```bash
supabase functions deploy admin-auth
```

5. Set environment variables:
```bash
supabase secrets set DATABASE_PASSWORD=your_actual_database_password
supabase secrets set ALLOWED_DOMAINS=localhost:5173,localhost:3000,your-production-domain.com
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Note: Get your service role key from Supabase Dashboard > Settings > API

## Testing

1. Insert a test password in the investor_password table:
```sql
INSERT INTO investor_password (password, is_artemis_management, name)
VALUES ('test_password', true, 'Test User');
```

2. Test the admin-auth function:
```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/admin-auth \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-anon-key" \
  -d '{"password": "test_password"}'
```

You should receive a response with `authenticated: true` and `isArtemisManagement: true`.

