import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Sale } from '../sales/sale.entity';
import { Expense } from '../expenses/expense.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { PurchaseOrder } from '../purchases/entities/purchase-order.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { GodownSale } from '../godown/entities/godown-sale.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Sale, Expense, Vehicle, PurchaseOrder, InventoryItem, GodownSale])],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}