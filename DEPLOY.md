# Deploying to Render (Free)

## Services used (all free tier)
| Service | Provider | Cost |
|---|---|---|
| Backend API | Render Web Service | Free |
| Frontend | Render Static Site | Free, never sleeps |
| PostgreSQL | Render Postgres | Free, 256MB |
| Redis | Upstash | Free, 10k req/day |

---

## Step 1 — Get a free Redis from Upstash

1. Go to https://upstash.com and sign up (free)
2. Click **Create Database**
3. Name: `llm-gateway-redis`, Region: `US-East-1`, Type: `Regional`
4. Click **Create**
5. Copy the **Redis URL** — looks like:
   ```
   rediss://default:PASSWORD@HOST.upstash.io:6379
   ```
   Save it — you'll need it in Step 3.

---

## Step 2 — Deploy to Render via Blueprint

1. Go to https://render.com and sign up (free)
2. Click **New → Blueprint**
3. Connect your GitHub account and select the `llm-gateway` repo
4. Render reads `render.yaml` automatically and shows 3 services:
   - `llm-gateway-api` (Web Service)
   - `llm-gateway-frontend` (Static Site)
   - `llm-gateway-db` (PostgreSQL)
5. Click **Apply** — Render starts building

---

## Step 3 — Set environment variables on the API service

After the blueprint is applied, go to:
**Render Dashboard → llm-gateway-api → Environment**

Add these variables:

| Key | Value |
|---|---|
| `REDIS_URL` | Your Upstash Redis URL from Step 1 |
| `GATEWAY_SECRET_KEY` | Run `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` and paste the output |
| `ADMIN_API_KEY` | Any strong password you choose |
| `DATABASE_SYNC_URL` | Same as DATABASE_URL but replace `postgresql+asyncpg` with `postgresql+psycopg2` (Render auto-fills DATABASE_URL) |
| `OPENROUTER_API_KEY` | Your OpenRouter key (optional) |

Click **Save Changes** — the service will redeploy automatically.

---

## Step 4 — Get the backend URL

Once the API service is deployed and healthy:
1. Go to **Render Dashboard → llm-gateway-api**
2. Copy the URL at the top — looks like:
   ```
   https://llm-gateway-api.onrender.com
   ```

---

## Step 5 — Set the frontend env vars

Go to **Render Dashboard → llm-gateway-frontend → Environment**

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://llm-gateway-api.onrender.com` (from Step 4) |
| `VITE_ADMIN_KEY` | Same value as `ADMIN_API_KEY` from Step 3 |

Click **Save Changes** — the frontend rebuilds with the correct backend URL.

---

## Step 6 — Verify

- Frontend: `https://llm-gateway-frontend.onrender.com`
- Backend health: `https://llm-gateway-api.onrender.com/health`
- Backend docs: `https://llm-gateway-api.onrender.com/docs`
- Metrics: `https://llm-gateway-api.onrender.com/metrics`

The seed script runs automatically on startup and creates the 3 demo teams.

---

## Free tier limits to know

| Limit | Detail |
|---|---|
| Backend sleeps | After 15 min of no traffic, first request takes ~30s to wake up |
| Frontend | Never sleeps — always instant |
| Postgres | 256MB storage, expires after 90 days (free) |
| Upstash Redis | 10,000 commands/day, 256MB |

---

## Running locally (no Render)

```bash
# Start Redis (Windows)
"C:\Program Files\Redis\redis-server.exe" --port 6379

# Start gateway
python -m uvicorn gateway.main:app --host 127.0.0.1 --port 8000

# Start frontend
cd frontend && npm run dev
```
