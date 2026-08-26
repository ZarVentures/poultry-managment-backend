import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GodownController } from './godown.controller';
import { GodownsController } from './godowns.controller';
import { GodownService } from './godown.service';
import { GodownMaster } from './godown-master.entity';
import { GodownInwardEntry } from './godown-inward.entity';
import { GodownSale } from './entities/godown-sale.entity';
import { GodownSalePayment } from './entities/godown-sale-payment.entity';
import { GodownMortality } from './godown-mortality.entity';
import { GodownExpense } from './godown-expense.entity';
import { BirdReturn } from '../sales/entities/bird-return.entity';
import { CagesModule } from '../cages/cages.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GodownMaster,
      GodownInwardEntry,
      GodownSale,
      GodownSalePayment,
      GodownMortality,
      GodownExpense,
      BirdReturn,
    ]),
    CagesModule,
    PermissionsModule,
  ],
  controllers: [GodownController, GodownsController],
  providers: [GodownService],
  exports: [GodownService],
})
export class GodownModule { }
