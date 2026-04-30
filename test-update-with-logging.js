// This test will help us understand what's failing in the update
// Run this locally against the database to see the actual error

const { DataSource } = require('typeorm');
require('dotenv').config();

async function testUpdate() {
  console.log('🔍 TESTING UPDATE WITH DETAILED LOGGING');
  console.log('='.repeat(70));

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    entities: ['src/**/*.entity.ts'],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    const purchaseRepo = dataSource.getRepository('PurchaseOrder');
    
    // Get the purchase order
    const order = await purchaseRepo.findOne({ where: { id: '27' } });
    console.log('\n✅ Order found:', {
      id: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: order.purchasePaymentStatus,
      totalAmount: order.totalAmount,
      totalAmountType: typeof order.totalAmount,
      advancePaid: order.advancePaid,
      advancePaidType: typeof order.advancePaid,
      totalPaymentMade: order.totalPaymentMade,
      totalPaymentMadeType: typeof order.totalPaymentMade,
    });

    // Try to update
    console.log('\n📝 Attempting update...');
    order.purchasePaymentStatus = 'paid';
    order.notes = 'Test update ' + new Date().toISOString();
    
    await purchaseRepo.save(order);
    console.log('✅ Update successful!');

    // Verify
    const updated = await purchaseRepo.findOne({ where: { id: '27' } });
    console.log('\n✅ Verified:', {
      paymentStatus: updated.purchasePaymentStatus,
      notes: updated.notes,
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('   Stack:', error.stack);
  } finally {
    await dataSource.destroy();
  }
}

testUpdate();

