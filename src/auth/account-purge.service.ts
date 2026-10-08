import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { AuditLog } from '../audit/audit-log.entity';

@Injectable()
export class AccountPurgeService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AccountPurgeService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  onApplicationBootstrap() {
    const sixHours = 6 * 60 * 60 * 1000;
    this.timer = setInterval(() => {
      this.purgeExpired().catch((err) => this.logger.error(err?.message || err));
    }, sixHours);
    setTimeout(() => {
      this.purgeExpired().catch((err) => this.logger.error(err?.message || err));
    }, 15000);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async purgeExpired(): Promise<void> {
    const flag = String(this.config.get('ACCOUNT_DELETION_ENABLED', 'true')).toLowerCase();
    if (flag === 'false' || flag === '0' || flag === 'off') return;
    if (this.running) return;
    this.running = true;
    try {
      const ids = await this.usersService.listExpiredDeletions(50);
      for (const id of ids) {
        const purged = await this.usersService.anonymizeExpiredUser(id);
        if (!purged) continue;
        try {
          await this.auditLogs.save(
            this.auditLogs.create({
              userId: purged.id,
              action: 'ACCOUNT_PERMANENTLY_DELETED',
              entity: 'users',
              entityId: purged.id,
              tenantId: purged.tenantId ?? undefined,
              description: purged.organizationDeleted
                ? 'Organization and its business records were permanently deleted after the recovery window.'
                : 'Personal data anonymized after the recovery window. The organization was kept.',
            }),
          );
        } catch (err: any) {
          this.logger.error(`Audit log failed for purged user ${purged.id}: ${err?.message || err}`);
        }
        this.logger.log(`Anonymized user ${purged.id} after the recovery window.`);
      }
    } finally {
      this.running = false;
    }
  }
}
