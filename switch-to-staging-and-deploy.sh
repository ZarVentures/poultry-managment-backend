#!/bin/bash

echo "=== Switch to Staging Branch and Deploy ==="
echo ""

# Show current branch
echo "Current branch:"
git branch --show-current
echo ""

# Switch to staging branch
echo "Switching to staging branch..."
git checkout staging
if [ $? -ne 0 ]; then
    echo "❌ Failed to switch to staging branch!"
    exit 1
fi
echo "✅ Switched to staging branch"
echo ""

# Pull latest changes
echo "Pulling latest changes..."
git pull origin staging
echo ""

# Clean and rebuild
echo "Cleaning old build..."
rm -rf dist/
echo ""

echo "Building application..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi
echo "✅ Build successful"
echo ""

# Verify payment-vouchers compiled
echo "Verifying payment-vouchers module..."
if [ -d "dist/payment-vouchers" ]; then
    echo "✅ payment-vouchers module compiled"
    ls -la dist/payment-vouchers/*.js | head -5
else
    echo "❌ payment-vouchers module NOT found in dist!"
    exit 1
fi
echo ""

# Restart staging backend
echo "Restarting staging backend (PM2: poultry-backend-stage)..."
pm2 restart poultry-backend-stage
echo ""

# Wait for startup
echo "Waiting 5 seconds for startup..."
sleep 5
echo ""

# Show PM2 status
echo "PM2 Status:"
pm2 status
echo ""

# Test endpoints
echo "Testing health endpoint..."
curl -s http://localhost:3002/api/v1/health
echo ""
echo ""

echo "Testing payment-vouchers endpoint..."
curl -s http://localhost:3002/api/v1/payment-vouchers
echo ""
echo ""

echo "=== Deployment Complete ==="
echo ""
echo "Current branch: $(git branch --show-current)"
