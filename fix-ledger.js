const { Client } = require('pg');

const SSL = { rejectUnauthorized: false };
const connectionString = "postgresql://poultry_user:poultry_user1212@poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com:5432/poultry_stage";

async function fix() {
  const client = new Client({ connectionString, ssl: SSL });
  await client.connect();
  console.log('Connected to DB');

  // 1. Update Retailer vouchers in billing_ledger to credit
  const updateRes = await client.query(`
    UPDATE billing_ledger bl
    SET debit = 0, credit = CAST(pv.amount AS numeric)
    FROM payment_vouchers pv
    WHERE bl.reference_type = 'Voucher'
      AND bl.reference_id = pv.voucher_number
      AND pv.payee_type = 'retailer'
    RETURNING bl.id, bl.reference_id, bl.party_id;
  `);

  console.log(`Updated ${updateRes.rows.length} retailer vouchers to CREDIT.`);
  updateRes.rows.forEach(r => console.log(`   - Ledger ID: ${r.id}, Ref: ${r.reference_id}`));

  // 2. Fetch all parties and recalculate balances
  const partiesRes = await client.query(`SELECT id, type, name FROM billing_parties`);
  for (const party of partiesRes.rows) {
    const partyId = party.id;
    console.log(`Recalculating balance for party ${party.name} (${party.type})...`);

    // Get direct ledger entries
    const directEntriesRes = await client.query(
      `SELECT id, debit, credit, date, created_at FROM billing_ledger WHERE party_id = $1 ORDER BY date ASC, created_at ASC`,
      [partyId]
    );
    const directEntries = directEntriesRes.rows;

    const dynamicEntries = [];
    if (party.type === 'Farm') {
      // Load PO and payments
      const poRes = await client.query(
        `SELECT po.id, po.order_number, po.order_date, po.net_amount, po.total_amount, po.created_at 
         FROM purchase_orders po 
         WHERE TRIM(LOWER(po.supplier_name)) = TRIM(LOWER($1))`,
        [party.name]
      );
      for (const po of poRes.rows) {
        dynamicEntries.push({
          debit: 0,
          credit: Number(po.net_amount || po.total_amount || 0),
          date: po.order_date,
          createdAt: po.created_at,
        });

        const payRes = await client.query(
          `SELECT pay.id, pay.amount, pay.created_at FROM purchase_order_payments pay WHERE pay.purchase_order_id = $1`,
          [po.id]
        );
        for (const pay of payRes.rows) {
          dynamicEntries.push({
            debit: Number(pay.amount),
            credit: 0,
            date: pay.created_at ? new Date(pay.created_at).toISOString().split('T')[0] : po.order_date,
            createdAt: pay.created_at,
          });
        }
      }
    } else if (party.type === 'Retailer') {
      const salesRes = await client.query(
        `SELECT s.id, s.invoice_number, s.sale_no, s.sale_date, s.net_amount, s.total_amount, s.created_at 
         FROM sales s 
         WHERE TRIM(LOWER(s.customer_name)) = TRIM(LOWER($1))`,
        [party.name]
      );
      for (const sale of salesRes.rows) {
        dynamicEntries.push({
          debit: Number(sale.net_amount || sale.total_amount || 0),
          credit: 0,
          date: sale.sale_date,
          createdAt: sale.created_at,
        });

        const payRes = await client.query(
          `SELECT pay.id, pay.amount, pay.created_at FROM sale_payments pay WHERE pay.sale_id = $1`,
          [sale.id]
        );
        for (const pay of payRes.rows) {
          dynamicEntries.push({
            debit: 0,
            credit: Number(pay.amount),
            date: pay.created_at ? new Date(pay.created_at).toISOString().split('T')[0] : sale.sale_date,
            createdAt: pay.created_at,
          });
        }
      }
    }

    const allEntries = [...directEntries, ...dynamicEntries];
    allEntries.sort((a, b) => {
      if (a.date !== b.date) {
        return String(a.date).localeCompare(String(b.date));
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    let balance = 0;
    for (const entry of allEntries) {
      balance += Number(entry.debit || 0) - Number(entry.credit || 0);
      if (entry.id) {
        // This is a direct ledger entry in DB, update its balance field
        await client.query(`UPDATE billing_ledger SET balance = $1 WHERE id = $2`, [balance, entry.id]);
      }
    }

    // Update billing_parties current_balance
    await client.query(`UPDATE billing_parties SET current_balance = $1 WHERE id = $2`, [balance, partyId]);
    console.log(`   -> New balance: ${balance}`);
  }

  await client.end();
  console.log('Done!');
}

fix().catch(console.error);
