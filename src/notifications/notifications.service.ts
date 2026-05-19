import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly settingsService: SettingsService) {}

  private async getAwsClients(): Promise<{
    sesClient: SESClient | null;
    snsClient: SNSClient | null;
    senderEmail: string;
    emailEnabled: boolean;
    smsEnabled: boolean;
  }> {
    const settings = await this.settingsService.findAll();
    const map = new Map(settings.map(s => [s.key, s.value]));

    const accessKeyId = map.get('awsAccessKeyId') || '';
    const secretAccessKey = map.get('awsSecretAccessKey') || '';
    const region = map.get('awsRegion') || 'us-east-1';
    const senderEmail = map.get('sesSenderEmail') || '';
    const emailEnabled = map.get('emailEnabled') !== 'false';
    const smsEnabled = map.get('smsEnabled') !== 'false';

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn('AWS Credentials are not fully configured in settings.');
      return { sesClient: null, snsClient: null, senderEmail, emailEnabled, smsEnabled };
    }

    const credentials = { accessKeyId, secretAccessKey };

    const sesClient = new SESClient({ region, credentials });
    const snsClient = new SNSClient({ region, credentials });

    return { sesClient, snsClient, senderEmail, emailEnabled, smsEnabled };
  }

  async sendEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
    try {
      const { sesClient, senderEmail, emailEnabled } = await this.getAwsClients();
      if (!emailEnabled) {
        this.logger.log('Email notifications are globally disabled in settings.');
        return false;
      }
      if (!sesClient || !senderEmail) {
        this.logger.error('Cannot send email: AWS SES is not configured.');
        return false;
      }

      const command = new SendEmailCommand({
        Source: senderEmail,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject },
          Body: { Html: { Data: htmlContent } },
        },
      });

      await sesClient.send(command);
      this.logger.log(`Email sent successfully to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error.stack || error.message);
      return false;
    }
  }

  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const { snsClient, smsEnabled } = await this.getAwsClients();
      if (!smsEnabled) {
        this.logger.log('SMS notifications are globally disabled in settings.');
        return false;
      }
      if (!snsClient) {
        this.logger.error('Cannot send SMS: AWS SNS is not configured.');
        return false;
      }

      // Format phone number to E.164 if needed, e.g. ensuring '+' prefix
      let formattedPhone = phoneNumber.trim();
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      const command = new PublishCommand({
        PhoneNumber: formattedPhone,
        Message: message,
      });

      await snsClient.send(command);
      this.logger.log(`SMS sent successfully to ${formattedPhone}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${phoneNumber}:`, error.stack || error.message);
      return false;
    }
  }
}
