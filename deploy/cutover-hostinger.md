# Cut over — sab Hostinger VPS pe

Target: domain + frontend + API + PostgreSQL **sirf** VPS pe. Railway + Neon band.

VPS IP (example): `187.77.129.179`  
Domain: `dhatterwalsolar.com`

## 1) VPS pe stack verify

```bash
curl -s http://127.0.0.1:8787/health
# expect: "database":"postgresql", keyCount > 0

pm2 status
# dhatterwal-erp-api = online
```

`server/.env` me **local Postgres** hona chahiye (`127.0.0.1`), Neon URL nahi.

## 2) Same-origin frontend deploy

PC pe (repo root):

```powershell
# .env.production → VITE_API_URL= (empty)
npm run build
.\deploy\push-to-vps.ps1
```

Browser: `http://187.77.129.179` → login. DevTools Network me API calls  
`http://187.77.129.179/api/...` honi chahiye — `railway.app` **nahi**.

## 3) Domain DNS (Hostinger hPanel)

DNS zone for `dhatterwalsolar.com`:

| Type | Name | Value | TTL |
|------|------|--------|-----|
| A | `@` | `187.77.129.179` | 300 |
| A | `www` | `187.77.129.179` | 300 |

Hatao / disable: purane shared-hosting A records, CDN CNAME (`cdn.hstgr.net`) agar VPS Nginx use kar rahe ho.

Propagate hone tak 5–30 min.

## 4) SSL

VPS pe:

```bash
certbot --nginx -d dhatterwalsolar.com -d www.dhatterwalsolar.com
nginx -t && systemctl reload nginx
curl -s https://dhatterwalsolar.com/health
```

## 5) Railway + Neon band

1. https://railway.app → project → **Settings → Delete project** (ya service Pause/Delete)
2. Neon dashboard → project pause/delete
3. Local `.env.production` me Railway URL mat rakho (empty `VITE_API_URL`)

## 6) Final check

- [ ] `https://dhatterwalsolar.com` login OK
- [ ] `/health` JSON with postgresql
- [ ] Network tab me koi `railway.app` / `neon.tech` request nahi
- [ ] Railway project deleted
