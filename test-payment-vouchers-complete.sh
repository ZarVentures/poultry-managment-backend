#!/bin/bash

echo "=== Complete Payment Vouchers Test ==="
echo ""

# 1. Check environment
echo "1. Environment Check:"
echo "Current branch: $(git branch --show-current)"
echo "NODE_ENV from .env.staging:"
grep "NODE_ENV" .env.staging
echo "API_PREFIX from .env.staging:"
grep "API_PREFIX" .env.staging
echo ""

# 2. Check if module compiled
echo "2. Module Compilation Check:"
if [ -f "dist/payment-vouchers/payment-vouchers.controller.js" ]; then
    echo "✅ Controller compiled"
else
    echo "❌ Controller NOT compiled"
fi

if [ -f "dist/payment-vouchers/payment-vouchers.module.js" ]; then
    echo "✅ Module compiled"
else
    echo "❌ Module NOT compiled"
fi
echo ""

# 3. Check if module is imported in app.module
echo "3. App Module Check:"
echo "Looking for PaymentVouchersModule in dist/app.module.js:"
grep -c "PaymentVouchersModule" dist/app.module.js
echo ""

# 4. Check PM2 process
echo "4. PM2 Process Check:"
pm2 describe poultry-backend-stage | grep -E "status|script|cwd|env"
echo ""

# 5. Check recent logs for route mapping
echo "5. Route Mapping Check (looking for payment-vouchers in startup logs):"
pm2 logs poultry-backend-stage --lines 500 --nostream | grep -i "payment"
echo ""

# 6. Test the endpoint
echo "6. Endpoint Tests:"
echo ""
echo "Test A: Health endpoint (should work):"
curl -s http://localhost:3002/api/v1/health
echo ""
echo ""

echo "Test B: Payment vouchers without auth (should get 401, not 404):"
curl -s http://localhost:3002/api/v1/payment-vouchers
echo ""
echo ""

echo "Test C: Login and get token:"
TOKEN=$(curl -s -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo "✅ Got token: ${TOKEN:0:20}..."
    echo ""
    echo "Test D: Payment vouchers WITH auth:"
    curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3002/api/v1/payment-vouchers
    echo ""
else
    echo "❌ Failed to get token"
fi
echo ""

# 7. Check if .env.staging is being used
echo "7. Environment File Check:"
echo "Checking which .env file PM2 is using:"
pm2 describe poultry-backend-stage | grep -A 10 "env:"
echo ""

echo "=== Test Complete ==="
