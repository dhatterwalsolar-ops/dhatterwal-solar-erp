# Dhatterwal Solar ERP Web

React + Vite frontend + **Express API + PostgreSQL**.

## 1) Database (Docker ke bina OK)

### Recommended abhi — PGlite (no Docker)
`server/.env` me pehle se:

```
USE_PGLITE=true
DATABASE_URL=pglite
```

Phir:

```bash
npm run server
```

Ye embedded Postgres-compatible DB hai (`server/data/pglite/`). Docker zaroori nahi.

### Baad me hosting — real PostgreSQL (Neon)
1. https://neon.tech pe free DB
2. `server/.env`:

```
USE_PGLITE=false
DATABASE_URL=postgresql://USER:PASS@HOST/DB?sslmode=require
PGSSL=true
```

3. `npm --prefix server run db:push`  
4. `npm run server`

### Optional — Docker
Jab Docker Desktop chal jaye: `npm run db:up` + normal `DATABASE_URL=postgresql://erp:erp@127.0.0.1:5432/dhatterwal_erp`

## 2) Install + run

```bash
npm install
npm run server
```

Dusri terminal:

```bash
npm run dev
```

- Web: http://localhost:5173  
- API health: http://localhost:8787/api/health  
- Pehli baar: purana `server/data/erp-store.json` automatic PostgreSQL me migrate (agar DB khali ho)

### Login
- Admin: `admin / admin123`
- Staff: `jagdeep / jagdeep123`, `randeep / randeep123`, `ajaynain / ajaynain123`

## Database (Prisma + PostgreSQL)

`server/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

| Table | Purpose |
|-------|---------|
| `erp_kv` | Saari ERP sheets/settings (key → JSON text) |
| `erp_meta` | Last sync timestamp |

Tables banane ke baad (Postgres chal raha ho):

```bash
npm --prefix server run db:push
```

Frontend sync API same hai (`/api/sync`) — storage Prisma → Postgres.

## Production hosting (Neon + Railway + Hostinger)

Render free API suspended hai — production API **Railway** pe chalao. Neon DB same rehti hai.

### Check (local)
```bash
npm --prefix server run db:test
```
Neon OK hona chahiye (`"provider":"neon"`).

### A) API — Railway
1. Code GitHub pe push karo (`dhatterwal-solar-erp`)
2. https://railway.app → **New Project** → **Deploy from GitHub** → repo select
3. Settings:
   - **Root Directory:** `server`
   - Config: [`server/railway.toml`](server/railway.toml) (build/start/healthcheck)
4. Variables:
   - `DATABASE_URL` = Neon connection string (`sslmode=require&pgbouncer=true`)
   - `USE_PGLITE` = `false`
   - `PGSSL` = `true`
   - `ERP_JWT_SECRET` = strong random string (purana secret same rakhoge to existing JWTs valid rehte hain)
5. Generate domain → URL milegi jaise `https://dhatterwal-erp-api.up.railway.app`
6. Verify: `https://YOUR-URL/health`

### B) Frontend — Hostinger (GitHub Actions auto-deploy)
Har `main` push (frontend files) pe workflow `Deploy frontend to Hostinger` chalega:
[`.github/workflows/deploy-hostinger.yml`](.github/workflows/deploy-hostinger.yml)

GitHub → repo → **Settings** → **Secrets and variables** → **Actions** me set karo:

| Secret | Example |
|--------|---------|
| `VITE_API_URL` | `https://api-production-02c2.up.railway.app` |
| `FTP_SERVER` | Hostinger FTP hostname (hPanel → FTP Accounts) |
| `FTP_USERNAME` | FTP username |
| `FTP_PASSWORD` | FTP password |
| `FTP_SERVER_DIR` | `public_html/` (optional; default yahi) |

Manual bhi chal sakta hai: Actions → **Deploy frontend to Hostinger** → **Run workflow**.

Local fallback: `.env.production` me `VITE_API_URL` → `npm run build` → `dist/` upload.

### C) API — Railway GitHub auto-deploy
Railway service `api` GitHub repo `dhatterwalsolar-ops/dhatterwal-solar-erp` + root `/server` se connected hai. `main` pe `server/` changes → auto redeploy.

## Important

- `server/.env` git me mat daalo (password leak)
- Neon password rotate karo agar share ho chuka ho
- Documents `erp_kv` me hain — DB size badh sakti hai
- E-Way abhi local stub hai
