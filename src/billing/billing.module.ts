import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { BillingParty } from './entities/billing-party.entity';
import { BillingSale } from './entities/billing-sale.entity';
import { BillingPayment } from './entities/billing-payment.entity';
import { BillingLedger } from './entities/billing-ledger.entity';
import { Expense } from '../expenses/expense.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { PurchaseOrder } from '../purchases/entities/purchase-order.entity';
import { Sale } from '../sales/sale.entity';
import { Farmer } from '../farmers/farmer.entity';
import { Retailer } from '../retailers/retailer.entity';
import { GodownSale } from '../godown/entities/godown-sale.entity';
import { GodownSalePayment } from '../godown/entities/godown-sale-payment.entity';

@Module({
<<<<<<< HEAD
  imports: [TypeOrmModule.forFeature([BillingParty, BillingSale, BillingPayment, BillingLedger, Expense, InventoryItem, PurchaseOrder, Sale, Farmer, Retailer])],
=======
  imports: [
    TypeOrmModule.forFeature([
      BillingParty,
      BillingPayment,
      BillingLedger,
      Expense,
      InventoryItem,
      PurchaseOrder,
      Sale,
      Farmer,
      Retailer,
      GodownSale,
      GodownSalePayment,
    ]),
  ],
>>>>>>> 53582c1 (fix: add godown sales to billing ledger and dashboard KPIs)
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
