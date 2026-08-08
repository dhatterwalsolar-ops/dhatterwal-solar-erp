# Neon → VPS PostgreSQL (legacy one-time)

Agar data abhi Neon pe hai aur VPS Postgres khali hai, dump/restore:

```bash
pg_dump "postgresql://USER:PASS@HOST/neondb?sslmode=require" \
  --format=custom --no-owner --no-acl \
  -f neon-erp.dump

scp neon-erp.dump root@187.77.129.179:/root/neon-erp.dump

ssh root@187.77.129.179
sudo -u postgres pg_restore -d dhatterwal_erp --clean --if-exists --no-owner --no-acl /root/neon-erp.dump
curl -s http://127.0.0.1:8787/health
```

Restore + login OK ke baad: [`cutover-hostinger.md`](cutover-hostinger.md) follow karo (DNS, SSL, Railway/Neon delete).
