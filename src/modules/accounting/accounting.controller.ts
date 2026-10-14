import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FailedAccountingJob } from './failed-jobs.entity';
import { AccountingRetryService } from './accounting.retry.service';
import { AccountingLogger } from './accounting.logger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextService } from '../../tenants/tenant-context.service';

@Controller('accounting')
@UseGuards(JwtAuthGuard)
export class AccountingController {
  constructor(
    @InjectRepository(FailedAccountingJob)
    private readonly failedJobRepository: Repository<FailedAccountingJob>,
    private readonly retryService: AccountingRetryService,
    private readonly logger: AccountingLogger,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getTenantId(): string | null {
    return this.tenantContext.getTenantId();
  }

  private tenantWhere(extra: any): any {
    const tenantId = this.getTenantId();
    return tenantId ? { ...extra, tenantId } : extra;
  }

  @Get('status')
  async getStatus() {
    const apiStatus = 'DISABLED';
    const apiDetails: any = null;

    const pendingCount = await this.failedJobRepository.count({ where: this.tenantWhere({ status: 'pending' }) });
    const failedCount = await this.failedJobRepository.count({ where: this.tenantWhere({ status: 'failed' }) });
    const completedCount = await this.failedJobRepository.count({ where: this.tenantWhere({ status: 'completed' }) });

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
    const query: any = this.tenantWhere({});
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
  async retrySingleJob(@Param('id') _id: string) {
    return {
      success: false,
      message: 'Accounting sync is turned off.',
    };
  }
}
