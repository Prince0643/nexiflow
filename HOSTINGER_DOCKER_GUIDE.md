# Hostinger VPS Docker Deployment Guide

This guide walks you through setting up Docker on a Hostinger VPS and deploying the NexiFlow application.

---

## Prerequisites

- Hostinger VPS plan (Ubuntu 22.04 LTS recommended)
- Domain name (optional but recommended)
- SSH access to your VPS
- Local copy of this repository

---

## Step 1: Set Up Your Hostinger VPS

### 1.1 Purchase and Configure VPS

1. Log in to your **Hostinger account**
2. Go to **VPS** → **Create New VPS**
3. Select a plan (recommend at least **KVM 2** for production):
   - 2 vCPU
   - 8GB RAM
   - 100GB SSD
4. Choose **Ubuntu 22.04 LTS** as the operating system
5. Select your preferred data center location
6. Complete the purchase

### 1.2 Access Your VPS

**Method 1: Via Hostinger Panel (Browser Terminal)**
1. Go to **VPS** in your Hostinger dashboard
2. Click on your VPS
3. Click **Browser Terminal** to access via web

**Method 2: Via SSH (Recommended)**
1. In Hostinger panel, go to your VPS → **Settings**
2. Note the **IP Address** and **SSH Port** (default: 22)
3. Reset root password if needed: **Settings** → **Root Password** → **Change**
4. Open your terminal and connect:

```bash
ssh root@YOUR_VPS_IP
```

Enter the password when prompted.

---

## Step 2: Install Docker on Hostinger VPS

Once logged into your VPS via SSH, run these commands:

### 2.1 Update System Packages

```bash
apt update && apt upgrade -y
```

### 2.2 Install Docker

```bash
# Install required packages
apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package index
apt update

# Install Docker
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### 2.3 Verify Docker Installation

```bash
docker --version
docker compose version
```

You should see version numbers for both.

### 2.4 Start and Enable Docker

```bash
systemctl start docker
systemctl enable docker
```

### 2.5 Add User to Docker Group (Optional)

To run Docker without `sudo`:

```bash
usermod -aG docker root
newgrp docker
```

---

## Step 3: Install Additional Tools

```bash
# Install Git
apt install -y git

# Install Node.js (for local builds if needed)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Nginx (as reverse proxy)
apt install -y nginx

# Install Certbot (for SSL)
apt install -y certbot python3-certbot-nginx
```

---

## Step 4: Prepare Your Application

### 4.1 Clone Your Repository

```bash
cd /var/www
git clone YOUR_GITHUB_REPO_URL nexiflow
cd nexiflow
```

### 4.2 Create Environment Files

**Backend Environment** (`api/.env`):

```bash
cat > api/.env << 'EOF'
# Database Configuration
DB_HOST=db
DB_PORT=3306
DB_USER=nexiflow
DB_PASSWORD=YOUR_STRONG_DB_PASSWORD
DB_NAME=nexiflow

# JWT Configuration
JWT_SECRET=YOUR_STRONG_JWT_SECRET_AT_LEAST_32_CHARS
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=production

# CORS
CORS_ORIGIN=https://your-domain.com

# Firebase (if still needed for any features)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="your-private-key"
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_CERT_URL=your-cert-url
EOF
```

**Frontend Environment** (`.env.production`):

```bash
cat > .env.production << 'EOF'
VITE_API_URL=https://your-domain.com/api
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
EOF
```

> **IMPORTANT**: Replace all placeholder values with your actual credentials!

---

## Step 5: Deploy with Docker Compose

### 5.1 Build and Start Services

```bash
cd /var/www/nexiflow
docker compose -f docker-compose.prod.yml up -d --build
```

This will:
- Build the frontend and backend images
- Start MySQL database
- Start the backend API server
- Start Nginx to serve the frontend and proxy API requests

### 5.2 Verify Services are Running

```bash
# Check running containers
docker ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Check specific service logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f db
```

### 5.3 Initialize Database

```bash
# Run database initialization
docker compose -f docker-compose.prod.yml exec backend npm run init-db

# Or if you have migrations
docker compose -f docker-compose.prod.yml exec backend npm run migrate-data
```

---

## Step 6: Configure Nginx and SSL

### 6.1 Create Nginx Configuration

Create `/etc/nginx/sites-available/nexiflow`:

```bash
cat > /etc/nginx/sites-available/nexiflow << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
```

Enable the site:

```bash
ln -s /etc/nginx/sites-available/nexiflow /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

### 6.2 Set Up SSL with Let's Encrypt

```bash
certbot --nginx -d your-domain.com -d www.your-domain.com
```

Follow the prompts. Certbot will automatically configure HTTPS and redirect HTTP to HTTPS.

---

## Step 7: Configure Firewall

### 7.1 Set Up UFW (Uncomplicated Firewall)

```bash
# Install UFW if not present
apt install -y ufw

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable
```

Verify:
```bash
ufw status
```

---

## Step 8: Set Up Auto-Start and Monitoring

### 8.1 Enable Docker Auto-Start

Docker containers with `restart: unless-stopped` will automatically start on boot.

### 8.2 Install and Configure Fail2Ban

```bash
apt install -y fail2ban

# Create local configuration
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
EOF

systemctl enable fail2ban
systemctl start fail2ban
```

### 8.3 Set Up Log Rotation for Docker

```bash
cat > /etc/logrotate.d/docker-container << 'EOF'
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size=10M
    missingok
    delaycompress
    copytruncate
}
EOF
```

---

## Step 9: Maintenance Commands

### 9.1 Update Application

```bash
cd /var/www/nexiflow
git pull

docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

### 9.2 Backup Database

```bash
# Create backup script
cat > /root/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/root/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

docker exec nexiflow_db mysqldump -u root -pYOUR_ROOT_PASSWORD nexiflow > $BACKUP_DIR/nexiflow_$DATE.sql

# Keep only last 7 backups
ls -t $BACKUP_DIR/nexiflow_*.sql | tail -n +8 | xargs -r rm
EOF

chmod +x /root/backup-db.sh

# Run backup
/root/backup-db.sh

# Add to crontab for daily backups
crontab -e
# Add this line:
0 2 * * * /root/backup-db.sh
```

### 9.3 View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

### 9.4 Restart Services

```bash
# Restart all
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart backend
```

### 9.5 Check Resource Usage

```bash
docker stats
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs service-name

# Check for port conflicts
netstat -tlnp | grep :80
netstat -tlnp | grep :3001

# Restart with fresh build
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build --force-recreate
```

### Database Connection Issues

```bash
# Check if database is running
docker ps | grep db

# Check database logs
docker compose -f docker-compose.prod.yml logs db

# Verify environment variables
docker compose -f docker-compose.prod.yml exec backend env | grep DB
```

### SSL Certificate Issues

```bash
# Renew certificates manually
certbot renew

# Check certificate status
certbot certificates
```

### Out of Disk Space

```bash
# Clean up unused Docker resources
docker system prune -a

# Check disk usage
df -h

# View Docker disk usage
docker system df
```

---

## Security Best Practices

1. **Keep software updated**:
   ```bash
   apt update && apt upgrade -y
   ```

2. **Use strong passwords** in environment files

3. **Disable root SSH** and use key-based authentication

4. **Regular backups** - automate with cron

5. **Monitor logs** for suspicious activity:
   ```bash
   tail -f /var/log/nginx/access.log
   ```

6. **Use Docker secrets** for sensitive data (advanced)

---

## Quick Reference

| Task | Command |
|------|---------|
| Start services | `docker compose -f docker-compose.prod.yml up -d` |
| Stop services | `docker compose -f docker-compose.prod.yml down` |
| View logs | `docker compose -f docker-compose.prod.yml logs -f` |
| Restart | `docker compose -f docker-compose.prod.yml restart` |
| Update app | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
| Backup DB | `docker exec nexiflow_db mysqldump -u root -pPASSWORD nexiflow > backup.sql` |
| Restore DB | `docker exec -i nexiflow_db mysql -u root -pPASSWORD nexiflow < backup.sql` |
| Check stats | `docker stats` |

---

## Support

- **Hostinger Support**: hPanel → Help → Contact Support
- **Docker Docs**: https://docs.docker.com/
- **Application Issues**: Check logs with `docker compose -f docker-compose.prod.yml logs`
