import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { FailedAccountingJob } from './failed-jobs.entity';
import { AccountingClient } from './accounting.client';
import { AccountingLogger } from './accounting.logger';

@Injectable()
export class AccountingRetryService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: any = null;
  private isProcessing = false;

  constructor(
    @InjectRepository(FailedAccountingJob)
    private readonly failedJobRepository: Repository<FailedAccountingJob>,
    private readonly configService: ConfigService,
    private readonly accountingClient: AccountingClient,
    private readonly logger: AccountingLogger,
  ) {}

  onApplicationBootstrap() {
    const intervalSec = Number(this.configService.get<number>('ACCOUNTING_RETRY_INTERVAL_SEC') || 60);
    this.logger.log(`[Scheduler] Starting background retry loop running every ${intervalSec} seconds.`);
    
    this.timer = setInterval(() => {
      this.processFailedJobs().catch((err) => {
        this.logger.error(`Error in retry scheduler loop: ${err.message}`);
      });
    }, intervalSec * 1000);
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.logger.log('[Scheduler] Background retry scheduler stopped.');
    }
  }

  async processFailedJobs(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn('[Scheduler] Previous retry cycle is still active. Skipping this cycle.');
      return;
    }

    this.isProcessing = true;

    try {
      const maxRetries = Number(this.configService.get<number>('ACCOUNTING_MAX_RETRIES') || 5);
      
      // Fetch only pending jobs
      const pendingJobs = await this.failedJobRepository.find({
        where: {
          status: 'pending',
        },
        order: {
          createdAt: 'ASC',
        },
      });

      if (pendingJobs.length === 0) {
        this.isProcessing = false;
        return;
      }

      this.logger.log(`[Scheduler] Found ${pendingJobs.length} pending jobs to retry.`);

      const client = this.accountingClient.getAxiosInstance();

      for (const job of pendingJobs) {
        if (job.retryCount >= maxRetries) {
          job.status = 'failed';
          job.errorMessage = `Exceeded max retry limit of ${maxRetries}. Manual trigger required.`;
          await this.failedJobRepository.save(job);
          this.logger.error(`[Scheduler] Job ID: ${job.id} exceeded max retries. Marked as FAILED.`);
          continue;
        }

        let payload: any;
        try {
          payload = JSON.parse(job.payload);
        } catch (e: any) {
          job.status = 'failed';
          job.errorMessage = `Corrupted JSON Payload: ${e.message}`;
          await this.failedJobRepository.save(job);
          this.logger.error(`[Scheduler] Corrupted payload in Job ID ${job.id}. Marked as FAILED.`);
          continue;
        }

        job.retryCount += 1;

        try {
          this.logger.log(`[Scheduler] Retrying job ID: ${job.id} (Attempt ${job.retryCount}) for transaction: ${payload.transactionId}`);
          
          await client.post('/transactions', payload);

          // Mark completed on success
          job.status = 'completed';
          job.errorMessage = undefined as any; // clears the error message
          await this.failedJobRepository.save(job);
          this.logger.logRetryAttempt(job.id, job.retryCount, 'SUCCESS');
        } catch (error: any) {
          const errorMsg = error.response
            ? `API Error (Status ${error.response.status}): ${JSON.stringify(error.response.data)}`
            : `Network Error: ${error.message}`;

          job.errorMessage = errorMsg;
          if (job.retryCount >= maxRetries) {
            job.status = 'failed';
            this.logger.error(`[Scheduler] Retry failed and reached max retries. Marking job ID ${job.id} as FAILED.`);
          }
          
          await this.failedJobRepository.save(job);
          this.logger.logRetryAttempt(job.id, job.retryCount, 'FAILED', errorMsg);
        }
      }
    } catch (error: any) {
      this.logger.error(`Error processing failed jobs: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }
}
