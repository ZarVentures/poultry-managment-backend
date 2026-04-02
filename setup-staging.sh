#!/bin/bash
# ============================================
# Staging Environment Setup Script
# Run once on AWS EC2 to set up staging
# Usage: bash setup-staging.sh
# ============================================

set -e

echo "======================================"
echo "  Setting up Staging Environment"
echo "======================================"

# 1. Create staging DB on RDS
echo ""
echo "Step 1: Creating poultry_stage database..."
PGPASSWORD=poultry_user1212 psql \
  -h poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com \
  -U poultry_user \
  -d poultry \
  -c "CREATE DATABASE poultry_stage;" 2>/dev/null || echo "  (DB may already exist, continuing...)"

echo "  ✓ Database ready"

# 2. Clone staging backend (separate folder)
echo ""
echo "Step 2: Setting up staging backend..."
if [ ! -d "/home/ubuntu/chickenbackend-staging" ]; then
  git clone https://github.com/cosmicdanish1/chickenbackend.git /home/ubuntu/chickenbackend-staging
  echo "  ✓ Cloned to /home/ubuntu/chickenbackend-staging"
else
  echo "  (Already exists, pulling latest...)"
  cd /home/ubuntu/chickenbackend-staging && git pull origin staging 2>/dev/null || git pull origin main
fi

# 3. Switch to staging branch
echo ""
echo "Step 3: Switching to staging branch..."
cd /home/ubuntu/chickenbackend-staging
git fetch origin
git checkout staging 2>/dev/null || git checkout -b staging origin/staging 2>/dev/null || echo "  (Using main branch for now)"

# 4. Copy staging env
echo ""
echo "Step 4: Copying staging .env..."
cp .env.staging .env
echo "  ✓ .env configured for staging (port 3002, poultry_stage DB)"

# 5. Install and build
echo ""
echo "Step 5: Installing dependencies and building..."
npm install --silent
npm run build
echo "  ✓ Build complete"

# 6. Run migrations on staging DB
echo ""
echo "Step 6: Running DB migrations on staging..."
node run-aws-migrations.js
echo "  ✓ Migrations complete"

# 7. Start with PM2
echo ""
echo "Step 7: Starting staging backend with PM2..."
pm2 delete poultry-backend-stage 2>/dev/null || true
pm2 start dist/main.js \
  --name poultry-backend-stage \
  --env staging \
  -- --port 3002
pm2 save
echo "  ✓ Staging backend running on port 3002"

# 8. Configure nginx (if installed)
echo ""
echo "Step 8: Nginx config..."
if command -v nginx &> /dev/null; then
  cat > /tmp/staging-nginx.conf << 'NGINX'
server {
    listen 80;
    server_name staging.13.234.140.190.nip.io;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX
  echo "  Nginx config written to /tmp/staging-nginx.conf"
  echo "  Copy it: sudo cp /tmp/staging-nginx.conf /etc/nginx/sites-available/staging"
  echo "  Enable it: sudo ln -s /etc/nginx/sites-available/staging /etc/nginx/sites-enabled/"
  echo "  Reload: sudo nginx -s reload"
else
  echo "  Nginx not found — staging accessible at: http://13.234.140.190:3002/api/v1"
fi

echo ""
echo "======================================"
echo "  Staging Setup Complete!"
echo "======================================"
echo ""
echo "  Staging API:      http://13.234.140.190:3002/api/v1"
echo "  Staging DB:       poultry_stage (AWS RDS)"
echo "  PM2 process:      poultry-backend-stage"
echo "  Backend folder:   /home/ubuntu/chickenbackend-staging"
echo "  Branch:           staging"
echo ""
echo "  Next: Set up Amplify staging app pointing to 'staging' branch"
echo "  Set env var: NEXT_PUBLIC_API_URL=http://13.234.140.190:3002/api/v1"
echo "======================================"
