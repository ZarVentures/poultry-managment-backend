import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MortalityService } from './mortality.service';
import { MortalityController } from './mortality.controller';
import { Mortality } from './mortality.entity';
import { PurchaseOrder } from '../purchases/entities/purchase-order.entity';
import { GodownMortality } from '../godown/godown-mortality.entity';
import { GodownModule } from '../godown/godown.module';
import { CagesModule } from '../cages/cages.module';

@Module({
  imports: [TypeOrmModule.forFeature([Mortality, PurchaseOrder, GodownMortality]), GodownModule, CagesModule],
  controllers: [MortalityController],
  providers: [MortalityService],
  exports: [MortalityService],
})
export class MortalityModule {}
