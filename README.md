# Investor Dashboard App

A standalone investor metrics dashboard application using Supabase for backend services.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `env.template`:
```bash
cp env.template .env
```

3. Fill in your Supabase credentials:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Supabase Setup

### Database Tables

Create the following tables in your Supabase database:

1. **investor_password**
   - id (uuid, primary key)
   - password (text)
   - is_artemis_management (boolean)
   - name (text, nullable)

2. **cash_position**
   - id (uuid, primary key)
   - amount (float)
   - date (date)
   - notes (text, nullable)

3. **monthly_burn**
   - id (uuid, primary key)
   - amount (float)
   - month (date)
   - notes (text, nullable)

4. **customer**
   - id (uuid, primary key)
   - name (text)
   - is_pilot (boolean)
   - contract_value (float, nullable)
   - arr (float, nullable)
   - start_date (date, nullable)
   - status (text, nullable)

5. **employee_count**
   - id (uuid, primary key)
   - count (integer)
   - date (date)
   - is_full_time (boolean)

6. **pipeline_client**
   - id (uuid, primary key)
   - name (text)
   - segment (text) - values: "smb", "mid_market", "large_cap"
   - stage (text) - values: "initial_meeting", "pilot_scoping", "pilot", "contracting"
   - estimated_contract_size (float, nullable)
   - engagement_start_date (date)
   - status (text, nullable)
   - notes (text, nullable)

7. **quarter_goal**
   - id (uuid, primary key)
   - name (text)
   - target_value (float)
   - current_value (float, nullable)
   - quarter (integer) - values: 1-4
   - year (integer)
   - metric_type (text, nullable) - values: "ARR", "customers", "pipeline_value", "custom"
   - order (integer, nullable)

### Row Level Security (RLS)

Enable RLS on all tables and create policies that only allow access after admin-auth function passes. You can use a custom claim or session variable set by the admin-auth function.

### Edge Function Setup

1. Deploy the `admin-auth` function:
```bash
supabase functions deploy admin-auth
```

2. Set environment variables for the function:
```bash
supabase secrets set DATABASE_PASSWORD=your_database_password
supabase secrets set ALLOWED_DOMAINS=localhost:5173,your-production-domain.com
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

The `admin-auth` function:
- Validates the request origin against allowed domains (CORS)
- Checks the provided password against the `investor_password` table
- Returns authentication status and management permissions
- All data access must go through this authentication first

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Security Notes

- The admin-auth function must be called before any data access
- All API calls should check for authentication status
- CORS is enforced at the edge function level
- Database password is stored securely in Supabase secrets

# investor-dash
