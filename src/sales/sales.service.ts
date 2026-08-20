import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Sale } from './sale.entity';
import { SalePayment } from './sale-payment.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { AccountingService } from '../modules/accounting/accounting.service';
import { TenantContextService } from '../tenants/tenant-context.service';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(SalePayment)
    private readonly salePaymentRepository: Repository<SalePayment>,
    private readonly accountingService: AccountingService,
    private readonly tenantContext: TenantContextService,
  ) { }

  private getTenantId(): string | null {
    return this.tenantContext.getTenantId();
  }

  private tenantWhere(extra: any): any {
    const tenantId = this.getTenantId();
    return tenantId ? { ...extra, tenantId } : extra;
  }

  private applyTenant(query: SelectQueryBuilder<Sale>): SelectQueryBuilder<Sale> {
    const tenantId = this.getTenantId();
    if (tenantId) query.andWhere('sale.tenantId = :tenantId', { tenantId });
    return query;
  }

  private calcAmounts(dto: {
    quantity?: string; unitPrice?: string;
    transportCharges?: string; loadingCharges?: string;
    commission?: string; otherCharges?: string;
    weightShortage?: string; mortalityDeduction?: string; otherDeduction?: string;
  }) {
    const totalAmount = parseFloat(dto.quantity || '0') * parseFloat(dto.unitPrice || '0');
    const transportCharges = parseFloat(dto.transportCharges || '0');
    const loadingCharges = parseFloat(dto.loadingCharges || '0');
    const commission = parseFloat(dto.commission || '0');
    const otherCharges = parseFloat(dto.otherCharges || '0');
    const weightShortage = parseFloat(dto.weightShortage || '0');
    const mortalityDeduction = parseFloat(dto.mortalityDeduction || '0');
    const otherDeduction = parseFloat(dto.otherDeduction || '0');
    const grossAmount = totalAmount + transportCharges + loadingCharges + commission + otherCharges;
    const netAmount = grossAmount - weightShortage - mortalityDeduction - otherDeduction;
    return { totalAmount, transportCharges, loadingCharges, commission, otherCharges, weightShortage, mortalityDeduction, otherDeduction, grossAmount, netAmount };
  }

  private async generateInvoiceNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `SL-${year}-${month}-`;

    // Find the last invoice number with this prefix
    const qb = this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.invoiceNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('sale.id', 'DESC')
      .limit(1);
    this.applyTenant(qb);
    const lastSale = await qb.getOne();

    if (lastSale && lastSale.invoiceNumber) {
      const lastNumber = parseInt(lastSale.invoiceNumber.split('-').pop() || '0');
      return `${prefix}${String(lastNumber + 1).padStart(4, '0')}`;
    }

    return `${prefix}0001`;
  }

  async generateNextInvoiceNumber(): Promise<string> {
    return this.generateInvoiceNumber();
  }

  async create(dto: CreateSaleDto): Promise<Sale> {
    // Auto-generate invoice number if not provided
    const invoiceNumber = dto.invoiceNumber || await this.generateInvoiceNumber();

    const existing = await this.saleRepository.findOne({ where: this.tenantWhere({ invoiceNumber }) });
    if (existing) throw new BadRequestException(`Sale ${invoiceNumber} already exists`);

    const amounts = this.calcAmounts(dto);
    const totalPaymentMade = (dto.payments || []).reduce((s, p) => s + parseFloat(p.amount || '0'), 0);

    const sale = this.saleRepository.create({
      invoiceNumber,
      saleNo: dto.saleNo,
      purchaseBillNo: dto.purchaseBillNo,
      cageNo: dto.cageNo,
      numberOfBirds: Number(dto.numberOfBirds ?? dto.totalBirds ?? 0) || 0,
      customerName: dto.customerName,
      saleDate: dto.saleDate,
      saleMode: dto.saleMode,
      productType: dto.productType,
      quantity: parseFloat(dto.quantity || '0'),
      unit: dto.unit,
      unitPrice: parseFloat(dto.unitPrice || '0'),
      ...amounts,
      paymentStatus: dto.paymentStatus || 'pending',
      amountReceived: totalPaymentMade || parseFloat(dto.amountReceived || '0'),
      notes: dto.notes,
      retailerId: dto.retailerId,
      tenantId: this.getTenantId() ?? undefined,
    });

    const savedResult = await this.saleRepository.save(sale);
    const savedId: string = (savedResult as any).id ?? (savedResult as any)[0]?.id;

    if (dto.payments && dto.payments.length > 0) {
      const payments = dto.payments
        .filter(p => parseFloat(p.amount || '0') > 0)
        .map(p => this.salePaymentRepository.create({ paymentMode: p.paymentMode, amount: parseFloat(p.amount), saleId: savedId, tenantId: this.getTenantId() ?? undefined }));
      if (payments.length > 0) await this.salePaymentRepository.save(payments);
    }

    const fullSale = await this.findOne(savedId);
    this.accountingService.syncSale(fullSale).catch((err) => {
      console.error('Failed to trigger accounting sync for sale:', err);
    });
    return fullSale;
  }

  private getBirdsCount(sale: Sale): number {
    const direct = Number(sale.numberOfBirds) || 0;
    if (direct > 0) return direct;
    // Older sales stored bird count inside notes JSON
    try {
      if (!sale.notes) return 0;
      const parsed = JSON.parse(sale.notes);
      return Number(parsed?.weightLoss?.totalBirds) || 0;
    } catch {
      return 0;
    }
  }

  async findAll(
    startDate?: string,
    endDate?: string,
    customer?: string,
    productType?: string,
    paymentStatus?: string,
    retailerId?: string,
    page?: number,
    limit?: number,
  ): Promise<any> {
    const query = this.saleRepository.createQueryBuilder('sale')
      .leftJoinAndSelect('sale.retailer', 'retailer')
      .leftJoinAndSelect('sale.payments', 'payments')
      .orderBy('sale.saleDate', 'DESC');

    this.applyTenant(query);

    if (startDate && endDate) query.andWhere('sale.saleDate BETWEEN :startDate AND :endDate', { startDate, endDate });
    if (customer) {
      const q = `%${customer.trim()}%`;
      query.andWhere(
        '(sale.customerName ILIKE :q OR sale.invoiceNumber ILIKE :q OR sale.saleNo ILIKE :q)',
        { q },
      );
    }
    if (productType) query.andWhere('sale.productType = :productType', { productType });
    if (paymentStatus) query.andWhere('sale.paymentStatus = :paymentStatus', { paymentStatus });
    if (retailerId) query.andWhere('sale.retailerId = :retailerId', { retailerId });

    if (page && limit) {
      const take = limit;
      const skip = (page - 1) * limit;
      const [data, total] = await query
        .skip(skip)
        .take(take)
        .getManyAndCount();

      // For summary stats, build a fresh query without skip/take so totals reflect
      // the entire filtered result (not just the current page)
      const summaryQuery = this.saleRepository.createQueryBuilder('sale')
        .leftJoinAndSelect('sale.retailer', 'retailer')
        .leftJoinAndSelect('sale.payments', 'payments')
        .orderBy('sale.saleDate', 'DESC');

      this.applyTenant(summaryQuery);

      if (startDate && endDate) summaryQuery.andWhere('sale.saleDate BETWEEN :startDate AND :endDate', { startDate, endDate });
      if (customer) {
        const q = `%${customer.trim()}%`;
        summaryQuery.andWhere(
          '(sale.customerName ILIKE :q OR sale.invoiceNumber ILIKE :q OR sale.saleNo ILIKE :q)',
          { q },
        );
      }
      if (productType) summaryQuery.andWhere('sale.productType = :productType', { productType });
      if (paymentStatus) summaryQuery.andWhere('sale.paymentStatus = :paymentStatus', { paymentStatus });
      if (retailerId) summaryQuery.andWhere('sale.retailerId = :retailerId', { retailerId });

      const allFiltered = await summaryQuery.getMany();
      const summary = {
        totalBirds: allFiltered.reduce((s, x) => s + this.getBirdsCount(x), 0),
        totalWeight: allFiltered.reduce((s, x) => s + Number(x.quantity || 0), 0),
        totalRevenue: allFiltered.reduce((s, x) => s + Number(x.netAmount || x.totalAmount || 0), 0),
        totalReceived: allFiltered.reduce((s, x) => s + Number(x.amountReceived || 0), 0),
        totalPending: allFiltered.reduce((s, x) => s + Math.max(0, Number(x.netAmount || x.totalAmount || 0) - Number(x.amountReceived || 0)), 0),
      };

      return { data, total, page, limit, summary };
    }

    return query.getMany();
  }

  async getInvoiceList(): Promise<Array<{ id: string; invoiceNumber: string; saleDate: string; customerName: string }>> {
    const qb = this.saleRepository
      .createQueryBuilder('sale')
      .select(['sale.id', 'sale.invoiceNumber', 'sale.saleDate', 'sale.customerName'])
      .orderBy('sale.saleDate', 'DESC')
      .limit(100);
    this.applyTenant(qb);
    const sales = await qb.getMany();
    return sales.map(s => ({ id: s.id, invoiceNumber: s.invoiceNumber, saleDate: s.saleDate, customerName: s.customerName }));
  }

  async findOne(id: string): Promise<Sale> {
    const sale = await this.saleRepository.findOne({ where: this.tenantWhere({ id }), relations: ['retailer', 'payments'] });
    if (!sale) throw new NotFoundException(`Sale ${id} not found`);
    return sale;
  }

  async update(id: string, dto: UpdateSaleDto): Promise<Sale> {
    const sale = await this.findOne(id);

    if (dto.invoiceNumber && dto.invoiceNumber !== sale.invoiceNumber) {
      const existing = await this.saleRepository.findOne({ where: this.tenantWhere({ invoiceNumber: dto.invoiceNumber }) });
      if (existing) throw new BadRequestException(`Sale ${dto.invoiceNumber} already exists`);
    }

    const quantity = dto.quantity ? parseFloat(dto.quantity) : sale.quantity;
    const unitPrice = dto.unitPrice ? parseFloat(dto.unitPrice) : sale.unitPrice;
    const amounts = this.calcAmounts({
      quantity: String(quantity), unitPrice: String(unitPrice),
      transportCharges: dto.transportCharges ?? String(sale.transportCharges),
      loadingCharges: dto.loadingCharges ?? String(sale.loadingCharges),
      commission: dto.commission ?? String(sale.commission),
      otherCharges: dto.otherCharges ?? String(sale.otherCharges),
      weightShortage: dto.weightShortage ?? String(sale.weightShortage),
      mortalityDeduction: dto.mortalityDeduction ?? String(sale.mortalityDeduction),
      otherDeduction: dto.otherDeduction ?? String(sale.otherDeduction),
    });

    if (dto.payments !== undefined) {
      await this.salePaymentRepository.delete({ saleId: id });
      const validPayments = dto.payments.filter(p => parseFloat(p.amount || '0') > 0);
      if (validPayments.length > 0) {
        const payments = validPayments.map(p => this.salePaymentRepository.create({ paymentMode: p.paymentMode, amount: parseFloat(p.amount), saleId: id, tenantId: this.getTenantId() ?? undefined }));
        await this.salePaymentRepository.save(payments);
      }
    }

    const totalPaymentMade = dto.payments !== undefined
      ? dto.payments.reduce((s, p) => s + parseFloat(p.amount || '0'), 0)
      : sale.amountReceived;

    Object.assign(sale, {
      invoiceNumber: dto.invoiceNumber ?? sale.invoiceNumber,
      saleNo: dto.saleNo ?? sale.saleNo,
      purchaseBillNo: dto.purchaseBillNo ?? sale.purchaseBillNo,
      cageNo: dto.cageNo ?? sale.cageNo,
      numberOfBirds:
        dto.numberOfBirds !== undefined || dto.totalBirds !== undefined
          ? Number(dto.numberOfBirds ?? dto.totalBirds ?? 0) || 0
          : sale.numberOfBirds,
      customerName: dto.customerName ?? sale.customerName,
      saleDate: dto.saleDate ?? sale.saleDate,
      saleMode: dto.saleMode ?? sale.saleMode,
      productType: dto.productType ?? sale.productType,
      quantity, unitPrice, ...amounts,
      unit: dto.unit ?? sale.unit,
      paymentStatus: dto.paymentStatus ?? sale.paymentStatus,
      amountReceived: totalPaymentMade,
      notes: dto.notes ?? sale.notes,
      retailerId: dto.retailerId ?? sale.retailerId,
      updatedAt: new Date(),
    });

    // Use update() instead of save() to avoid cascade FK issue with sale_payments
    await this.saleRepository.update(id, {
      invoiceNumber: sale.invoiceNumber,
      saleNo: sale.saleNo,
      purchaseBillNo: sale.purchaseBillNo,
      cageNo: sale.cageNo,
      numberOfBirds: sale.numberOfBirds,
      customerName: sale.customerName,
      saleDate: sale.saleDate,
      saleMode: sale.saleMode,
      productType: sale.productType,
      quantity: sale.quantity,
      unitPrice: sale.unitPrice,
      totalAmount: sale.totalAmount,
      transportCharges: sale.transportCharges,
      loadingCharges: sale.loadingCharges,
      commission: sale.commission,
      otherCharges: sale.otherCharges,
      weightShortage: sale.weightShortage,
      mortalityDeduction: sale.mortalityDeduction,
      otherDeduction: sale.otherDeduction,
      grossAmount: sale.grossAmount,
      netAmount: sale.netAmount,
      unit: sale.unit,
      paymentStatus: sale.paymentStatus,
      amountReceived: sale.amountReceived,
      notes: sale.notes,
      retailerId: sale.retailerId,
      updatedAt: sale.updatedAt,
    });
    const updatedSale = await this.findOne(id);
    this.accountingService.syncSale(updatedSale).catch((err) => {
      console.error('Failed to trigger accounting sync for sale update:', err);
    });
    return updatedSale;
  }

  async remove(id: string): Promise<void> {
    const sale = await this.findOne(id);
    await this.saleRepository.remove(sale);
  }

  async updateAttachment(id: string, fileUrl: string): Promise<Sale> {
    const sale = await this.findOne(id);
    (sale as any).saleAttachment = fileUrl;
    sale.updatedAt = new Date();
    return this.saleRepository.save(sale);
  }

  async updatePaymentStatus(id: string, paymentStatus: 'paid' | 'pending' | 'partial', amountReceived?: number): Promise<Sale> {
    const sale = await this.findOne(id);
    sale.paymentStatus = paymentStatus;
    if (amountReceived !== undefined) sale.amountReceived = amountReceived;
    sale.updatedAt = new Date();
    const saved = await this.saleRepository.save(sale);
    this.accountingService.syncSale(saved).catch((err) => {
      console.error('Failed to trigger accounting sync for sale payment status update:', err);
    });
    return saved;
  }
}
