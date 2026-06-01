import { Controller, Get, Post, Param, Query, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FailedAccountingJob } from './failed-jobs.entity';
import { AccountingClient } from './accounting.client';
import { AccountingRetryService } from './accounting.retry.service';
import { AccountingLogger } from './accounting.logger';

@Controller('accounting')
export class AccountingController {
  constructor(
    @InjectRepository(FailedAccountingJob)
    private readonly failedJobRepository: Repository<FailedAccountingJob>,
    private readonly accountingClient: AccountingClient,
    private readonly retryService: AccountingRetryService,
    private readonly logger: AccountingLogger,
  ) {}

  @Get('status')
  async getStatus() {
    let apiStatus = 'OFFLINE';
    let apiDetails: any = null;

    try {
      const client = this.accountingClient.getAxiosInstance();
      const response = await client.get('/transactions/stats');
      if (response.status === 200) {
        apiStatus = 'ONLINE';
        apiDetails = response.data;
      }
    } catch (error: any) {
      apiDetails = { error: error.message };
    }

    const pendingCount = await this.failedJobRepository.count({ where: { status: 'pending' } });
    const failedCount = await this.failedJobRepository.count({ where: { status: 'failed' } });
    const completedCount = await this.failedJobRepository.count({ where: { status: 'completed' } });

    return {
      integrationStatus: apiStatus,
      failedJobsSummary: {
        pendingRetry: pendingCount,
        permanentlyFailed: failedCount,
        successfullySynced: completedCount,
      },
      apiDetails,
    };
  }

  @Get('failed-jobs')
  async getFailedJobs(@Query('status') status?: 'pending' | 'failed' | 'completed') {
    const query: any = {};
    if (status) {
      query.status = status;
    }
    
    return await this.failedJobRepository.find({
      where: query,
      order: { createdAt: 'DESC' },
    });
  }

  @Post('retry/all')
  async retryAll() {
    // Triggers retry loop in the background asynchronously
    this.retryService.processFailedJobs().catch((err) => {
      this.logger.error(`Manual bulk retry processing error: ${err.message}`);
    });

    return {
      message: 'Bulk retry processing triggered successfully in the background.',
    };
  }

  @Post('retry/:id')
  async retrySingleJob(@Param('id') id: string) {
    const job = await this.failedJobRepository.findOne({ where: { id } as any });
    if (!job) {
      throw new NotFoundException(`Failed Job ID ${id} not found`);
    }

    const client = this.accountingClient.getAxiosInstance();
    const payload = JSON.parse(job.payload);

    try {
      await client.post('/transactions', payload);

      job.status = 'completed';
      job.errorMessage = undefined as any;
      await this.failedJobRepository.save(job);

      return {
        success: true,
        message: `Successfully synced transaction ${payload.transactionId} to the Accounting Service.`,
        job,
      };
    } catch (error: any) {
      const errorMsg = error.response
        ? `API Error (Status ${error.response.status}): ${JSON.stringify(error.response.data)}`
        : `Network Error: ${error.message}`;

      job.errorMessage = errorMsg;
      job.retryCount += 1;
      await this.failedJobRepository.save(job);

      return {
        success: false,
        message: `Failed to sync transaction: ${errorMsg}`,
        job,
      };
    }
  }
}
