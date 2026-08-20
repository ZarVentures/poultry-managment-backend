import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditLog } from './audit-log.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('limit') limit?: string,
  ): Promise<AuditLog[]> {
    return this.auditService.findAll({
      startDate,
      endDate,
      userId,
      action,
      entity,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('recent')
  async getRecentLogs(@Query('limit') limit?: string): Promise<AuditLog[]> {
    return this.auditService.getRecentLogs(limit ? parseInt(limit, 10) : 50);
  }

  @Get('entity/:entity/:entityId')
  async findByEntity(
    @Query('entity') entity: string,
    @Query('entityId') entityId: string,
  ): Promise<AuditLog[]> {
    return this.auditService.findByEntity(entity, entityId);
  }

  @Get('user/:userId')
  async findByUser(
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
  ): Promise<AuditLog[]> {
    return this.auditService.findByUser(userId, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('statistics')
  async getStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<{
    totalLogs: number;
    byAction: Record<string, number>;
    byEntity: Record<string, number>;
    byUser: Array<{ userId: string; userEmail: string; count: number }>;
  }> {
    return this.auditService.getStatistics(startDate, endDate);
  }
}
