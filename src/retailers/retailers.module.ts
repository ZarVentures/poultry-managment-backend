import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RetailersService } from './retailers.service';
import { RetailersController } from './retailers.controller';
import { Retailer } from './retailer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Retailer])],
  controllers: [RetailersController],
  providers: [RetailersService],
  exports: [RetailersService],
})
export class RetailersModule {}