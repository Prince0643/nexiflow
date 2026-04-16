# Migration Guide: Moving nexi-flow.com to Docker

This guide helps you migrate your existing production site at **nexi-flow.com** from your current setup to Docker containers.

---

## Overview

**Current Setup** → **Docker Setup**
- Node.js running directly → Docker containers
- MySQL directly installed → MariaDB container
- Nginx (if installed) → Nginx reverse proxy + Docker containers
- Manual process management → Docker Compose orchestration

---

## Pre-Migration Checklist

Before starting, ensure you have:

- [ ] SSH access to your production server
- [ ] Current production database credentials
- [ ] SSL certificates (Let's Encrypt preferred)
- [ ] 30 minutes of downtime window (or use zero-downtime method)

---

## Step 1: Prepare Your Environment File

Create the `.env` file with your production values:

```bash
cd /var/www/nexiflow  # or your project directory
cp .env.example .env
nano .env  # or use your preferred editor
```

### Required Variables

```bash
# Database - Use strong passwords!
DB_ROOT_PASSWORD=your_current_db_root_password
DB_NAME=nexiflow
DB_USER=nexiflow
DB_PASSWORD=your_current_db_password

# JWT - Use a secure secret (minimum 32 characters)
JWT_SECRET=your_current_jwt_secret_from_production
JWT_EXPIRES_IN=7d

# CORS - Your production domain
CORS_ORIGIN=https://nexi-flow.com
```

---

## Step 2: Database Configuration

Your Docker setup is configured to use your existing external MySQL database running on the host (127.0.0.1:3306). The database connection is already configured in `docker-compose.prod.yml`.

**Note**: No database migration is needed - Docker containers will connect to your existing MySQL database.

---

## Step 3: Choose Your Migration Method

### Method 1: Quick Migration (with downtime) - 15 minutes

Use the automated script:

```bash
ssh root@your-server-ip
cd /var/www/nexiflow
git pull  # Get the latest Docker files
./migrate-to-docker.sh
```

This script will:
1. Install Docker (if needed)
2. Backup existing data
3. Stop current services
4. Build and start Docker containers
5. Configure Nginx
6. Check health

### Method 2: Zero-Downtime Migration (Blue-Green)

For zero downtime, follow this manual process:

**Phase 1: Deploy Docker on New Port**

1. Edit `docker-compose.prod.yml` temporarily:
   ```yaml
   ports:
     - "8081:80"    # Frontend on different port
     - "3002:3001"  # Backend on different port
   ```

2. Start Docker containers:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

3. Test the new setup:
   ```bash
   curl http://localhost:3002/api/health
   ```

**Phase 2: Switch Traffic**

1. Update Nginx to point to new ports:
   ```nginx
   upstream docker_frontend {
       server 127.0.0.1:8081;  # New port
   }
   
   upstream docker_backend {
       server 127.0.0.1:3002;  # New port
   }
   ```

2. Reload Nginx:
   ```bash
   nginx -t && nginx -s reload
   ```

**Phase 3: Cleanup**

1. Once verified, stop old services:
   ```bash
   pm2 stop all  # or however you're running Node.js
   systemctl stop your-old-backend-service
   ```

2. Update docker-compose to use standard ports:
   ```yaml
   ports:
     - "127.0.0.1:8080:80"
     - "127.0.0.1:3001:3001"
   ```

---

## Step 4: Manual Migration Steps (if not using script)

### 4.1 Install Docker

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Add user to docker group
usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

### 4.2 Prepare Application

```bash
cd /var/www/nexiflow

# Create .env file with production values
cp .env.example .env
# Edit .env with your actual values

# Ensure uploads directory exists
mkdir -p api/uploads/avatars
```

### 4.3 Build and Start

```bash
# Build and start containers
docker compose -f docker-compose.prod.yml up -d --build

# Check status
docker ps
docker compose -f docker-compose.prod.yml logs -f
```

### 4.4 Database Connection Test

Since you're using an external MySQL database, verify the connection:

```bash
# Test database connection from Docker container
docker compose -f docker-compose.prod.yml exec backend sh -c 'nc -zv 127.0.0.1 3306'

# Check environment variables
docker compose -f docker-compose.prod.yml exec backend env | grep MYSQL
```

### 4.5 Configure Nginx

```bash
# Copy production Nginx config
cp nginx-production.conf /etc/nginx/sites-available/nexi-flow.com

# Enable site
ln -s /etc/nginx/sites-available/nexi-flow.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t
systemctl reload nginx
```

---

## Step 5: Post-Migration Verification

### 5.1 Check All Services

```bash
# Container status
docker ps

# Health check
curl https://nexi-flow.com/api/health

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

### 5.2 Verify SSL

```bash
# Test SSL certificate
curl -I https://nexi-flow.com

# Check certificate expiry
echo | openssl s_client -servername nexi-flow.com -connect nexi-flow.com:443 2>/dev/null | openssl x509 -noout -dates
```

### 5.3 Test Key Functionality

- [ ] Website loads at https://nexi-flow.com
- [ ] Login works
- [ ] API responds correctly
- [ ] File uploads work
- [ ] Database is accessible

---

## Step 6: Update Management

### To Update Your Application

```bash
cd /var/www/nexiflow
git pull  # Get latest code

docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

### To Backup Database

```bash
# Create backup
docker exec nexiflow_db mysqldump -u root -p${DB_ROOT_PASSWORD} nexiflow > backup_$(date +%Y%m%d).sql
```

### To View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
```

---

## Troubleshooting

### Containers Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Check for port conflicts
netstat -tlnp | grep -E ':3001|:8080|:3306'

# Restart with fresh build
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build --force-recreate
```

### Database Connection Issues

```bash
# Test connection from backend container to host MySQL
docker compose -f docker-compose.prod.yml exec backend sh -c 'nc -zv 127.0.0.1 3306'

# Verify environment variables
docker compose -f docker-compose.prod.yml exec backend env | grep MYSQL

# Check MySQL is running on host
sudo systemctl status mysql

# Test MySQL connection from host
mysql -u clockistry_user -p -h 127.0.0.1 -e "SHOW DATABASES;"
```

### Nginx/SSL Issues

```bash
# Test Nginx config
nginx -t

# Check SSL certificate
certbot certificates

# Renew SSL manually
certbot renew --force-renewal

# Check Nginx error logs
tail -f /var/log/nginx/error.log
```

### Permission Issues with Uploads

```bash
# Fix upload permissions
docker compose -f docker-compose.prod.yml exec backend chown -R node:node /app/api/uploads

# Check upload directory
ls -la api/uploads/
```

---

## Rollback Plan

If you need to rollback:

```bash
# Stop Docker containers
cd /var/www/nexiflow
docker compose -f docker-compose.prod.yml down

# Restore from backup (if you used the migration script)
cd /root/backups/[TIMESTAMP]

# Restart your old Node.js process
pm2 restart all
# or
node api/index.js &

# Restore Nginx config if needed
cp /etc/nginx/sites-available/nexi-flow.com.backup /etc/nginx/sites-available/nexi-flow.com
nginx -t && nginx -s reload
```

---

## Important Notes

1. **First Migration**: Do this during low-traffic hours
2. **Backups**: Always backup before making changes
3. **SSL**: Certbot certificates should persist if properly configured
4. **Environment**: Never commit `.env` file to git
5. **Database**: Consider using a managed database for production
6. **Monitoring**: Set up monitoring after migration (see HOSTINGER_DOCKER_GUIDE.md)

---

## Quick Reference

| Task | Command |
|------|---------|
| Start | `docker compose -f docker-compose.prod.yml up -d` |
| Stop | `docker compose -f docker-compose.prod.yml down` |
| Logs | `docker compose -f docker-compose.prod.yml logs -f` |
| Update | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
| Backup | `mysqldump -u clockistry_user -p clockistry > backup_$(date +%Y%m%d).sql` |
| Shell | `docker compose -f docker-compose.prod.yml exec backend sh` |
| Stats | `docker stats` |

---

## Support

If issues arise during migration:

1. Check logs: `docker compose -f docker-compose.prod.yml logs`
2. Test locally: `docker compose -f docker-compose.prod.yml up` on your machine
3. Review the main guide: `HOSTINGER_DOCKER_GUIDE.md`
4. Emergency rollback: See "Rollback Plan" section above
