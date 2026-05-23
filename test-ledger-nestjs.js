const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module'); // We use dist since it's compiled, or we can use ts-node
const { BillingService } = require('./dist/billing/billing.service');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const billingService = app.get(BillingService);
  
  console.log("--- TEST RETAILER LEDGER FOR SALIM ---");
  const ledger = await billingService.getLedgerByName("Salim Bhai ");
  console.log("Ledger entries count:", ledger.length);
  console.log("Entries:", ledger);
  
  await app.close();
}

bootstrap().catch(console.error);
