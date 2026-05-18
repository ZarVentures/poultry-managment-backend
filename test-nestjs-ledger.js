const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { BillingService } = require('./dist/billing/billing.service');

async function bootstrap() {
  console.log("Starting NestJS context to test BillingService.getLedger...");
  const app = await NestFactory.createApplicationContext(AppModule);
  const billingService = app.get(BillingService);

  const name = "Salim Bhai ";
  console.log(`\nCalling billingService.findOrCreatePartyByName("${name}")...`);
  const party = await billingService.findOrCreatePartyByName(name);
  console.log(`Resolved Party: ID = ${party.id}, Name = "${party.name}", Type = ${party.type}`);

  console.log(`\nCalling billingService.getLedger("${party.id}")...`);
  const ledger = await billingService.getLedger(party.id);
  console.log(`Ledger entries returned by NestJS: ${ledger.length}`);
  console.log(ledger);

  await app.close();
}

bootstrap().catch(err => {
  console.error("Error in NestJS test:", err);
  process.exit(1);
});
