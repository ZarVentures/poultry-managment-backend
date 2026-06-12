import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FailedAccountingJob } from './failed-jobs.entity';
import { AccountingClient } from './accounting.client';
import { AccountingLogger } from './accounting.logger';
import { AccountingTransactionDTO } from './accounting.dto';
import { AccountingMapper } from './accounting.mapper';

@Injectable()
export class AccountingService {
  constructor(
    @InjectRepository(FailedAccountingJob)
    private readonly failedJobRepository: Repository<FailedAccountingJob>,
    private readonly accountingClient: AccountingClient,
    private readonly logger: AccountingLogger,
  ) {}

  /**
   * Validates and attempts to send a transaction to the Accounting Service.
   * If the API is offline or fails, saves to failed_accounting_jobs for background retry.
   */
  async syncTransaction(payload: any): Promise<boolean> {
    const dto = plainToInstance(AccountingTransactionDTO, payload);
    const errors = await validate(dto);

    if (errors.length > 0) {
      const errorMessages = errors.map(err => Object.values(err.constraints || {}).join(', '));
      this.logger.logValidationError(payload.transactionId || 'UNKNOWN', errorMessages);
      
      // Save validation failure to DB so it can be fixed/inspected by admins
      await this.saveFailedJob(payload, `Validation Error: ${errorMessages.join('; ')}`, 'failed');
      return false;
    }

    try {
      this.logger.logTransaction(dto.transactionType, dto.transactionId, dto.amount, dto.partyName);
      
      const client = this.accountingClient.getAxiosInstance();
      await client.post('/transactions', dto);
      
      return true;
    } catch (error: any) {
      const errorMsg = error.response
        ? `API Error (Status ${error.response.status}): ${JSON.stringify(error.response.data)}`
        : `Network Error: ${error.message}`;

      this.logger.logFailedRequest(dto.transactionId, errorMsg, true);
      
      // Save as PENDING for retry scheduler
      await this.saveFailedJob(dto, errorMsg, 'pending');
      return false;
    }
  }

  private async saveFailedJob(payload: any, errorMessage: string, status: 'pending' | 'failed'): Promise<FailedAccountingJob> {
    try {
      // Check if a job already exists for this transactionId to prevent duplicate retries
      const existing = await this.failedJobRepository.findOne({
        where: { payload: Like(`%"transactionId":"${payload.transactionId}"%`) }
      });

      if (existing) {
        existing.errorMessage = errorMessage;
        existing.status = status;
        existing.updatedAt = new Date();
        return await this.failedJobRepository.save(existing);
      }
      
      const job = this.failedJobRepository.create({
        payload: JSON.stringify(payload),
        errorMessage,
        retryCount: 0,
        status,
      });
      return await this.failedJobRepository.save(job);
    } catch (dbError: any) {
      this.logger.error(`[Database Error] Failed to save job in failed_accounting_jobs: ${dbError.message}`);
      // Return a dummy object to satisfy type, do not block the core execution!
      return {} as any;
    }
  }

  // Domain Helper sync functions

  async syncSale(sale: any): Promise<boolean> {
    const payload = AccountingMapper.mapSaleToAccountingPayload(sale);
    return this.syncTransaction(payload);
  }

  async syncPurchase(purchase: any): Promise<boolean> {
    const payload = AccountingMapper.mapPurchaseToAccountingPayload(purchase);
    return this.syncTransaction(payload);
  }

  async syncExpense(expense: any): Promise<boolean> {
    const payload = AccountingMapper.mapExpenseToAccountingPayload(expense);
    return this.syncTransaction(payload);
  }

  async syncPayment(voucher: any): Promise<boolean> {
    const payload = AccountingMapper.mapPaymentToAccountingPayload(voucher);
    return this.syncTransaction(payload);
  }

  async syncReceipt(payment: any, customerName?: string): Promise<boolean> {
    const payload = AccountingMapper.mapReceiptToAccountingPayload(payment, customerName);
    return this.syncTransaction(payload);
  }
}
