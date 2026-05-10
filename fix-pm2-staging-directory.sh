#!/bin/bash

echo "=== Fix PM2 Staging Directory Issue ==="
echo ""

# Show the problem
echo "1. Current PM2 Configuration:"
pm2 describe poultry-backend-stage | grep -E "script path|exec cwd"
echo ""

echo "2. Current directory:"
pwd
echo ""

# Option 1: Update PM2 to use current directory
echo "3. Stopping PM2 staging process..."
pm2 stop poultry-backend-stage
pm2 delete poultry-backend-stage
echo ""

echo "4. Starting PM2 from correct directory (~/chickenbackend)..."
cd ~/chickenbackend

# Make sure we're on staging branch
git checkout staging
git pull origin staging

# Build
echo "5. Building application..."
npm run build
echo ""

# Start PM2 with correct configuration
echo "6. Starting PM2 with .env.staging..."
pm2 start dist/main.js \
  --name poultry-backend-stage \
  --env-file .env.staging \
  --time \
  --log-date-format "MM-DD HH:mm:ss"

echo ""
echo "7. Saving PM2 configuration..."
pm2 save
echo ""

# Wait for startup
echo "8. Waiting 5 seconds for startup..."
sleep 5
echo ""

# Verify
echo "9. Verifying PM2 configuration:"
pm2 describe poultry-backend-stage | grep -E "script path|exec cwd|status"
echo ""

echo "10. Checking startup logs for route mapping:"
pm2 logs poultry-backend-stage --lines 100 --nostream | grep -i "mapped.*payment"
echo ""

echo "11. Testing endpoints:"
echo "Health:"
curl -s http://localhost:3002/api/v1/health
echo ""
echo ""
echo "Payment vouchers:"
curl -s http://localhost:3002/api/v1/payment-vouchers
echo ""
echo ""

echo "=== Fix Complete ==="
echo ""
echo "PM2 is now running from: $(pm2 describe poultry-backend-stage | grep 'exec cwd' | awk '{print $NF}')"
