import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmersService } from './farmers.service';
import { FarmersController } from './farmers.controller';
import { Farmer } from './farmer.entity';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [TypeOrmModule.forFeature([Farmer]), forwardRef(() => BillingModule)],
  controllers: [FarmersController],
  providers: [FarmersService],
  exports: [FarmersService],
})
export class FarmersModule {}