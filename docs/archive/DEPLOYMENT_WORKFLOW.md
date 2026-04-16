# Production Deployment Workflow

## Quick Deploy (After Code Changes)

1. **Commit and push changes:**
```bash
git add .
git commit -m "your update message"
git push origin main
```

2. **SSH to server and deploy:**
```bash
ssh prince@72.62.79.59
cd /var/www/nexiflow
git pull
sudo docker compose -f docker-compose.prod.yml up -d --build
```

## What Gets Rebuilt?

- **Backend changes** → Use `--build backend`
- **Frontend changes** → Use `--build frontend`  
- **Both changed** → Use `--build` (no service name)

## Zero-Downtime Deploy (Recommended)

```bash
# On server - runs blue-green deployment
cd /var/www/nexiflow
git pull

# Build new images without stopping old ones
sudo docker compose -f docker-compose.prod.yml build

# Start new containers (ports already mapped, instant switch)
sudo docker compose -f docker-compose.prod.yml up -d
```

Docker handles the switch automatically - old containers stop only after new ones are healthy.

## Database Migrations

If your update includes DB schema changes:

1. **Backup first:**
```bash
mysqldump -u clockistry_user -p clockistry > backup_$(date +%Y%m%d_%H%M%S).sql
```

2. **Apply migrations** (if you have migration scripts)

## Check Deploy Status

```bash
# Check containers running
sudo docker ps

# Check backend health
curl http://127.0.0.1:3001/api/health

# Check logs if issues
sudo docker logs nexiflow_backend --tail=50
sudo docker logs nexiflow_frontend --tail=20
```

## Rollback (If Something Breaks)

```bash
# Revert to previous commit
git log --oneline -5  # Find commit hash
git revert <commit-hash>
git push origin main

# On server
git pull
sudo docker compose -f docker-compose.prod.yml up -d --build
```

Or quickly rollback containers:
```bash
# On server - rollback to previous image
sudo docker compose -f docker-compose.prod.yml down
sudo docker image tag nexiflow-backend:previous nexiflow-backend:latest
sudo docker compose -f docker-compose.prod.yml up -d
```
