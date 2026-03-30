const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://poultry_user:poultry_user1212@poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com:5432/poultry',
  ssl: { rejectUnauthorized: false }
});

// Data from the image - 15.03.26, Dukan, Rate 146
const customerRows = [
  { customerName: 'Akka',    numBirds: 2,  weight: 3.450 },
  { customerName: 'Alim',    numBirds: 24, weight: 51.500 },
  { customerName: 'Anik',    numBirds: 6,  weight: 11.300 },
  { customerName: 'Anish',   numBirds: 29, weight: 73.600 },
  { customerName: 'Asim',    numBirds: 16, weight: 36.300 },
  { customerName: 'Asim',    numBirds: 8,  weight: 16.800 },
  { customerName: 'Azam',    numBirds: 6,  weight: 12.900 },
  { customerName: 'Bashir',  numBirds: 5,  weight: 10.000 },
  { customerName: 'Imtyaz',  numBirds: 2,  weight: 5.300 },
  { customerName: 'Imtyaz',  numBirds: 4,  weight: 8.050 },
  { customerName: 'Komal',   numBirds: 5,  weight: 10.800 },
  { customerName: 'Mukttar', numBirds: 7,  weight: 20.300 },
  { customerName: 'Naime',   numBirds: 4,  weight: 8.950 },
  { customerName: 'Nayaz',   numBirds: 10, weight: 21.500 },
  { customerName: 'Nazir',   numBirds: 14, weight: 30.600 },
  { customerName: 'Rakesh',  numBirds: 16, weight: 38.100 },
  { customerName: 'Razik',   numBirds: 3,  weight: 7.600 },
  { customerName: 'Sakil',   numBirds: 8,  weight: 16.900 },
  { customerName: 'Salim',   numBirds: 5,  weight: 10.500 },
  { customerName: 'Sarfraj', numBirds: 4,  weight: 7.300 },
  { customerName: 'Shbaz',   numBirds: 2,  weight: 4.300 },
  { customerName: 'Shoab',   numBirds: 10, weight: 20.000 },
];

const rate = 146;
const saleDate = '2026-03-15';
const totalBirds = customerRows.reduce((s, r) => s + r.numBirds, 0);
const totalWeight = customerRows.reduce((s, r) => s + r.weight, 0);
const totalAmount = Math.round(totalWeight * rate);
const grossAmount = totalAmount;
const netAmount = totalAmount;

async function run() {
  await client.connect();
  console.log('Connected to DB');

  // 1. Check/create Dukan retailer
  let retailerId;
  const existing = await client.query("SELECT id FROM retailers WHERE name ILIKE 'Dukan' LIMIT 1");
  if (existing.rows.length > 0) {
    retailerId = existing.rows[0].id;
    console.log('Found existing Dukan retailer, id:', retailerId);
  } else {
    const ins = await client.query(
      "INSERT INTO retailers (name, owner_name, phone, status, created_at, updated_at) VALUES ('Dukan', 'Dukan', '0000000000', 'active', NOW(), NOW()) RETURNING id"
    );
    retailerId = ins.rows[0].id;
    console.log('Created Dukan retailer, id:', retailerId);
  }

  // 2. Check invoice number doesn't already exist
  const invCheck = await client.query("SELECT id FROM sales WHERE invoice_number = 'SI-150326' LIMIT 1");
  if (invCheck.rows.length > 0) {
    console.log('Invoice SI-150326 already exists, skipping insert.');
    await client.end();
    return;
  }

  // 3. Store customer rows in notes as JSON
  const notesJson = JSON.stringify({
    text: 'Dukan sale - 15.03.26',
    customerRows: customerRows.map(r => ({
      customerName: r.customerName,
      numBirds: r.numBirds,
      weight: r.weight,
      ratePerKg: rate,
    }))
  });

  // 4. Insert the sale
  const result = await client.query(`
    INSERT INTO sales (
      invoice_number, customer_name, sale_date, sale_mode, product_type,
      quantity, unit, unit_price, total_amount,
      transport_charges, loading_charges, commission, other_charges,
      weight_shortage, mortality_deduction, other_deduction,
      gross_amount, net_amount,
      payment_status, amount_received,
      notes, retailer_id, created_at, updated_at
    ) VALUES (
      'SI-150326', 'Dukan', $1, 'from_vehicle', 'meat',
      $2, 'kg', $3, $4,
      0, 0, 0, 0,
      0, 0, 0,
      $4, $4,
      'pending', 0,
      $5, $6, NOW(), NOW()
    ) RETURNING id, invoice_number
  `, [saleDate, totalWeight.toFixed(3), rate, totalAmount, notesJson, retailerId]);

  console.log('Sale inserted:', result.rows[0]);
  console.log(`Total Birds: ${totalBirds}, Total Weight: ${totalWeight.toFixed(3)} kg, Total Amount: ${totalAmount}`);

  await client.end();
  console.log('Done!');
}

run().catch(e => { console.error('Error:', e.message); client.end(); });
