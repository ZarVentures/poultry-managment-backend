const { Client } = require('pg');
require('dotenv').config();

// Helper to generate random date within range
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper to format date as YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

async function populateFakeData() {
  console.log('🌱 POPULATING DATABASE WITH FAKE DATA');
  console.log('='.repeat(70));

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Database connected\n');

    // Get existing farmers and retailers
    const farmers = await client.query('SELECT id, name, phone FROM farmers WHERE status = $1 LIMIT 10', ['active']);
    const retailers = await client.query('SELECT id, name, phone FROM retailers WHERE status = $1 LIMIT 10', ['active']);
    const vehicles = await client.query('SELECT id FROM vehicles LIMIT 5');

    if (farmers.rows.length === 0) {
      console.log('❌ No active farmers found. Please add farmers first.');
      return;
    }

    console.log(`📋 Found ${farmers.rows.length} farmers, ${retailers.rows.length} retailers, ${vehicles.rows.length} vehicles\n`);

    // Date range: Last 6 months
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    let purchaseCount = 0;
    let salesCount = 0;
    let expenseCount = 0;

    // Generate 30 Purchase Orders
    console.log('📦 Creating Purchase Orders...');
    for (let i = 0; i < 30; i++) {
      const farmer = farmers.rows[Math.floor(Math.random() * farmers.rows.length)];
      const vehicle = vehicles.rows.length > 0 ? vehicles.rows[Math.floor(Math.random() * vehicles.rows.length)] : null;
      const orderDate = formatDate(randomDate(startDate, endDate));
      const birdType = Math.random() > 0.5 ? 'broiler' : 'layer';
      const totalWeight = (Math.random() * 500 + 100).toFixed(2); // 100-600 kg
      const ratePerKg = (Math.random() * 50 + 150).toFixed(2); // ₹150-200/kg
      const totalAmount = (parseFloat(totalWeight) * parseFloat(ratePerKg)).toFixed(2);
      
      const transportCharges = (Math.random() * 500 + 200).toFixed(2);
      const loadingCharges = (Math.random() * 300 + 100).toFixed(2);
      const commission = (Math.random() * 400 + 100).toFixed(2);
      const otherCharges = (Math.random() * 200).toFixed(2);
      
      const weightShortage = (Math.random() * 100).toFixed(2);
      const mortalityDeduction = Math.random() > 0.7 ? (Math.random() * 500 + 100).toFixed(2) : '0.00';
      const otherDeduction = (Math.random() * 100).toFixed(2);
      
      const grossAmount = (parseFloat(totalAmount) + parseFloat(transportCharges) + parseFloat(loadingCharges) + parseFloat(commission) + parseFloat(otherCharges)).toFixed(2);
      const netAmount = (parseFloat(grossAmount) - parseFloat(weightShortage) - parseFloat(mortalityDeduction) - parseFloat(otherDeduction)).toFixed(2);
      
      const paymentStatuses = ['paid', 'partial', 'pending'];
      const purchasePaymentStatus = paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)];
      const advancePaid = purchasePaymentStatus === 'paid' ? netAmount : 
                         purchasePaymentStatus === 'partial' ? (parseFloat(netAmount) * 0.5).toFixed(2) : '0.00';
      const totalPaymentMade = advancePaid;
      const balanceAmount = (parseFloat(netAmount) - parseFloat(totalPaymentMade)).toFixed(2);
      const outstandingPayment = balanceAmount;
      
      const paymentModes = ['cash', 'bank_transfer', 'cheque'];
      const paymentMode = paymentModes[Math.floor(Math.random() * paymentModes.length)];
      
      const orderNumber = `PO-${Date.now()}-${i}`;

      await client.query(`
        INSERT INTO purchase_orders (
          order_number, supplier_name, order_date, status, farmer_id, farmer_mobile, farm_location,
          vehicle_id, bird_type, total_weight, rate_per_kg, total_amount,
          transport_charges, loading_charges, commission, other_charges,
          weight_shortage, mortality_deduction, other_deduction,
          gross_amount, net_amount, purchase_payment_status, advance_paid, payment_mode,
          total_payment_made, balance_amount, outstanding_payment, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
        )
      `, [
        orderNumber, farmer.name, orderDate, 'received', farmer.id, farmer.phone, 'Farm Location',
        vehicle?.id, birdType, totalWeight, ratePerKg, totalAmount,
        transportCharges, loadingCharges, commission, otherCharges,
        weightShortage, mortalityDeduction, otherDeduction,
        grossAmount, netAmount, purchasePaymentStatus, advancePaid, paymentMode,
        totalPaymentMade, balanceAmount, outstandingPayment, `Auto-generated test data ${i + 1}`
      ]);
      
      purchaseCount++;
    }
    console.log(`✅ Created ${purchaseCount} purchase orders\n`);

    // Generate 40 Sales
    console.log('💰 Creating Sales...');
    for (let i = 0; i < 40; i++) {
      const retailer = retailers.rows.length > 0 ? retailers.rows[Math.floor(Math.random() * retailers.rows.length)] : null;
      const customerName = retailer ? retailer.name : `Customer ${i + 1}`;
      
      const saleDate = formatDate(randomDate(startDate, endDate));
      const saleMode = Math.random() > 0.5 ? 'from_vehicle' : 'from_godown';
      const productType = ['eggs', 'meat', 'chicks', 'other'][Math.floor(Math.random() * 4)];
      const quantity = (Math.random() * 300 + 50).toFixed(2); // 50-350
      const unit = productType === 'eggs' ? 'dozen' : 'kg';
      const unitPrice = (Math.random() * 80 + 200).toFixed(2); // ₹200-280
      const totalAmount = (parseFloat(quantity) * parseFloat(unitPrice)).toFixed(2);
      
      const transportCharges = (Math.random() * 300 + 100).toFixed(2);
      const loadingCharges = (Math.random() * 200 + 50).toFixed(2);
      const commission = (Math.random() * 300 + 50).toFixed(2);
      const otherCharges = (Math.random() * 150).toFixed(2);
      
      const weightShortage = (Math.random() * 100).toFixed(2);
      const mortalityDeduction = (Math.random() * 50).toFixed(2);
      const otherDeduction = (Math.random() * 100).toFixed(2);
      
      const grossAmount = (parseFloat(totalAmount) + parseFloat(transportCharges) + parseFloat(loadingCharges) + parseFloat(commission) + parseFloat(otherCharges)).toFixed(2);
      const netAmount = (parseFloat(grossAmount) - parseFloat(weightShortage) - parseFloat(mortalityDeduction) - parseFloat(otherDeduction)).toFixed(2);
      
      const paymentStatuses = ['paid', 'partial', 'pending'];
      const paymentStatus = paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)];
      const amountReceived = paymentStatus === 'paid' ? netAmount : 
                            paymentStatus === 'partial' ? (parseFloat(netAmount) * 0.6).toFixed(2) : '0.00';
      
      const invoiceNumber = `INV-${Date.now()}-${i}`;

      await client.query(`
        INSERT INTO sales (
          invoice_number, customer_name, sale_date, sale_mode, product_type,
          quantity, unit, unit_price, total_amount,
          transport_charges, loading_charges, commission, other_charges,
          weight_shortage, mortality_deduction, other_deduction,
          gross_amount, net_amount, payment_status, amount_received, retailer_id, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
        )
      `, [
        invoiceNumber, customerName, saleDate, saleMode, productType,
        quantity, unit, unitPrice, totalAmount,
        transportCharges, loadingCharges, commission, otherCharges,
        weightShortage, mortalityDeduction, otherDeduction,
        grossAmount, netAmount, paymentStatus, amountReceived, retailer?.id, `Auto-generated test data ${i + 1}`
      ]);
      
      salesCount++;
    }
    console.log(`✅ Created ${salesCount} sales\n`);

    // Generate 20 Expenses
    console.log('💸 Creating Expenses...');
    const categories = ['feed', 'medicine', 'utilities', 'labor', 'maintenance', 'transportation', 'other'];
    for (let i = 0; i < 20; i++) {
      const expenseDate = formatDate(randomDate(startDate, endDate));
      const category = categories[Math.floor(Math.random() * categories.length)];
      const amount = (Math.random() * 5000 + 500).toFixed(2); // ₹500-5500
      const description = `${category.charAt(0).toUpperCase() + category.slice(1)} expense - Test ${i + 1}`;
      
      const paymentMethods = ['cash', 'bank_transfer', 'check', 'credit_card'];
      const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

      await client.query(`
        INSERT INTO expenses (expense_date, category, description, amount, payment_method, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [expenseDate, category, description, amount, paymentMethod, `Auto-generated test data ${i + 1}`]);
      
      expenseCount++;
    }
    console.log(`✅ Created ${expenseCount} expenses\n`);

    console.log('='.repeat(70));
    console.log('✅ FAKE DATA POPULATION COMPLETE');
    console.log(`   📦 Purchase Orders: ${purchaseCount}`);
    console.log(`   💰 Sales: ${salesCount}`);
    console.log(`   💸 Expenses: ${expenseCount}`);
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

populateFakeData();

