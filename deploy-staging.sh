#!/bin/bash

echo "🚀 Deploying to staging..."

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin staging

# Install dependencies (if package.json changed)
echo "📦 Installing dependencies..."
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Restart PM2
echo "♻️  Restarting PM2..."
pm2 restart poultry-backend-stage

echo "✅ Deployment complete!"
echo "📊 Check logs: pm2 logs poultry-backend-stage --lines 50"
