# Dhatterwal Solar ERP Web

React + Vite frontend + **Express API + PostgreSQL** — production stack is **Hostinger VPS only** (no Railway / Neon).

| Layer | Hostinger VPS |
|-------|----------------|
| Domain | `dhatterwalsolar.com` → VPS IP |
| Frontend | Nginx → `/var/www/dhatterwal/dist` |
| Backend | PM2 → Express `:8787`, Nginx proxies `/api` |
| Database | Local PostgreSQL `dhatterwal_erp` |

## Local development

```bash
npm install
npm run server
```

Second terminal:

```bash
npm run dev
```

- Web: http://localhost:5173  
- API: http://localhost:8787/api/health  

Local DB default: PGlite (`server/.env` → `USE_PGLITE=true`). Docker optional: `npm run db:up`.

### Login
- Admin: `admin / admin123`
- Staff: `jagdeep / jagdeep123`, `randeep / randeep123`, `ajaynain / ajaynain123`

## Production — Hostinger VPS

Scripts: [`deploy/`](deploy/) (`vps-setup.sh`, `nginx-dhatterwal.conf`, `ecosystem.config.cjs`, `push-to-vps.ps1`).

### One-time VPS bootstrap
1. Ubuntu 24.04 — as root: `bash deploy/vps-setup.sh`
2. App path: `/var/www/dhatterwal`
3. `server/.env` — see [`deploy/server.env.vps.example`](deploy/server.env.vps.example)  
   (`USE_PGLITE=false`, local `DATABASE_URL`, `PGSSL=false`, strong `ERP_JWT_SECRET`)
4. Deploy code + `pm2 start deploy/ecosystem.config.cjs`
5. DNS A records → VPS IP (`187.77.129.179`)
6. SSL: `certbot --nginx -d dhatterwalsolar.com -d www.dhatterwalsolar.com`

### Deploy from this PC (Windows)
1. SSH key ready for `root@187.77.129.179`
2. PowerShell:

```powershell
.\deploy\push-to-vps.ps1
```

Or GitHub Actions: [`.github/workflows/deploy-hostinger.yml`](.github/workflows/deploy-hostinger.yml)  
Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VITE_API_URL` = **empty**.

### Production frontend
`.env.production` must keep `VITE_API_URL=` empty so the browser uses same-origin `/api` via Nginx.

## Cut over from Railway / Neon

1. Confirm VPS health: `http://VPS_IP/health` → `"database":"postgresql"`
2. Confirm login on IP with **same-origin** build (not Railway URL)
3. Point domain DNS to VPS; enable SSL
4. Delete Railway project + pause/delete Neon — see [`deploy/cutover-hostinger.md`](deploy/cutover-hostinger.md)

## Important

- `server/.env` git me mat daalo
- Documents `erp_kv` me hain — DB size badh sakti hai
- E-Way abhi default demo/stub hai
