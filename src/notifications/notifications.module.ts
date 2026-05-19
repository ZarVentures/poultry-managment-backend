import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { SettingsModule } from '../settings/settings.module';
import { CommunicationLog } from './communication-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CommunicationLog]),
    SettingsModule
  ],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
