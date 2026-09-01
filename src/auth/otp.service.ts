import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { OtpSession } from './otp.entity';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRepository(OtpSession)
    private readonly otpRepository: Repository<OtpSession>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generates a 6-digit OTP, stores its hash, and enforces a 60-second cooldown.
   */
  async generateSecureOtp(phoneNumber: string): Promise<string> {
    const existingSession = await this.otpRepository.findOne({
      where: { phoneNumber },
      order: { createdAt: 'DESC' },
    });

    if (existingSession) {
      const timeSinceLastRequest = Date.now() - existingSession.lastRequestedAt.getTime();
      const cooldownMs = 60 * 1000; // 60 seconds

      if (timeSinceLastRequest < cooldownMs) {
        const waitTime = Math.ceil((cooldownMs - timeSinceLastRequest) / 1000);
        throw new BadRequestException(`Please wait ${waitTime} seconds before requesting a new OTP.`);
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    if (existingSession && !existingSession.isUsed && existingSession.expiresAt > new Date()) {
      // If we have an active session, update it to avoid spamming the database
      existingSession.otpHash = otpHash;
      existingSession.expiresAt = expiresAt;
      existingSession.lastRequestedAt = new Date();
      existingSession.attempts = 0;
      await this.otpRepository.save(existingSession);
    } else {
      const newSession = this.otpRepository.create({
        phoneNumber,
        otpHash,
        expiresAt,
      });
      await this.otpRepository.save(newSession);
    }

    return otp;
  }

  /**
   * Abstracted method to send the OTP via SMS provider.
   */
  async sendOtpSms(phoneNumber: string, otp: string): Promise<void> {
    const provider = this.configService.get<string>('OTP_PROVIDER', 'dev');
    
    if (provider === 'dev') {
      // DEV MODE: Log the OTP to the console instead of sending real SMS
      this.logger.log(`\n=========================================\nDEV MODE: Mock SMS to ${phoneNumber}\nYour OTP is: ${otp}\n=========================================`);
      return;
    }

    // Production implementation would go here (Twilio, AWS SNS, Fast2SMS)
    const apiKey = this.configService.get<string>('SMS_API_KEY');
    const senderId = this.configService.get<string>('SMS_SENDER_ID');
    
    this.logger.log(`Sending real SMS to ${phoneNumber} using provider: ${provider}`);
    // Example: await this.awsSnsService.send(phoneNumber, `Your Poultry Management System OTP is: ${otp}`);
  }

  /**
   * Abstracted method to send the OTP via email provider.
   */
  async sendOtpEmail(email: string, otp: string): Promise<void> {
    const provider = this.configService.get<string>('OTP_PROVIDER', 'dev');

    if (provider === 'dev') {
      this.logger.log(
        `\n=========================================\nDEV MODE: Mock email to ${email}\nYour OTP is: ${otp}\n=========================================`,
      );
      return;
    }

    this.logger.log(`Sending OTP email to ${email} using provider: ${provider}`);
  }

  /**
   * Verifies the OTP, checks expiry, and increments attempts.
   */
  async verifyOtp(phoneNumber: string, otp: string): Promise<boolean> {
    const session = await this.otpRepository.findOne({
      where: { phoneNumber },
      order: { createdAt: 'DESC' },
    });

    if (!session) {
      throw new BadRequestException('No OTP request found for this phone number.');
    }

    if (session.isUsed) {
      throw new BadRequestException('This OTP has already been used.');
    }

    if (session.expiresAt < new Date()) {
      throw new BadRequestException('OTP has expired. Please request a new one.');
    }

    if (session.attempts >= 3) {
      throw new BadRequestException('Too many incorrect attempts. Please request a new OTP.');
    }

    const isMatch = await bcrypt.compare(otp, session.otpHash);

    if (!isMatch) {
      session.attempts += 1;
      await this.otpRepository.save(session);
      throw new BadRequestException(`Incorrect OTP. You have ${3 - session.attempts} attempts remaining.`);
    }

    // Mark as used
    session.isUsed = true;
    await this.otpRepository.save(session);

    return true;
  }
}
