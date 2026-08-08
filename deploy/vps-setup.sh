#!/usr/bin/env bash
# Hostinger Ubuntu 24.04 — one-time bootstrap for Dhatterwal ERP
# Usage (as root): bash deploy/vps-setup.sh
set -euo pipefail

APP_DIR=/var/www/dhatterwal
DB_NAME=dhatterwal_erp
DB_USER=erp
DOMAIN_MAIN=dhatterwalsolar.com

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg ufw nginx certbot python3-certbot-nginx \
  postgresql postgresql-contrib git rsync build-essential

# Node 20
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

npm install -g pm2

# App dirs
mkdir -p "$APP_DIR/dist" "$APP_DIR/server"
chown -R www-data:www-data "$APP_DIR" || true

# Postgres role + DB
DB_PASS="${ERP_DB_PASSWORD:-$(openssl rand -base64 24 | tr -d '=+/')}"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

echo ""
echo "=== SAVE THIS DB PASSWORD ==="
echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
echo "============================="
echo "$DB_PASS" > /root/dhatterwal-db-password.txt
chmod 600 /root/dhatterwal-db-password.txt

# Firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable || true

# Nginx site (HTTP first; certbot later)
if [[ -f "$APP_DIR/deploy/nginx-dhatterwal.conf" ]]; then
  cp "$APP_DIR/deploy/nginx-dhatterwal.conf" /etc/nginx/sites-available/dhatterwal
elif [[ -f "$(dirname "$0")/nginx-dhatterwal.conf" ]]; then
  cp "$(dirname "$0")/nginx-dhatterwal.conf" /etc/nginx/sites-available/dhatterwal
fi
ln -sfn /etc/nginx/sites-available/dhatterwal /etc/nginx/sites-enabled/dhatterwal
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "Bootstrap done."
echo "Next: rsync app → $APP_DIR, write server/.env, npm ci, prisma db push, pm2 start"
echo "SSL: certbot --nginx -d ${DOMAIN_MAIN} -d www.${DOMAIN_MAIN}"
