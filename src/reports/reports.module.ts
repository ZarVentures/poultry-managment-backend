import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { BalanceSheetService } from './balance-sheet.service';
import { PurchaseOrder } from '../purchases/entities/purchase-order.entity';
import { Sale } from '../sales/sale.entity';
import { Expense } from '../expenses/expense.entity';
import { Retailer } from '../retailers/retailer.entity';
import { GodownSale } from '../godown/entities/godown-sale.entity';
import { SalePayment } from '../sales/sale-payment.entity';
import { GodownSalePayment } from '../godown/entities/godown-sale-payment.entity';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseOrder, Sale, Expense, Retailer, GodownSale, SalePayment, GodownSalePayment]),
    PermissionsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, BalanceSheetService],
  exports: [ReportsService, BalanceSheetService],
})
export class ReportsModule { }
