import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from './sale.entity';
import { SalePayment } from './sale-payment.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { CagesService } from '../cages/cages.service';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(SalePayment)
    private readonly salePaymentRepository: Repository<SalePayment>,
    private readonly cagesService: CagesService,
  ) { }

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
    const lastSale = await this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.invoiceNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('sale.id', 'DESC')
      .limit(1)
      .getOne();

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
    const { cages, ...dtoData } = dto as any;

    // Auto-generate invoice number if not provided
    const invoiceNumber = dtoData.invoiceNumber || await this.generateInvoiceNumber();

    const existing = await this.saleRepository.findOne({ where: { invoiceNumber } });
    if (existing) throw new BadRequestException(`Sale ${invoiceNumber} already exists`);

    const amounts = this.calcAmounts(dtoData);
    const totalPaymentMade = (dtoData.payments || []).reduce((s: number, p: any) => s + parseFloat(p.amount || '0'), 0);

    const sale = this.saleRepository.create({
      invoiceNumber,
      saleNo: dtoData.saleNo,
      purchaseBillNo: dtoData.purchaseBillNo,
      cageNo: dtoData.cageNo,
      customerName: dtoData.customerName,
      saleDate: dtoData.saleDate,
      saleMode: dtoData.saleMode,
      productType: dtoData.productType,
      quantity: parseFloat(dtoData.quantity || '0'),
      unit: dtoData.unit,
      unitPrice: parseFloat(dtoData.unitPrice || '0'),
      ...amounts,
      paymentStatus: dtoData.paymentStatus || 'pending',
      amountReceived: totalPaymentMade || parseFloat(dtoData.amountReceived || '0'),
      notes: dtoData.notes,
      retailerId: dtoData.retailerId,
    });

    const savedResult = await this.saleRepository.save(sale);
    const savedId: string = (savedResult as any).id ?? (savedResult as any)[0]?.id;

    // Process Cages
    if (cages && cages.length > 0) {
      for (const cage of cages) {
        await this.cagesService.partialVehicleSale(
          cage.cageId,
          savedId,
          Number(cage.soldBirds),
          Number(cage.soldWeight),
          Number(cage.weightLoss || 0),
        );
      }
    }

    if (dtoData.payments && dtoData.payments.length > 0) {
      const payments = dtoData.payments
        .filter((p: any) => parseFloat(p.amount || '0') > 0)
        .map((p: any) => this.salePaymentRepository.create({ paymentMode: p.paymentMode, amount: parseFloat(p.amount), saleId: savedId }));
      if (payments.length > 0) await this.salePaymentRepository.save(payments);
    }

    return this.findOne(savedId);
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

    if (startDate && endDate) query.andWhere('sale.saleDate BETWEEN :startDate AND :endDate', { startDate, endDate });
    if (customer) query.andWhere('sale.customerName ILIKE :customer', { customer: `%${customer}%` });
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

      // For summary stats, we need to run a separate count/sum on the same filtered query
      // but without skip/take
      const allFiltered = await query.getMany();
      const summary = {
        totalBirds: allFiltered.reduce((s, x) => s + Number(x.quantity || 0), 0),
        totalRevenue: allFiltered.reduce((s, x) => s + Number(x.netAmount || x.totalAmount || 0), 0),
        totalReceived: allFiltered.reduce((s, x) => s + Number(x.amountReceived || 0), 0),
        totalPending: allFiltered.reduce((s, x) => s + Math.max(0, Number(x.netAmount || x.totalAmount || 0) - Number(x.amountReceived || 0)), 0),
      };

      return { data, total, page, limit, summary };
    }

    return query.getMany();
  }

  async getInvoiceList(): Promise<Array<{ id: string; invoiceNumber: string; saleDate: string; customerName: string }>> {
    const sales = await this.saleRepository
      .createQueryBuilder('sale')
      .select(['sale.id', 'sale.invoiceNumber', 'sale.saleDate', 'sale.customerName'])
      .where('sale.saleMode = :saleMode', { saleMode: 'from_godown' })
      .orderBy('sale.saleDate', 'DESC')
      .limit(100)
      .getMany();
    return sales.map(s => ({ id: s.id, invoiceNumber: s.invoiceNumber, saleDate: s.saleDate, customerName: s.customerName }));
  }

  async findOne(id: string): Promise<Sale> {
    const sale = await this.saleRepository.findOne({ where: { id }, relations: ['retailer', 'payments'] });
    if (!sale) throw new NotFoundException(`Sale ${id} not found`);
    return sale;
  }

  async update(id: string, dto: UpdateSaleDto): Promise<Sale> {
    const { cages, ...dtoData } = dto as any;
    const sale = await this.findOne(id);

    if (dtoData.invoiceNumber && dtoData.invoiceNumber !== sale.invoiceNumber) {
      const existing = await this.saleRepository.findOne({ where: { invoiceNumber: dtoData.invoiceNumber } });
      if (existing) throw new BadRequestException(`Sale ${dtoData.invoiceNumber} already exists`);
    }

    // Process Cages
    if (cages !== undefined) {
      await this.cagesService.revertVehicleSaleCages(id);
      if (cages && cages.length > 0) {
        for (const cage of cages) {
          await this.cagesService.partialVehicleSale(
            cage.cageId,
            id,
            Number(cage.soldBirds),
            Number(cage.soldWeight),
            Number(cage.weightLoss || 0),
          );
        }
      }
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
        const payments = validPayments.map(p => this.salePaymentRepository.create({ paymentMode: p.paymentMode, amount: parseFloat(p.amount), saleId: id }));
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
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.cagesService.revertVehicleSaleCages(id);
    const sale = await this.findOne(id);
    await this.salePaymentRepository.delete({ saleId: id });
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
    return this.saleRepository.save(sale);
  }
}
