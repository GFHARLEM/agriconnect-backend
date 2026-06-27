## Supabase Setup Guide for AgriConnect

This guide will help you set up Supabase as your database for AgriConnect.

### Step 1: Create a Supabase Account and Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Create a new project
4. Note down your project URL and API keys

### Step 2: Get Your Supabase Credentials

In your Supabase dashboard:

1. Go to **Project Settings** → **API**
2. Copy your **Project URL** (looks like `https://your-project.supabase.co`)
3. Copy your **anon** key (under "API keys")

### Step 3: Create the Database Tables

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `db/supabase-schema.sql`
4. Paste it into the SQL editor
5. Click **Run** to execute the schema

### Step 4: Update Your Environment Variables

In your `.env` file, replace the placeholders:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
```

### Step 5: Start the Application

```bash
npm run dev
```

The server should now start successfully with Supabase as your database backend!

### API Endpoints

Once running:

- **Health Check**: `GET http://localhost:3000/health`
- **SMS Webhook**: `POST http://localhost:3000/sms/inbound`
- **USSD Webhook**: `POST http://localhost:3000/ussd`
- **Analytics**: 
  - `GET http://localhost:3000/analytics/top-pests`
  - `GET http://localhost:3000/analytics/top-crops`
  - `GET http://localhost:3000/analytics/farmer-count`
  - `GET http://localhost:3000/analytics/recent-advisories`

### Database Schema

The following tables are created:

- **farmers**: Stores farmer information (phone, name, region)
- **crops**: Stores crop types
- **pests**: Stores pest information
- **diseases**: Stores disease information
- **advisories**: Stores advisor responses and relationships to farmers/crops/pests/diseases

### Troubleshooting

**Error: "Missing required environment variable: SUPABASE_URL"**
- Make sure you've updated your `.env` file with correct Supabase credentials

**Error: "Supabase client not initialized"**
- The app should automatically initialize the Supabase client on startup
- Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set

**No data appearing in advisories**
- Make sure the Supabase tables exist by running the schema SQL
- Check that RLS policies are configured (see `supabase-schema.sql`)

### Next Steps

1. Configure Africa's Talking integration for SMS/USSD
2. Configure Featherless AI for the LLM advisor
3. Set up webhooks to receive SMS and USSD requests
4. Monitor advisories and analytics through the REST endpoints
