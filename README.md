# Tradephex

> Execute. Analyze. Elevate.

Premium futures trading platform — trade journal, analytics dashboard, live charts, and trade replay.

## Tech Stack

- **Frontend**: HTML/CSS/JS (upgrading to Next.js)
- **Deployment**: Vercel
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Data Feed**: Rithmic (coming soon)

## Project Structure

```
tradephex/
├── public/
│   ├── index.html          ← Marketing website (tradephex.com)
│   ├── journal.html        ← Trade journal app
│   └── assets/
│       └── logos/          ← Logo PNG files
├── src/
│   ├── lib/
│   │   └── supabase.js     ← Supabase client
│   └── auth/
│       └── auth.js         ← Auth helpers
├── vercel.json             ← Vercel config
├── .env.local              ← Environment variables (never commit this)
└── README.md
```

## Setup Instructions

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/tradephex.git
cd tradephex
```

### 2. Set up Supabase
1. Go to supabase.com → New Project → Name it "tradephex"
2. Copy your Project URL and anon key
3. Run the SQL in `supabase/schema.sql` in the Supabase SQL editor
4. Enable Email auth in Authentication → Providers

### 3. Environment variables
Create `.env.local` in the root:
```
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
```

### 4. Deploy to Vercel
1. Push to GitHub
2. Go to vercel.com → New Project → Import your GitHub repo
3. Add environment variables in Vercel dashboard
4. Set custom domain to tradephex.com

### 5. Connect domain
In Vercel: Settings → Domains → Add tradephex.com
In your domain registrar (GoDaddy): Add the DNS records Vercel provides

## Database Schema

See `supabase/schema.sql` for full schema.

**Tables:**
- `profiles` — user accounts
- `trades` — trade journal entries
- `trade_notes` — post-trade review notes
- `sessions` — daily trading sessions

## Roadmap

- [x] Marketing website
- [x] Trade journal UI
- [x] Analytics dashboard
- [x] Economic calendar
- [x] Trade replay
- [ ] Supabase auth + database
- [ ] Live Rithmic data feed
- [ ] Order execution
- [ ] Mobile app

## Contact

tradephex.com | info@tradephex.com | @tradephex
