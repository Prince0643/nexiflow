# NexiFlow / Clockistry Re-deployment Guide

This guide is a practical checklist for re-deploying **Frontend**, **Backend API**, and **MySQL DB**, plus how to **inspect logs / errors** in production.

## 0) Fill in your production values (recommended)

Use this section to record your real production details (so you can copy/paste commands later).

```text
Server: srv1240392
Repo path: /var/www/nexiflow

Frontend domain: https://nexiflow-new.nexistrydigitalsolutions.com
API base URL: https://nexiflow-new.nexistrydigitalsolutions.com/api

API runtime:
- PM2 app name: <fill>
- OR systemd service: <fill>
- API listen port (internal): <fill> (example: 3001)

Nginx site file:
- /etc/nginx/sites-available/<fill>

MySQL:
- DB host: <fill> (example: 127.0.0.1)
- DB name: clockistry
- DB user: clockistry_user
```

### 0.1 Discover values quickly (run on the server)

```bash
# PM2 (if used)
pm2 ls
pm2 describe <app-name>

# systemd (if used)
sudo systemctl list-units --type=service | grep -i -E "nexiflow|clockistry|api"

# API port listening
sudo ss -ltnp | grep -E ":3001|node" || true

# Nginx site config
ls -la /etc/nginx/sites-available
ls -la /etc/nginx/sites-enabled
sudo nginx -t

# Where is mysql-schema.sql on the server?
sudo find /var/www -name "mysql-schema.sql" -maxdepth 5 2>/dev/null
```

## 1) Identify how production is running

Before you restart anything, confirm what process manager you use:

### A) PM2

```bash
pm2 ls
pm2 describe <app-name>
pm2 logs <app-name> --lines 200
```

### B) systemd

```bash
sudo systemctl status <service-name> --no-pager
sudo journalctl -u <service-name> -n 200 --no-pager
```

### C) Manual Node (not recommended)

```bash
ps aux | grep node
```

## 2) Frontend re-deploy (Vite / React)

### 2.1 Local build

From the repo root:

```bash
npm ci
npm run build
```

Output is usually in `dist/`.

### 2.2 Confirm API base URL used by the build

Your frontend reads the API base URL from:

- `VITE_API_BASE_URL`

Example (production):

```env
VITE_API_BASE_URL=https://nexiflow-new.nexistrydigitalsolutions.com/api
```

Rebuild after changing any `VITE_*` variables.

### 2.3 Upload/serve the built frontend

Typical patterns:

- If you serve static files via **Nginx/Apache**:
  - Copy the contents of `dist/` into your web root (commonly `/var/www/<site>/html` or similar)
  - Reload the web server

- If you deploy via **CI/CD**:
  - Push the changes and let the pipeline rebuild + deploy

### 2.5 If Nginx serves the frontend

Common commands:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 2.4 Hard refresh and verify

- Browser hard refresh: `Ctrl + Shift + R`
- Open DevTools -> Network
  - Confirm requests go to the correct `/api/...` domain

## 3) Backend API re-deploy (Express in `api/`)

### 3.1 Pull latest code

On the server:

```bash

# Backend
cd /var/www/nexiflow && git pull
cd /var/www/nexiflow/api && npm ci
pm2 restart all || sudo systemctl restart nexiflow-api

# Frontend (if built on server)
cd /var/www/nexiflow && npm ci && npm run build
sudo systemctl reload nginx

# Quick health + logs
curl -i https://nexiflow-new.nexistrydigitalsolutions.com/api/health
pm2 logs --lines 200 || sudo journalctl -u nexiflow-api -n 200 --no-pager
sudo tail -n 200 /var/log/nginx/error.log

# DB rebuild (ONLY when you want to wipe data)
mysql -u root -p -e "DROP DATABASE IF EXISTS clockistry; CREATE DATABASE clockistry CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci; GRANT ALL PRIVILEGES ON clockistry.* TO 'clockistry_user'@'%'; FLUSH PRIVILEGES;"
mysql -u clockistry_user -p clockistry < /var/www/nexiflow/mysql-schema.sql