/**
 * Complete DB Backup via Live API
 * Fetches all data from every endpoint and saves to JSON
 * No direct DB connection needed
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

const BASE_URL = 'https://chickenbackend.onrender.com/api/v1'
const LOGIN_EMAIL = 'admin@azizpoultry.com'
const LOGIN_PASSWORD = 'admin123'

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const backupDir = path.join(__dirname, `db-backup-${timestamp}`)

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { ...options, timeout: 30000 }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) })
        } catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')) })
    if (options.body) req.write(options.body)
    req.end()
  })
}

async function getToken() {
  const res = await request(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD })
  })
  const token = res.body?.access_token || res.body?.token || res.body?.data?.access_token
  if (!token) throw new Error('Login failed: ' + JSON.stringify(res.body))
  return token
}

async function fetchEndpoint(token, endpoint) {
  const res = await request(`${BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  })
  return res.body
}

const ENDPOINTS = [
  { name: 'users',           path: '/users' },
  { name: 'farmers',         path: '/farmers' },
  { name: 'retailers',       path: '/retailers' },
  { name: 'vehicles',        path: '/vehicles' },
  { name: 'purchases',       path: '/purchases' },
  { name: 'sales',           path: '/sales' },
  { name: 'expenses',        path: '/expenses' },
  { name: 'inventory',       path: '/inventory' },
  { name: 'mortality',       path: '/mortality' },
  { name: 'dashboard',       path: '/dashboard' },
  { name: 'settings',        path: '/settings' },
]

async function backup() {
  console.log('========================================')
  console.log('  Render DB Backup via API')
  console.log('========================================\n')

  fs.mkdirSync(backupDir, { recursive: true })

  // Step 1: Login
  console.log('Logging in...')
  let token
  try {
    token = await getToken()
    console.log('Login successful.\n')
  } catch (err) {
    console.error('Login failed:', err.message)
    process.exit(1)
  }

  const summary = { backedUpAt: new Date().toISOString(), endpoints: {} }

  // Step 2: Fetch each endpoint
  for (const ep of ENDPOINTS) {
    try {
      process.stdout.write(`  Fetching ${ep.name}...`)
      const data = await fetchEndpoint(token, ep.path)

      // Normalize — some endpoints return { data: [...] } or { items: [...] }
      const rows = Array.isArray(data) ? data
        : Array.isArray(data?.data) ? data.data
        : Array.isArray(data?.items) ? data.items
        : data

      const count = Array.isArray(rows) ? rows.length : '(object)'
      fs.writeFileSync(path.join(backupDir, `${ep.name}.json`), JSON.stringify(rows, null, 2))
      summary.endpoints[ep.name] = count
      console.log(` ✓ ${count} records`)
    } catch (err) {
      console.log(` ✗ ERROR: ${err.message}`)
      summary.endpoints[ep.name] = `ERROR: ${err.message}`
    }
  }

  // Step 3: Save summary
  fs.writeFileSync(path.join(backupDir, '_summary.json'), JSON.stringify(summary, null, 2))

  const totalRecords = Object.values(summary.endpoints)
    .reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0)

  console.log('\n========================================')
  console.log('Backup complete!')
  console.log(`Location : ${backupDir}`)
  console.log(`Endpoints: ${ENDPOINTS.length}`)
  console.log(`Total records: ${totalRecords}`)
  console.log('========================================')
}

backup().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
