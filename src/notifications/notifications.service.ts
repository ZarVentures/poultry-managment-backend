import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { CommunicationLog } from './communication-log.entity';
import { TenantContextService } from '../tenants/tenant-context.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private sesClient: SESClient | null = null;
  private snsClient: SNSClient | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(CommunicationLog)
    private readonly logRepository: Repository<CommunicationLog>,
    private readonly tenantContext: TenantContextService,
  ) {
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';

    if (accessKeyId && secretAccessKey) {
      const credentials = { accessKeyId, secretAccessKey };
      this.sesClient = new SESClient({ region, credentials });
      this.snsClient = new SNSClient({ region, credentials });
      this.logger.log('AWS Communication clients initialized successfully from secure environment.');
    } else {
      this.logger.warn('AWS Credentials are missing in secure backend environment variables (.env).');
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    htmlContent: string,
    messageType: string = 'test',
  ): Promise<boolean> {
    const senderEmail = this.configService.get<string>('SES_SENDER_EMAIL');
    if (!this.sesClient || !senderEmail) {
      this.logger.error('Cannot send email: AWS SES is not configured in backend env variables.');
      await this.saveLog(to, 'email', messageType, htmlContent.substring(0, 500), 'failed', 'AWS SES credentials or Sender Email missing in backend.');
      return false;
    }

    try {
      const command = new SendEmailCommand({
        Source: senderEmail,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject },
          Body: { Html: { Data: htmlContent } },
        },
      });

      await this.sesClient.send(command);
      this.logger.log(`Email sent successfully to ${to}`);
      await this.saveLog(to, 'email', messageType, htmlContent.substring(0, 500), 'sent');
      return true;
    } catch (error) {
      const errMsg = error.stack || error.message;
      this.logger.error(`Failed to send email to ${to}:`, errMsg);
      await this.saveLog(to, 'email', messageType, htmlContent.substring(0, 500), 'failed', errMsg);
      return false;
    }
  }

  async sendSMS(
    phoneNumber: string,
    message: string,
    messageType: string = 'test',
  ): Promise<boolean> {
    if (!this.snsClient) {
      this.logger.error('Cannot send SMS: AWS SNS is not configured in backend env variables.');
      await this.saveLog(phoneNumber, 'sms', messageType, message, 'failed', 'AWS SNS credentials missing in backend.');
      return false;
    }

    try {
      let formattedPhone = phoneNumber.trim();
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      const command = new PublishCommand({
        PhoneNumber: formattedPhone,
        Message: message,
      });

      await this.snsClient.send(command);
      this.logger.log(`SMS sent successfully to ${formattedPhone}`);
      await this.saveLog(formattedPhone, 'sms', messageType, message, 'sent');
      return true;
    } catch (error) {
      const errMsg = error.stack || error.message;
      this.logger.error(`Failed to send SMS to ${phoneNumber}:`, errMsg);
      await this.saveLog(phoneNumber, 'sms', messageType, message, 'failed', errMsg);
      return false;
    }
  }

  private async saveLog(
    recipient: string,
    channel: 'email' | 'sms',
    messageType: string,
    contentPreview: string,
    status: 'sent' | 'failed',
    errorMessage?: string,
  ): Promise<void> {
    try {
      const log = this.logRepository.create({
        recipient,
        channel,
        messageType,
        contentPreview,
        status,
        errorMessage,
        tenantId: this.tenantContext.getTenantId() ?? undefined,
      });
      await this.logRepository.save(log);
    } catch (err) {
      this.logger.error('Failed to write database communication log:', err.stack || err.message);
    }
  }

  async getLogs(limit: number = 50): Promise<CommunicationLog[]> {
    const tenantId = this.tenantContext.getTenantId();
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    return this.logRepository.find({
      where,
      order: { sentAt: 'DESC' },
      take: limit,
    });
  }

  async getCounts(): Promise<{ emailCount: number; smsCount: number }> {
    const tenantId = this.tenantContext.getTenantId();
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    const emailCount = await this.logRepository.count({ where: { channel: 'email', status: 'sent', ...where } });
    const smsCount = await this.logRepository.count({ where: { channel: 'sms', status: 'sent', ...where } });
    return { emailCount, smsCount };
  }
}
