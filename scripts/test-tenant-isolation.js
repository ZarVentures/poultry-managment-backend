/**
 * Multi-tenant isolation integration/security tests.
 * Run: node scripts/test-tenant-isolation.js  (from backend root)
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { Client } = require('pg');

const BASE = 'http://localhost:3001/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || 'staging-jwt-secret-change-this';

const db = new Client({
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`,
  ssl: { rejectUnauthorized: false },
});

async function api(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function makeToken(userId) {
  const r = await db.query(
    'SELECT id, phone, email, role, tenant_id, session_token FROM users WHERE id = $1',
    [String(userId)],
  );
  if (r.rows.length === 0) throw new Error(`User ${userId} not found`);
  const u = r.rows[0];
  return jwt.sign(
    {
      sub: String(u.id),
      email: u.email,
      phone: u.phone,
      role: u.role,
      tenantId: u.tenant_id ? String(u.tenant_id) : null,
      sessionToken: u.session_token,
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  console.log('Connecting to DB...');
  await db.connect();
  console.log('Connected.\n');

  const token1 = await makeToken(1);
  const token2 = await makeToken(54);
  const tokenNull = await makeToken(53);
  console.log('Tokens minted (tenant1, tenant2, no-shop).\n');

  console.log('── Auth / guards ────────────────────────────────────────────');
  let r = await api('GET', '/dashboard/kpis');
  check('S1: no token → 401 on dashboard/kpis', r.status === 401, `got ${r.status}`);

  r = await api('GET', '/billing/parties');
  check('S2: no token → 401 on billing/parties', r.status === 401, `got ${r.status}`);

  r = await api('GET', '/dashboard/kpis', tokenNull);
  check('S3: no-shop user blocked from business data → 403', r.status === 403, `got ${r.status}: ${JSON.stringify(r.data)}`);

  r = await api('GET', '/auth/profile', tokenNull);
  check('S4: no-shop user can still fetch own profile → 200', r.status === 200, `got ${r.status}`);

  r = await api('GET', '/tenants/me', tokenNull);
  check('S5: no-shop user sees no tenant on /tenants/me (null/empty)', r.status === 200 && !r.data, `got ${r.status} ${JSON.stringify(r.data)}`);

  console.log('\n── Shop creation / One user → One shop ──────────────────────');
  r = await api('POST', '/tenants', tokenNull, {
    name: 'Isolation Shop B',
    type: 'poultry_trader',
    currency: 'INR',
    countryCode: '+91',
  });
  check(
    'S6: no-shop user creates shop → 201 + fresh token',
    r.status === 201 && r.data && r.data.accessToken && r.data.user && r.data.user.tenantId,
    `got ${r.status} ${JSON.stringify(r.data)}`,
  );
  const shopBToken = r.data && r.data.accessToken;
  const shopBTenantId = r.data && r.data.user && r.data.user.tenantId;
  if (shopBTenantId) {
    const dbCheck = await db.query('SELECT tenant_id FROM users WHERE id = 53');
    check('S7: user attached to shop in DB', String(dbCheck.rows[0].tenant_id) === String(shopBTenantId), `db=${dbCheck.rows[0].tenant_id} api=${shopBTenantId}`);
  }

  r = await api('POST', '/tenants', shopBToken, { name: 'Second Shop' });
  check('S8: one-user-one-shop → second create rejected (409)', r.status === 409, `got ${r.status} ${JSON.stringify(r.data)}`);

  console.log('\n── Dashboard / data scoping ─────────────────────────────────');
  r = await api('GET', '/dashboard/kpis', token1);
  check('S9: legacy tenant-1 dashboard works', r.status === 200 && Number(r.data && r.data.totalRevenue) > 0, `got ${r.status} rev=${r.data && r.data.totalRevenue}`);

  r = await api('GET', '/dashboard/kpis', token2);
  check('S10: tenant-2 dashboard → 200 (own data only)', r.status === 200, `got ${r.status}`);
  r = await api('GET', '/dashboard/kpis', shopBToken);
  check('S11: shop-B dashboard → 200 (own data only)', r.status === 200, `got ${r.status}`);

  console.log('\n── Cross-tenant read/write ──────────────────────────────────');
  const saleBody = {
    invoiceNumber: `ISO-${Date.now()}`,
    customerName: 'Isolation Customer',
    saleDate: new Date().toISOString().split('T')[0],
    saleMode: 'from_vehicle',
    productType: 'meat',
    numberOfBirds: 10,
    unitPrice: '100',
    payments: [{ paymentMode: 'cash', amount: '500' }],
  };
  r = await api('POST', '/sales', token2, { ...saleBody, tenantId: shopBTenantId });
  check('S12: body-injected tenantId rejected (whitelist → 400)', r.status === 400, `got ${r.status} ${JSON.stringify(r.data)}`);

  r = await api('POST', '/sales', token2, saleBody);
  check('S13: valid sale created by tenant 2 → 201', r.status === 201, `got ${r.status} ${JSON.stringify(r.data)}`);
  const saleId = r.data && r.data.id;
  const saleTenant = await db.query('SELECT tenant_id FROM sales WHERE id = $1', [saleId]);
  check('S14: sale row stored under tenant 2', saleTenant.rows[0] && String(saleTenant.rows[0].tenant_id) === '2', `got ${JSON.stringify(saleTenant.rows)}`);

  const payRow = await db.query('SELECT tenant_id FROM sale_payments WHERE sale_id = $1', [saleId]);
  check('S15: child sale_payments row tagged with tenant 2', payRow.rows[0] && String(payRow.rows[0].tenant_id) === '2', `got ${JSON.stringify(payRow.rows)}`);

  r = await api('GET', `/sales/${saleId}`, shopBToken);
  check('S16: cross-tenant READ of sale → 404', r.status === 404, `got ${r.status} ${JSON.stringify(r.data)}`);

  r = await api('PATCH', `/sales/${saleId}`, shopBToken, { customerName: 'HACKED' });
  check('S17: cross-tenant UPDATE of sale → 404', r.status === 404, `got ${r.status} ${JSON.stringify(r.data)}`);

  r = await api('DELETE', `/sales/${saleId}`, shopBToken);
  check('S18: cross-tenant DELETE of sale → 404', r.status === 404, `got ${r.status} ${JSON.stringify(r.data)}`);

  r = await api('GET', `/sales/${saleId}`, token2);
  check('S19: owner still reads own sale → 200', r.status === 200, `got ${r.status}`);

  console.log('\n── Expense categories (tenant-scoped uniqueness) ────────────');
  const catBody = { name: `Fuel-${Date.now()}`, description: 'isolation test' };
  r = await api('POST', '/expense-categories', token2, catBody);
  check('S20: create category as tenant 2 → 201', r.status === 201, `got ${r.status} ${JSON.stringify(r.data)}`);

  r = await api('POST', '/expense-categories', shopBToken, catBody);
  check('S21: same category name in shop B → allowed (201)', r.status === 201, `got ${r.status} ${JSON.stringify(r.data)}`);

  r = await api('POST', '/expense-categories', token2, catBody);
  check('S22: duplicate category name in SAME tenant → rejected (400)', r.status === 400, `got ${r.status} ${JSON.stringify(r.data)}`);

  const catRows = await db.query('SELECT tenant_id, name FROM expense_categories WHERE name = $1 ORDER BY tenant_id', [catBody.name]);
  check(
    'S23: category exists for exactly both tenants (2 & shop B)',
    catRows.rows.length === 2 &&
      catRows.rows.some((x) => String(x.tenant_id) === '2') &&
      catRows.rows.some((x) => String(x.tenant_id) === String(shopBTenantId)),
    JSON.stringify(catRows.rows),
  );

  r = await api('GET', '/expense-categories', token2);
  const apiCats = Array.isArray(r.data) ? r.data : [];
  const allOwn = apiCats.every((c) => Number(c.tenantId) === 2 || Number(c.tenant_id) === 2);
  check('S24: GET /expense-categories returns only tenant-2 rows', r.status === 200 && allOwn, `got ${r.status} count=${apiCats.length}`);

  console.log('\n── Settings / billing scoping ───────────────────────────────');
  r = await api('GET', '/settings', token2);
  check('S25: settings for tenant 2 → 200', r.status === 200, `got ${r.status}`);
  r = await api('GET', '/settings', shopBToken);
  check('S26: settings for shop B → 200', r.status === 200, `got ${r.status}`);

  r = await api('GET', '/billing/parties', token2);
  check('S27: billing/parties tenant 2 → 200', r.status === 200, `got ${r.status}`);

  r = await api('GET', '/reports/profit-loss', token2);
  check('S28: reports profit-loss tenant 2 → 200 (scoped)', r.status === 200, `got ${r.status} ${JSON.stringify(r.data)}`);

  await api('DELETE', `/sales/${saleId}`, token2);

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(`Results: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log('Failures:', failures.join(', '));
    process.exit(1);
  }
  await db.end();
}

main().catch((err) => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});