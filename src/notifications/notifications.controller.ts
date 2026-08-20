import { Controller, Post, Get, Query, Body, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CommunicationLog } from './communication-log.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('logs')
  async getLogs(@Query('limit') limit?: number): Promise<CommunicationLog[]> {
    return this.notificationsService.getLogs(limit ? Number(limit) : 50);
  }

  @Get('counts')
  async getCounts(): Promise<{ emailCount: number; smsCount: number }> {
    return this.notificationsService.getCounts();
  }

  @Post('test-email')
  async testEmail(@Body() body: { email: string }): Promise<{ success: boolean; message: string }> {
    if (!body.email) {
      throw new HttpException('Email target is required', HttpStatus.BAD_REQUEST);
    }
    const success = await this.notificationsService.sendEmail(
      body.email,
      '🔗 AWS SES Test Notification - Aziz Poultry Farm',
      `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 600px;">
        <h2 style="color: #4f46e5;">AWS SES Verification Successful!</h2>
        <p>This is a real-time transactional test email dispatched from your <strong>Aziz Poultry Farm Management System</strong>.</p>
        <p>Your AWS SES service is fully configured and ready for production invoices and system alerts.</p>
        <br />
        <hr style="border: 0; border-top: 1px solid #eee;" />
        <p style="font-size: 11px; color: #666;">Generated on ${new Date().toLocaleString()}</p>
      </div>
      `,
      'test',
    );

    if (success) {
      return { success: true, message: 'Test email successfully dispatched via AWS SES!' };
    } else {
      throw new HttpException('Failed to send email. Check AWS SES configuration or logs.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('test-sms')
  async testSMS(@Body() body: { phone: string }): Promise<{ success: boolean; message: string }> {
    if (!body.phone) {
      throw new HttpException('Phone number is required', HttpStatus.BAD_REQUEST);
    }
    const success = await this.notificationsService.sendSMS(
      body.phone,
      `AWS SNS Test Alert: Your SMS notifications are 100% operational! - Aziz Poultry Farm`,
      'test',
    );

    if (success) {
      return { success: true, message: 'Test SMS successfully dispatched via AWS SNS!' };
    } else {
      throw new HttpException('Failed to send SMS. Check AWS SNS configuration or logs.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
