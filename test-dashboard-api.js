require('dotenv').config();
const https = require('https');

// First login to get a token
const loginData = JSON.stringify({ email: 'admin@azizpoultry.com', password: 'admin123' });

const loginReq = https.request({
  hostname: '13.234.140.190.nip.io',
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const { accessToken } = JSON.parse(body);
      if (!accessToken) { console.log('Login failed:', body); return; }
      console.log('Logged in, fetching dashboard...');

      // Now fetch dashboard
      https.get({
        hostname: '13.234.140.190.nip.io',
        path: '/api/v1/dashboard/comprehensive',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }, (res2) => {
        let body2 = '';
        res2.on('data', d => body2 += d);
        res2.on('end', () => {
          const data = JSON.parse(body2);
          console.log('\n=== Dashboard API Response ===');
          console.log('KPIs:', JSON.stringify(data.kpis, null, 2));
        });
      });
    } catch(e) { console.log('Parse error:', e.message, body); }
  });
});
loginReq.write(loginData);
loginReq.end();
