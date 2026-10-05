import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { SubscriptionPayment } from './subscription-payment.entity';
import { RazorpayService } from './razorpay.service';
import {
  amountPaiseFor,
  BillingPeriod,
  isBillingPeriod,
  isPaidPlan,
  PaidPlanId,
  SAAS_PLAN_NAMES,
} from './plans';
import { addBillingPeriod, daysUntil, tenantCanAccessApp } from './subscription-access';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(SubscriptionPayment)
    private readonly paymentRepository: Repository<SubscriptionPayment>,
    private readonly razorpay: RazorpayService,
    private readonly dataSource: DataSource,
  ) {}

  async getMe(tenantId: string | null | undefined) {
    const tenant = await this.requireTenant(tenantId);
    const now = new Date();
    const canAccessApp = tenantCanAccessApp(tenant, now);
    const trialDaysLeft = daysUntil(tenant.trialEndsAt, now);
    const periodDaysLeft = daysUntil(tenant.currentPeriodEndsAt, now);

    return {
      tenantId: tenant.id,
      plan: tenant.plan ?? null,
      billingPeriod: tenant.billingPeriod ?? null,
      subscriptionStatus: tenant.subscriptionStatus ?? 'active',
      trialEndsAt: tenant.trialEndsAt ?? null,
      currentPeriodEndsAt: tenant.currentPeriodEndsAt ?? null,
      canAccessApp,
      daysLeft:
        tenant.subscriptionStatus === 'trial' ? trialDaysLeft : periodDaysLeft,
      plans: {
        starter: {
          name: SAAS_PLAN_NAMES.starter,
          monthlyPaise: amountPaiseFor('starter', 'monthly'),
          yearlyPaise: amountPaiseFor('starter', 'yearly'),
        },
        professional: {
          name: SAAS_PLAN_NAMES.professional,
          monthlyPaise: amountPaiseFor('professional', 'monthly'),
          yearlyPaise: amountPaiseFor('professional', 'yearly'),
        },
      },
    };
  }

  async createOrder(
    tenantId: string | null | undefined,
    plan: PaidPlanId,
    billingPeriod: BillingPeriod,
  ) {
    const tenant = await this.requireTenant(tenantId);
    const amountPaise = amountPaiseFor(plan, billingPeriod);
    const receipt = `t${tenant.id}-${Date.now()}`.slice(0, 40);

    const order = await this.razorpay.createOrder({
      amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        tenantId: String(tenant.id),
        plan,
        period: billingPeriod,
      },
    });

    const payment = this.paymentRepository.create({
      tenantId: String(tenant.id),
      plan,
      billingPeriod,
      amountPaise,
      currency: 'INR',
      razorpayOrderId: String(order.id),
      status: 'created',
      rawPayload: order as unknown as Record<string, unknown>,
    });
    await this.paymentRepository.save(payment);

    return {
      orderId: order.id,
      amount: amountPaise,
      currency: 'INR',
      keyId: this.razorpay.keyId,
      plan,
      billingPeriod,
      planName: SAAS_PLAN_NAMES[plan],
    };
  }

  async verifyCheckoutPayment(
    tenantId: string | null | undefined,
    orderId: string,
    paymentId: string,
    signature: string,
  ) {
    const tenant = await this.requireTenant(tenantId);
    if (!this.razorpay.verifyPaymentSignature(orderId, paymentId, signature)) {
      throw new BadRequestException('Invalid Razorpay payment signature');
    }

    const row = await this.paymentRepository.findOne({
      where: { razorpayOrderId: orderId },
    });
    if (!row || String(row.tenantId) !== String(tenant.id)) {
      throw new NotFoundException('Razorpay order not found for this business');
    }

    await this.capturePayment({
      orderId,
      paymentId,
      tenantId: String(tenant.id),
      plan: row.plan,
      billingPeriod: row.billingPeriod,
      payload: { orderId, paymentId, signature, source: 'verify' },
    });

    return this.getMe(tenant.id);
  }

  async handleWebhook(rawBody: string, signature: string | undefined) {
    if (!this.razorpay.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid Razorpay webhook signature');
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    const eventName = String(event?.event || '');
    const paymentEntity = event?.payload?.payment?.entity;

    if (eventName === 'payment.failed') {
      const orderId = paymentEntity?.order_id ? String(paymentEntity.order_id) : null;
      if (orderId) {
        await this.paymentRepository.update(
          { razorpayOrderId: orderId, status: 'created' },
          { status: 'failed', rawPayload: event },
        );
      }
      return { received: true };
    }

    if (eventName !== 'payment.captured') {
      return { received: true };
    }

    const orderId = paymentEntity?.order_id ? String(paymentEntity.order_id) : '';
    const paymentId = paymentEntity?.id ? String(paymentEntity.id) : '';
    if (!orderId || !paymentId) {
      return { received: true };
    }

    const row = await this.paymentRepository.findOne({
      where: { razorpayOrderId: orderId },
    });
    if (!row) {
      return { received: true };
    }

    await this.capturePayment({
      orderId,
      paymentId,
      tenantId: String(row.tenantId),
      plan: row.plan,
      billingPeriod: row.billingPeriod,
      payload: event,
    });

    return { received: true };
  }

  private async capturePayment(params: {
    orderId: string;
    paymentId: string;
    tenantId: string;
    plan: string;
    billingPeriod: string;
    payload: Record<string, unknown>;
  }) {
    if (!isPaidPlan(params.plan) || !isBillingPeriod(params.billingPeriod)) {
      throw new BadRequestException('Invalid plan on order');
    }
    const plan = params.plan;
    const billingPeriod = params.billingPeriod;

    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(SubscriptionPayment, {
        where: { razorpayPaymentId: params.paymentId },
      });
      if (existing && existing.status === 'captured') {
        return;
      }

      const orderRow = await manager.findOne(SubscriptionPayment, {
        where: { razorpayOrderId: params.orderId },
      });
      if (!orderRow) {
        throw new NotFoundException('Subscription order not found');
      }
      if (orderRow.status === 'captured') {
        return;
      }

      orderRow.razorpayPaymentId = params.paymentId;
      orderRow.status = 'captured';
      orderRow.rawPayload = params.payload;
      await manager.save(orderRow);

      const tenant = await manager.findOne(Tenant, { where: { id: params.tenantId } });
      if (!tenant) {
        throw new NotFoundException(`Tenant ${params.tenantId} not found`);
      }

      const now = new Date();
      const currentEnd = tenant.currentPeriodEndsAt
        ? new Date(tenant.currentPeriodEndsAt)
        : null;
      const base =
        currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;

      tenant.plan = plan;
      tenant.billingPeriod = billingPeriod;
      tenant.subscriptionStatus = 'active';
      tenant.currentPeriodEndsAt = addBillingPeriod(base, billingPeriod);
      await manager.save(tenant);
    });
  }

  private async requireTenant(tenantId: string | null | undefined): Promise<Tenant> {
    if (!tenantId) {
      throw new ForbiddenException('Create your business shop first');
    }
    const tenant = await this.tenantRepository.findOne({ where: { id: String(tenantId) } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }
    return tenant;
  }
}
