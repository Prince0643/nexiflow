#!/bin/bash
# Docker Migration Script for nexi-flow.com
# This script helps migrate from existing production setup to Docker

set -e

echo "================================"
echo "Docker Migration Script"
echo "nexi-flow.com"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root or with sudo"
    exit 1
fi

# Step 1: Check prerequisites
print_status "Step 1: Checking prerequisites..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_warning "Docker not found. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    usermod -aG docker $SUDO_USER || true
fi

# Check if docker compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose not found. Please install Docker Compose."
    exit 1
fi

print_status "Prerequisites check complete."

# Step 2: Backup existing data
print_status "Step 2: Creating backups..."

BACKUP_DIR="/root/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup existing uploads if they exist
if [ -d "/var/www/nexiflow/api/uploads" ]; then
    print_status "Backing up uploads..."
    cp -r /var/www/nexiflow/api/uploads "$BACKUP_DIR/"
fi

# Backup existing database if accessible
if command -v mysqldump &> /dev/null && mysqladmin ping &> /dev/null; then
    print_status "Backing up database..."
    DB_NAME=$(grep DB_NAME /var/www/nexiflow/.env 2>/dev/null | cut -d= -f2 || echo "nexiflow")
    DB_USER=$(grep DB_USER /var/www/nexiflow/.env 2>/dev/null | cut -d= -f2 || echo "root")
    DB_PASS=$(grep DB_PASSWORD /var/www/nexiflow/.env 2>/dev/null | cut -d= -f2 || echo "")
    
    if [ -n "$DB_PASS" ]; then
        mysqldump -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$BACKUP_DIR/database.sql" 2>/dev/null || true
    else
        mysqldump -u "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/database.sql" 2>/dev/null || true
    fi
fi

print_status "Backups created in $BACKUP_DIR"

# Step 3: Stop existing services
print_status "Step 3: Stopping existing services..."

# Stop PM2 processes if using PM2
if command -v pm2 &> /dev/null; then
    pm2 stop all 2>/dev/null || true
    pm2 delete all 2>/dev/null || true
fi

# Stop existing Node.js processes
pkill -f "node.*api/index.js" 2>/dev/null || true

# Stop existing Nginx temporarily
systemctl stop nginx 2>/dev/null || true

print_status "Existing services stopped."

# Step 4: Deploy Docker containers
print_status "Step 4: Deploying Docker containers..."

cd /var/www/nexiflow

# Ensure .env file exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        print_warning ".env file not found. Copying from .env.example..."
        cp .env.example .env
        print_error "Please edit .env file with your actual credentials before continuing!"
        exit 1
    else
        print_error ".env file not found! Please create .env with your configuration."
        exit 1
    fi
fi

# Pull latest code if it's a git repository
if [ -d ".git" ]; then
    print_status "Pulling latest code..."
    git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || true
fi

# Build and start Docker containers
print_status "Building and starting Docker containers..."
docker compose -f docker-compose.prod.yml down 2>/dev/null || true
docker compose -f docker-compose.prod.yml up -d --build

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
sleep 10

# Check if containers are running
if docker ps | grep -q "nexiflow_backend" && docker ps | grep -q "nexiflow_db"; then
    print_status "Docker containers are running."
else
    print_error "Some containers failed to start. Check logs with: docker compose -f docker-compose.prod.yml logs"
    exit 1
fi

# Step 5: Restore data if needed
if [ -f "$BACKUP_DIR/database.sql" ]; then
    print_status "Step 5: Restoring database..."
    print_warning "You may need to manually import the database if this is a fresh install."
    print_status "To restore, run: docker exec -i nexiflow_db mysql -u root -p nexiflow < $BACKUP_DIR/database.sql"
fi

if [ -d "$BACKUP_DIR/uploads" ]; then
    print_status "Restoring uploads..."
    cp -r "$BACKUP_DIR/uploads"/* /var/www/nexiflow/api/uploads/ 2>/dev/null || true
    docker compose -f docker-compose.prod.yml exec -T backend chown -R node:node /app/api/uploads 2>/dev/null || true
fi

# Step 6: Configure Nginx
print_status "Step 6: Configuring Nginx..."

if [ -f "/var/www/nexiflow/nginx-production.conf" ]; then
    cp /var/www/nexiflow/nginx-production.conf /etc/nginx/sites-available/nexi-flow.com
    
    # Create symlink if it doesn't exist
    if [ ! -L "/etc/nginx/sites-enabled/nexi-flow.com" ]; then
        ln -s /etc/nginx/sites-available/nexi-flow.com /etc/nginx/sites-enabled/nexi-flow.com
    fi
    
    # Remove default site if it exists
    rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    nginx -t
    
    # Restart Nginx
    systemctl restart nginx
    
    print_status "Nginx configured successfully."
else
    print_warning "nginx-production.conf not found. Skipping Nginx configuration."
fi

# Step 7: Enable services
print_status "Step 7: Enabling services..."
systemctl enable docker
systemctl enable nginx

# Step 8: Check services
print_status "Step 8: Checking services..."

# Health check
sleep 5
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health || echo "000")

if [ "$HEALTH_STATUS" == "200" ]; then
    print_status "Backend health check passed!"
else
    print_warning "Backend health check returned status $HEALTH_STATUS"
    print_warning "Check logs: docker compose -f /var/www/nexiflow/docker-compose.prod.yml logs backend"
fi

# Final status
print_status "================================"
print_status "Migration Complete!"
print_status "================================"
print_status "Frontend: https://nexi-flow.com"
print_status "API: https://nexi-flow.com/api"
print_status ""
print_status "Useful commands:"
print_status "  View logs: docker compose -f /var/www/nexiflow/docker-compose.prod.yml logs -f"
print_status "  Restart: docker compose -f /var/www/nexiflow/docker-compose.prod.yml restart"
print_status "  Stop: docker compose -f /var/www/nexiflow/docker-compose.prod.yml down"
print_status ""
print_warning "Backup location: $BACKUP_DIR"
