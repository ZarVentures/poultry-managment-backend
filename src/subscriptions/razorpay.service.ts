import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';

@Injectable()
export class RazorpayService {
  private readonly client: Razorpay | null;
  readonly keyId: string;

  constructor(private readonly config: ConfigService) {
    this.keyId = this.config.get<string>('RAZORPAY_KEY_ID', '').trim();
    const secret = this.config.get<string>('RAZORPAY_KEY_SECRET', '').trim();
    this.client =
      this.keyId && secret
        ? new Razorpay({ key_id: this.keyId, key_secret: secret })
        : null;
  }

  private requireClient(): Razorpay {
    if (!this.client) {
      throw new ServiceUnavailableException('Razorpay is not configured');
    }
    return this.client;
  }

  async createOrder(params: {
    amountPaise: number;
    currency: string;
    receipt: string;
    notes: Record<string, string>;
  }) {
    try {
      return await this.requireClient().orders.create({
        amount: params.amountPaise,
        currency: params.currency,
        receipt: params.receipt,
        notes: params.notes,
      });
    } catch (err: any) {
      const description =
        err?.error?.description || err?.message || 'Razorpay order creation failed';
      const status = Number(err?.statusCode);
      if (status === 401) {
        throw new BadRequestException(
          'Razorpay authentication failed. Copy Key ID and Key Secret together from Razorpay Dashboard → Account & Settings → API Keys (Test mode).',
        );
      }
      throw new BadRequestException(description);
    }
  }

  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const secret = this.config.get<string>('RAZORPAY_KEY_SECRET', '').trim();
    if (!secret || !signature) return false;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return this.safeEqual(expected, signature);
  }

  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET', '').trim();
    if (!secret || !signature) return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return this.safeEqual(expected, signature);
  }

  private safeEqual(expected: string, received: string): boolean {
    const a = Buffer.from(expected);
    const b = Buffer.from(received);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
}
