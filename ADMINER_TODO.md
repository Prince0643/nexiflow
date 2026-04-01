# Database Access Issue - TODO

## Problem
Adminer cannot connect to MySQL from Docker container. Getting "Access denied" error.

## Current Status
- Backend works (uses `network_mode: host`)
- Adminer in bridge network cannot resolve `host.docker.internal`
- MySQL bound to `127.0.0.1` (secure, but blocks Docker bridge network)

## Solutions to Try Tomorrow

### Option 1: Use Host Network (Recommended - Quick Fix)
Change Adminer to use host network like the backend:

```yaml
  adminer:
    image: adminer:latest
    container_name: nexiflow_adminer
    restart: unless-stopped
    network_mode: host
    environment:
      ADMINER_DEFAULT_SERVER: 127.0.0.1
```

Then login with server: `127.0.0.1`

**Pros:** Secure, MySQL stays on localhost
**Cons:** Port conflict if 8080 is taken

---

### Option 2: Allow MySQL External Access (Less Secure)
Change MySQL bind address and firewall:

```bash
# Edit MySQL config
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
# Change: bind-address = 0.0.0.0

sudo systemctl restart mysql

# Block external access with firewall
sudo ufw allow from 172.18.0.0/16 to any port 3306
```

Then use server IP `72.62.79.59` in Adminer

**Pros:** Works with bridge network
**Cons:** Opens MySQL to external (mitigated by firewall)

---

### Option 3: Use SSH Tunnel Instead (Most Secure)
Skip Adminer entirely, use TablePlus with SSH:

1. Open TablePlus
2. Create MySQL connection
3. Enable "Over SSH" 
4. SSH Server: `72.62.79.59:22`
5. SSH User: `prince`
6. MySQL Host: `127.0.0.1`
7. MySQL User: `clockistry_user`
8. Password: `prince123`

**Pros:** Most secure, no Docker changes needed
**Cons:** TablePlus paid features limitation

---

## Commands to Run Tomorrow

```bash
# Option 1 - Update docker-compose and deploy
cd /var/www/nexiflow
git pull
sudo docker compose -f docker-compose.prod.yml up -d adminer

# Test connection
curl http://127.0.0.1:8081
# Login with 127.0.0.1
```

## Notes
- Backend already works with `network_mode: host`
- MySQL user `clockistry_user`@'%' has correct permissions
- Authentication plugin is `mysql_native_password` (correct for Adminer)
- Issue is purely network connectivity between Docker bridge and host MySQL
