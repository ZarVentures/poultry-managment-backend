import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { Sale } from './sale.entity';
import { SalePayment } from './sale-payment.entity';
import { BirdReturn } from './entities/bird-return.entity';
import { BirdReturnsService } from './bird-returns.service';
import { BirdReturnsController } from './bird-returns.controller';
import { GodownMortality } from '../godown/godown-mortality.entity';
import { GodownSale } from '../godown/entities/godown-sale.entity';
import { PermissionsModule } from '../permissions/permissions.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SalePayment, BirdReturn, GodownMortality, GodownSale]),
    PermissionsModule,
    BillingModule,
  ],
  controllers: [SalesController, BirdReturnsController],
  providers: [SalesService, BirdReturnsService],
  exports: [SalesService, BirdReturnsService],
})
export class SalesModule { }
