import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GodownController } from './godown.controller';
import { GodownService } from './godown.service';
import { GodownInwardEntry } from './godown-inward.entity';
import { GodownSale } from './godown-sale.entity';
import { GodownMortality } from './godown-mortality.entity';
import { GodownExpense } from './godown-expense.entity';
import { CagesModule } from '../cages/cages.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GodownInwardEntry,
      GodownSale,
      GodownMortality,
      GodownExpense,
    ]),
    CagesModule,
  ],
  controllers: [GodownController],
  providers: [GodownService],
  exports: [GodownService],
})
export class GodownModule {}
