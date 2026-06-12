import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FailedAccountingJob } from './failed-jobs.entity';
import { AccountingClient } from './accounting.client';
import { AccountingService } from './accounting.service';
import { AccountingRetryService } from './accounting.retry.service';
import { AccountingLogger } from './accounting.logger';
import { AccountingController } from './accounting.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([FailedAccountingJob]),
  ],
  controllers: [
    AccountingController,
  ],
  providers: [
    AccountingClient,
    AccountingLogger,
    AccountingService,
    AccountingRetryService,
  ],
  exports: [
    AccountingService,
    AccountingLogger,
  ],
})
export class AccountingModule {}
