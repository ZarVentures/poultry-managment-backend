import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { Sale } from './sale.entity';
import { SalePayment } from './sale-payment.entity';
import { BirdReturn } from './entities/bird-return.entity';
import { BirdReturnsService } from './bird-returns.service';
import { BirdReturnsController } from './bird-returns.controller';
import { VehicleBirdReturn } from './entities/vehicle-bird-return.entity';
import { VehicleBirdReturnsService } from './vehicle-bird-returns.service';
import { VehicleBirdReturnsController } from './vehicle-bird-returns.controller';
import { GodownMortality } from '../godown/godown-mortality.entity';
import { GodownSale } from '../godown/entities/godown-sale.entity';
import { PermissionsModule } from '../permissions/permissions.module';
import { BillingModule } from '../billing/billing.module';
import { CagesModule } from '../cages/cages.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SalePayment, BirdReturn, VehicleBirdReturn, GodownMortality, GodownSale]),
    PermissionsModule,
    BillingModule,
    CagesModule,
  ],
  controllers: [SalesController, BirdReturnsController, VehicleBirdReturnsController],
  providers: [SalesService, BirdReturnsService, VehicleBirdReturnsService],
  exports: [SalesService, BirdReturnsService, VehicleBirdReturnsService],
})
export class SalesModule { }
