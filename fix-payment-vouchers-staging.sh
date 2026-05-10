#!/bin/bash

echo "=== Payment Vouchers Module Fix Script ==="
echo ""

# Check if source files exist
echo "1. Checking source files..."
ls -la src/payment-vouchers/ 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Source files missing!"
    exit 1
fi
echo "✅ Source files exist"
echo ""

# Check current branch
echo "2. Checking git branch..."
git branch --show-current
echo ""

# Pull latest changes
echo "3. Pulling latest changes from staging..."
git pull origin staging
echo ""

# Clean build
echo "4. Cleaning old build..."
rm -rf dist/
echo "✅ Cleaned dist folder"
echo ""

# Install dependencies (in case something is missing)
echo "5. Installing dependencies..."
npm install
echo ""

# Build
echo "6. Building application..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi
echo "✅ Build successful"
echo ""

# Check if payment-vouchers compiled
echo "7. Checking compiled files..."
ls -la dist/payment-vouchers/ 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ payment-vouchers not in dist!"
    exit 1
fi
echo "✅ payment-vouchers compiled successfully"
echo ""

# Restart staging backend
echo "8. Restarting staging backend..."
pm2 restart poultry-backend-stage
echo ""

# Wait for startup
echo "9. Waiting 5 seconds for startup..."
sleep 5
echo ""

# Test health endpoint
echo "10. Testing health endpoint..."
curl -s http://localhost:3002/api/v1/health
echo ""
echo ""

# Test payment-vouchers endpoint
echo "11. Testing payment-vouchers endpoint..."
curl -s http://localhost:3002/api/v1/payment-vouchers
echo ""
echo ""

echo "=== Fix Complete ==="
