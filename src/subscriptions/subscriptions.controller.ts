import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSubscriptionOrderDto } from './dto/create-subscription-order.dto';
import { VerifySubscriptionPaymentDto } from './dto/verify-subscription-payment.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Request() req: any) {
    return this.subscriptionsService.getMe(req.user?.tenantId);
  }

  @Post('create-order')
  @UseGuards(JwtAuthGuard)
  createOrder(@Request() req: any, @Body() body: CreateSubscriptionOrderDto) {
    return this.subscriptionsService.createOrder(
      req.user?.tenantId,
      body.plan,
      body.billingPeriod,
    );
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  verify(@Request() req: any, @Body() body: VerifySubscriptionPaymentDto) {
    return this.subscriptionsService.verifyCheckoutPayment(
      req.user?.tenantId,
      body.razorpay_order_id,
      body.razorpay_payment_id,
      body.razorpay_signature,
    );
  }

  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('x-razorpay-signature') signature: string | undefined,
  ) {
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
    return this.subscriptionsService.handleWebhook(rawBody, signature);
  }
}
