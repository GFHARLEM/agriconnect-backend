# AgriConnect – Prototype Backend

SMS/USSD pest & disease advisory for Ugandan smallholder farmers.

## Stack
| Layer | Tool |
|---|---|
| Runtime | Node.js (Express) |
| LLM | Featherless AI (DeepSeek-V4-Pro) |
| Channels | Africa's Talking (SMS + USSD) |
| Database | Supabase (PostgreSQL) |

---

## Setup

### Quick Start

1. **Clone and install**
   ```bash
   npm install
   ```

2. **Set up Supabase** (see [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for detailed guide)
   - Create project at [supabase.com](https://supabase.com)
   - Copy Project URL and Anon Key
   - Run SQL schema from `db/supabase-schema.sql`

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials:
   # - SUPABASE_URL
   # - SUPABASE_ANON_KEY
   # - FEATHERLESS_API_KEY
   # - AT_API_KEY
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```

For detailed setup instructions, see [SUPABASE_SETUP.md](SUPABASE_SETUP.md)

---

## Exposing to Africa's Talking (local testing)

Africa's Talking needs a public URL to POST to. Use ngrok:

```bash
npm install -g ngrok
ngrok http 3000
# Copy the https://xxxx.ngrok.io URL
```

In your Africa's Talking dashboard:
- **SMS callback URL**: `https://xxxx.ngrok.io/sms/inbound`
- **USSD callback URL**: `https://xxxx.ngrok.io/ussd`

---

## Testing without a phone

### Test SMS advisory (curl)
```bash
curl -X POST http://localhost:3000/sms/inbound \
  -d "from=+256712345678" \
  -d "text=My maize has white spots on the leaves"
```

### Test USSD menu (curl)
```bash
# Dial in (welcome screen)
curl -X POST http://localhost:3000/ussd \
  -d "sessionId=test-001" \
  -d "phoneNumber=+256712345678" \
  -d "serviceCode=*123#" \
  -d "text="

# Choose option 1
curl -X POST http://localhost:3000/ussd \
  -d "sessionId=test-001" \
  -d "phoneNumber=+256712345678" \
  -d "serviceCode=*123#" \
  -d "text=1"

# Enter question
curl -X POST http://localhost:3000/ussd \
  -d "sessionId=test-001" \
  -d "phoneNumber=+256712345678" \
  -d "serviceCode=*123#" \
  -d "text=1*My cassava leaves are turning yellow"
```

### Analytics endpoints
```bash
curl http://localhost:3000/analytics/top-pests
curl http://localhost:3000/analytics/top-crops
curl http://localhost:3000/analytics/farmer-count
curl http://localhost:3000/analytics/recent-advisories?limit=5
```

---

## File Map

```
agriconnect/
├── server.js                  ← Entry point, starts Express + Supabase
├── config/index.js            ← All env vars validated in one place
├── db/
│   ├── supabase.js            ← Supabase client & helper functions
│   └── supabase-schema.sql    ← SQL schema for database tables
├── services/
│   ├── llm.js                 ← Featherless AI wrapper
│   ├── advisory.js            ← Core logic: LLM + Supabase persistence
│   ├── sms.js                 ← Africa's Talking SMS sender
│   └── ussd.js                ← USSD menu state machine
├── routes/
│   ├── sms.js                 ← POST /sms/inbound
│   ├── ussd.js                ← POST /ussd
│   └── analytics.js           ← GET  /analytics/*
├── middleware/
│   └── logger.js              ← Request logging
├── SUPABASE_SETUP.md          ← Supabase setup guide
└── MIGRATION_GUIDE.md         ← Neo4j to Supabase migration details
```

---

## Database Schema

AgriConnect uses **Supabase** (PostgreSQL) with the following tables:

- **farmers**: Farmer profiles (phone, name, region)
- **crops**: Crop types (maize, cassava, beans, etc.)
- **pests**: Pest information (armyworm, aphids, etc.)
- **diseases**: Disease information (mosaic, blight, etc.)
- **advisories**: Advisory responses with relationships to farmers, crops, pests, and diseases

See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for complete schema and [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) for details on the Neo4j → Supabase transition.
