import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, SelectQueryBuilder } from 'typeorm';
import { PaymentVoucher } from './payment-voucher.entity';
import { CreatePaymentVoucherDto } from './dto/create-payment-voucher.dto';
import { UpdatePaymentVoucherDto } from './dto/update-payment-voucher.dto';
import { BillingService } from '../billing/billing.service';
import { AccountingService } from '../modules/accounting/accounting.service';
import { RetailersService } from '../retailers/retailers.service';
import { FarmersService } from '../farmers/farmers.service';
import { TenantContextService } from '../tenants/tenant-context.service';

@Injectable()
export class PaymentVouchersService {
  constructor(
    @InjectRepository(PaymentVoucher)
    private paymentVoucherRepository: Repository<PaymentVoucher>,
    private billingService: BillingService,
    private accountingService: AccountingService,
    private retailersService: RetailersService,
    private farmersService: FarmersService,
    private readonly tenantContext: TenantContextService,
  ) { }

  private getTenantId(): string | null {
    return this.tenantContext.getTenantId();
  }

  private tenantWhere(extra: any): any {
    const tenantId = this.getTenantId();
    return tenantId ? { ...extra, tenantId } : extra;
  }

  private applyTenant(query: SelectQueryBuilder<PaymentVoucher>): SelectQueryBuilder<PaymentVoucher> {
    const tenantId = this.getTenantId();
    if (tenantId) query.andWhere('voucher.tenantId = :tenantId', { tenantId });
    return query;
  }

  async create(createDto: CreatePaymentVoucherDto, userId: number): Promise<PaymentVoucher> {
    // Validate payeeId and payeeType
    if (createDto.payeeType === 'retailer') {
      if (!createDto.payeeId) {
        throw new BadRequestException('payeeId is required for retailer payee type');
      }
      const retailer = await this.retailersService.findOne(String(createDto.payeeId));
      createDto.payeeName = retailer.name; // Keep name synced
    } else if (createDto.payeeType === 'farmer') {
      if (!createDto.payeeId) {
        throw new BadRequestException('payeeId is required for farmer payee type');
      }
      const farmer = await this.farmersService.findOne(String(createDto.payeeId));
      createDto.payeeName = farmer.name; // Keep name synced
    }

    // Generate voucher number
    const voucherNumber = await this.generateVoucherNumber();

    const voucher = this.paymentVoucherRepository.create({
      ...createDto,
      voucherNumber,
      createdById: userId,
      tenantId: this.getTenantId() ?? undefined,
    });

    const savedVoucher = await this.paymentVoucherRepository.save(voucher);
    if (savedVoucher.status === 'paid') {
      await this.integrateWithLedger(savedVoucher);
    }
    return savedVoucher;
  }

  async findAll(filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    payeeType?: string;
    voucherType?: string;
  }): Promise<PaymentVoucher[]> {
    const query = this.paymentVoucherRepository.createQueryBuilder('voucher')
      .leftJoinAndSelect('voucher.createdBy', 'createdBy')
      .leftJoinAndSelect('voucher.approvedBy', 'approvedBy')
      .orderBy('voucher.voucherDate', 'DESC')
      .addOrderBy('voucher.id', 'DESC');

    this.applyTenant(query);

    if (filters?.startDate && filters?.endDate) {
      query.andWhere('voucher.voucherDate BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    if (filters?.status) {
      query.andWhere('voucher.status = :status', { status: filters.status });
    }

    if (filters?.payeeType) {
      query.andWhere('voucher.payeeType = :payeeType', { payeeType: filters.payeeType });
    }

    if (filters?.voucherType) {
      query.andWhere('voucher.voucherType = :voucherType', { voucherType: filters.voucherType });
    }

    return await query.getMany();
  }

  async findOne(id: number): Promise<PaymentVoucher> {
    const voucher = await this.paymentVoucherRepository.findOne({
      where: this.tenantWhere({ id }),
      relations: ['createdBy', 'approvedBy'],
    });

    if (!voucher) {
      throw new NotFoundException(`Payment voucher with ID ${id} not found`);
    }

    return voucher;
  }

  async update(id: number, updateDto: UpdatePaymentVoucherDto): Promise<PaymentVoucher> {
    const voucher = await this.findOne(id);

    // Check type if updated or use existing
    const payeeType = updateDto.payeeType || voucher.payeeType;
    const payeeId = updateDto.payeeId || voucher.payeeId;

    if (payeeType === 'retailer') {
      if (!payeeId) {
        throw new BadRequestException('payeeId is required for retailer payee type');
      }
      const retailer = await this.retailersService.findOne(String(payeeId));
      updateDto.payeeName = retailer.name;
    } else if (payeeType === 'farmer') {
      if (!payeeId) {
        throw new BadRequestException('payeeId is required for farmer payee type');
      }
      const farmer = await this.farmersService.findOne(String(payeeId));
      updateDto.payeeName = farmer.name;
    }

    Object.assign(voucher, updateDto);
    const saved = await this.paymentVoucherRepository.save(voucher);
    if (saved.status === 'paid') {
      await this.integrateWithLedger(saved);
    }
    return saved;
  }

  async remove(id: number): Promise<void> {
    const voucher = await this.findOne(id);
    await this.paymentVoucherRepository.remove(voucher);
  }

  async approve(id: number, userId: number): Promise<PaymentVoucher> {
    const voucher = await this.findOne(id);
    voucher.approvedById = userId;
    voucher.approvedDate = new Date();
    voucher.status = 'paid';
    if (!voucher.paidDate) {
      voucher.paidDate = new Date();
    }
    const savedApprove = await this.paymentVoucherRepository.save(voucher);
    await this.integrateWithLedger(savedApprove);
    return savedApprove;
  }

  async cancel(id: number): Promise<PaymentVoucher> {
    const voucher = await this.findOne(id);
    voucher.status = 'cancelled';
    return await this.paymentVoucherRepository.save(voucher);
  }

  async getStats(startDate?: string, endDate?: string): Promise<any> {
    const query = this.paymentVoucherRepository.createQueryBuilder('voucher');

    this.applyTenant(query);

    if (startDate && endDate) {
      query.andWhere('voucher.voucherDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const [total, pending, paid, cancelled] = await Promise.all([
      query.getCount(),
      query.clone().andWhere('voucher.status = :status', { status: 'pending' }).getCount(),
      query.clone().andWhere('voucher.status = :status', { status: 'paid' }).getCount(),
      query.clone().andWhere('voucher.status = :status', { status: 'cancelled' }).getCount(),
    ]);

    const totalAmount = await query
      .select('SUM(voucher.amount)', 'total')
      .getRawOne();

    const paidAmount = await query
      .clone()
      .andWhere('voucher.status = :status', { status: 'paid' })
      .select('SUM(voucher.amount)', 'total')
      .getRawOne();

    return {
      total,
      pending,
      paid,
      cancelled,
      totalAmount: parseFloat(totalAmount?.total || '0'),
      paidAmount: parseFloat(paidAmount?.total || '0'),
      pendingAmount: parseFloat(totalAmount?.total || '0') - parseFloat(paidAmount?.total || '0'),
    };
  }

  private async generateVoucherNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    // Get the last voucher number for this month
    const qb = this.paymentVoucherRepository
      .createQueryBuilder('voucher')
      .where('voucher.voucherNumber LIKE :pattern', { pattern: `PV-${year}-${month}-%` })
      .orderBy('voucher.id', 'DESC');
    this.applyTenant(qb);
    const lastVoucher = await qb.getOne();

    let sequence = 1;
    if (lastVoucher) {
      const lastSequence = parseInt(lastVoucher.voucherNumber.split('-').pop() || '0');
      sequence = lastSequence + 1;
    }

    return `PV-${year}-${month}-${String(sequence).padStart(4, '0')}`;
  }

  private async integrateWithLedger(voucher: PaymentVoucher) {
    if (voucher.status !== 'paid') return;

    try {
      let payeeName = voucher.payeeName;

      if (voucher.payeeId) {
        if (voucher.payeeType === 'retailer') {
          const retailer = await this.retailersService.findOne(String(voucher.payeeId));
          if (retailer) {
            payeeName = retailer.name;
          }
        } else if (voucher.payeeType === 'farmer') {
          const farmer = await this.farmersService.findOne(String(voucher.payeeId));
          if (farmer) {
            payeeName = farmer.name;
          }
        }
      }

      // Find or create billing party for this payee
      const party = await this.billingService.findOrCreatePartyByName(
        payeeName,
        voucher.payeeType === 'retailer' ? 'Retailer' : 
        voucher.payeeType === 'farmer' ? 'Farm' : 'Trader'
      );

      // Payment Voucher integration type based on VOUCHER DIRECTION:
      // IN Voucher (money received from retailer): CREDIT - reduces their outstanding balance
      // OUT Voucher (money paid to farmer): DEBIT - reduces what we owe them
      // Use voucherType first, fall back to payeeType for backward compatibility
      let entryType: 'credit' | 'debit';
      if (voucher.voucherType) {
        entryType = voucher.voucherType === 'in' ? 'credit' : 'debit';
      } else {
        // Fallback: retailer payments are credits, farmer payments are debits
        entryType = voucher.payeeType === 'retailer' ? 'credit' : 'debit';
      }

      console.log(`📋 Voucher ${voucher.voucherNumber} - voucherType: "${voucher.voucherType}", payeeType: "${voucher.payeeType}", resolved entryType: "${entryType}"`);

      await this.billingService.recordVoucher(
        party.id,
        voucher.voucherNumber,
        Number(voucher.amount),
        new Date(voucher.voucherDate).toISOString().split('T')[0],
        entryType
      );
      console.log(`✅ Voucher ${voucher.voucherNumber} integrated as ${entryType.toUpperCase()} for party ${party.name} (ID: ${party.id}) - Amount: ₹${voucher.amount}`);
    } catch (error) {
      console.error('Failed to integrate voucher with ledger:', error);
    }

    this.accountingService.syncPayment(voucher).catch((err) => {
      console.error('Failed to trigger accounting sync for payment voucher:', err);
    });
  }
}

