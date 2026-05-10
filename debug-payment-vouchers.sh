#!/bin/bash

echo "=== Payment Vouchers Debug Script ==="
echo ""

# Check if module is in dist
echo "1. Checking dist/payment-vouchers files:"
ls -la dist/payment-vouchers/
echo ""

# Check if module is in app.module.js
echo "2. Checking if PaymentVouchersModule is imported in dist/app.module.js:"
grep -i "payment" dist/app.module.js
echo ""

# Check main.ts for global prefix
echo "3. Checking src/main.ts for API prefix:"
grep -A 5 "setGlobalPrefix" src/main.ts
echo ""

# Check PM2 logs for any errors
echo "4. Checking PM2 logs for staging backend (last 50 lines):"
pm2 logs poultry-backend-stage --lines 50 --nostream
echo ""

# Check if the route is registered
echo "5. Testing with full path including auth:"
echo "Without auth (should get 401 Unauthorized, not 404):"
curl -s http://localhost:3002/api/v1/payment-vouchers
echo ""
echo ""

# Check what routes are actually registered
echo "6. Checking NestJS route registration in logs:"
pm2 logs poultry-backend-stage --lines 200 --nostream | grep -i "mapped\|payment\|route"
echo ""

echo "=== Debug Complete ==="
