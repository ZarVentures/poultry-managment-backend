import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MortalityService } from './mortality.service';
import { MortalityController } from './mortality.controller';
import { Mortality } from './mortality.entity';
import { PurchaseOrder } from '../purchases/entities/purchase-order.entity';
import { GodownMortality } from '../godown/godown-mortality.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Mortality, PurchaseOrder, GodownMortality])],
  controllers: [MortalityController],
  providers: [MortalityService],
  exports: [MortalityService],
})
export class MortalityModule {}
