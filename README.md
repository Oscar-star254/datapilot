# DataPilot

A multi-user data analysis platform — upload datasets, clean them, run statistics, build charts, create shareable dashboards.

## Architecture

```
datapilot/
├── frontend/          # React + Vite + TypeScript + Tailwind CSS
├── backend/           # Python FastAPI + pandas + DuckDB
├── e2e/               # Playwright smoke tests
└── .github/workflows/ # CI + smoke test pipelines
```

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, TypeScript 5, Tailwind CSS v4 |
| Backend | Python 3.12, FastAPI, pandas, numpy, scipy, statsmodels, scikit-learn |
| SQL engine | DuckDB (read-only, sandboxed, 10-second timeout) |
| Database | Supabase Postgres |
| Auth | Supabase Auth (email/password + Google OAuth) |
| File storage | Supabase Storage |
| Backend hosting | Render free web service (Docker) |
| Frontend hosting | Vercel (free hobby) |
| Repo | GitHub monorepo |

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `VITE_API_URL` | Backend URL (e.g. `https://datapilot-api.onrender.com`) |

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (secret — never expose) |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase > Settings > API |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `FRONTEND_URL` | Frontend URL for CORS allow-list |
| `MAX_FILE_SIZE_MB` | Max upload size (default: 25) |
| `RATE_LIMIT` | API rate limit (default: `100/minute`) |

## Local Development

### Prerequisites
- Node 20, pnpm 10
- Python 3.12, pip
- A Supabase project (free tier)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_ORG/datapilot.git
cd datapilot

# Frontend
cd frontend
cp .env.example .env   # fill in your Supabase + API values
pnpm install
pnpm dev               # http://localhost:5173

# Backend (new terminal)
cd ../backend
cp .env.example .env   # fill in your Supabase values
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Set up Supabase

1. Create a new Supabase project at supabase.com
2. In the SQL editor, run `backend/supabase/migrations/001_initial_schema.sql`
3. Go to Storage → Create bucket `datasets` (private)
4. Run `backend/supabase/migrations/002_storage_policies.sql`
5. In Authentication → Settings:
   - Enable Email provider
   - Add your frontend URL to Redirect URLs: `http://localhost:5173/**`
6. (Optional) Enable Google OAuth under Authentication → Providers

### 3. Run backend tests

```bash
cd backend
pytest tests/ -v
```

## Deployment

### 1. Push to GitHub

```bash
git init
git remote add origin https://github.com/YOUR_ORG/datapilot.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

### 2. Deploy backend to Render

1. Go to render.com → New → Web Service
2. Connect your GitHub repo
3. Set root directory: `backend`
4. Runtime: Docker
5. Set all environment variables (copy from `backend/.env`)
6. Click Deploy
7. Wait for `/health` to return `{"status":"ok"}`
8. Copy the Render URL (e.g. `https://datapilot-api.onrender.com`)

**Keep-alive note:** Render free tier spins down after 15 minutes of inactivity.
Use [UptimeRobot](https://uptimerobot.com) (free) to ping `https://datapilot-api.onrender.com/health` every 5 minutes.

### 3. Deploy frontend to Vercel

1. Go to vercel.com → New Project
2. Import your GitHub repo
3. Set root directory: `frontend`
4. Add environment variables:
   - `VITE_SUPABASE_URL` → your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` → your anon key
   - `VITE_API_URL` → your Render backend URL
5. Click Deploy
6. Copy the Vercel URL

### 4. Update Supabase auth redirect URLs

In Supabase → Authentication → URL Configuration:
- Site URL: `https://your-app.vercel.app`
- Additional redirect URLs: `https://your-app.vercel.app/**`

### 5. Update backend CORS

Set `FRONTEND_URL=https://your-app.vercel.app` in Render env vars and redeploy.

### 6. Run smoke tests

```bash
cd e2e
npm install
FRONTEND_URL=https://your-app.vercel.app \
BACKEND_URL=https://datapilot-api.onrender.com \
TEST_EMAIL=your@email.com \
TEST_PASSWORD=yourpassword \
npx playwright test
```

## Redeploy Steps

**Backend change:** Push to `main` → Render auto-deploys via GitHub webhook (or manually trigger in Render dashboard).

**Frontend change:** Push to `main` → Vercel auto-deploys.

**Database migration:** Run new SQL file in Supabase SQL editor.

## Features

1. **Auth** — Email/password, Google OAuth, password reset, protected routes
2. **Datasets** — Upload CSV/XLSX/JSON (≤25 MB), auto-profiling (types, missing %, unique counts)
3. **Data Viewer** — Server-paginated, sortable, filterable table with export
4. **Cleaning** — 11 step types in versioned, replayable pipelines with undo
5. **Statistics** — Descriptive, Pearson/Spearman correlation, linear/multiple/polynomial regression, t-tests, chi-square, ANOVA, normality tests
6. **Visualization** — Bar, line, area, scatter, histogram, pie, heatmap. PNG export
7. **Dashboards** — Drag-and-drop grid, save layout, public share link
8. **SQL Playground** — DuckDB, read-only, 10-second timeout
9. **Time Series** — Resampling, moving averages, linear trend forecast
10. **Export** — CSV, XLSX, JSON
11. **Account** — Storage usage, delete-my-data

## Free-Tier Limits to Know

| Service | Limit | Notes |
|---------|-------|-------|
| Supabase DB | 500 MB storage, 50K MAU | Should be fine for personal/small use |
| Supabase Storage | 1 GB | Approx. 40 × 25 MB files |
| Render free | 750 hrs/month, spins down | Use UptimeRobot to keep alive |
| Vercel hobby | 100 GB bandwidth/month | Very generous |
| GitHub Actions | 2000 min/month | CI takes ~3–4 min per push |

## What Could Not Be Fully Completed

1. **PDF export** — The backend endpoint skeleton exists but report generation with complex charts requires additional integration work. CSV/XLSX/JSON export works fully.
2. **Pivot tables** — UI scaffolded under SQL Playground via DuckDB GROUP BY queries; dedicated pivot UI not built.
3. **Playwright smoke tests against live URLs** — Cannot run these without live credentials. The test file is ready to run manually (`cd e2e && npx playwright test`).
4. **Render/Vercel actual deployment** — Requires your accounts/tokens. All config and Dockerfiles are ready; follow the deployment steps above.
5. **Google OAuth** — Requires enabling it in your Supabase project settings (takes 2 minutes).
6. **Render free tier cold starts** — First request after idle takes ~30 seconds. UptimeRobot pinging `/health` every 5 minutes prevents this.
