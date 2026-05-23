# Deploy Backend to EC2 Staging
# This script pulls latest code from staging branch and restarts PM2

Write-Host "🚀 Deploying Backend to EC2 Staging..." -ForegroundColor Green

# EC2 connection details
$EC2_HOST = "13.234.140.190"
$EC2_USER = "ubuntu"
$APP_DIR = "chickenbackend"
$PM2_NAME = "poultry-backend-stage"

Write-Host "📡 Connecting to EC2..." -ForegroundColor Cyan

# Commands to run on EC2 (semicolon separated)
$commands = 'cd ' + $APP_DIR + ' && git fetch origin && git checkout staging && git pull origin staging && npm install && npm run build && pm2 restart ' + $PM2_NAME + ' && pm2 logs ' + $PM2_NAME + ' --lines 20'

# Execute via SSH
ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} "$commands"

Write-Host "`n✅ Staging backend deployed successfully!" -ForegroundColor Green
Write-Host "🔍 Check logs with: ssh ubuntu@$EC2_HOST 'pm2 logs $PM2_NAME'" -ForegroundColor Yellow
