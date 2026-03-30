import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from './sale.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
  ) {}

  async create(createSaleDto: CreateSaleDto): Promise<Sale> {
    // Check if invoice number already exists
    const existingSale = await this.saleRepository.findOne({
      where: { invoiceNumber: createSaleDto.invoiceNumber },
    });
    if (existingSale) {
      throw new BadRequestException(`Sale with invoice number ${createSaleDto.invoiceNumber} already exists`);
    }

    const totalAmount = parseFloat(createSaleDto.quantity || '0') * parseFloat(createSaleDto.unitPrice || '0');

    // Calculate charges
    const transportCharges = parseFloat(createSaleDto.transportCharges || '0');
    const loadingCharges = parseFloat(createSaleDto.loadingCharges || '0');
    const commission = parseFloat(createSaleDto.commission || '0');
    const otherCharges = parseFloat(createSaleDto.otherCharges || '0');

    // Calculate deductions
    const weightShortage = parseFloat(createSaleDto.weightShortage || '0');
    const mortalityDeduction = parseFloat(createSaleDto.mortalityDeduction || '0');
    const otherDeduction = parseFloat(createSaleDto.otherDeduction || '0');

    // Calculate gross and net amounts
    const grossAmount = totalAmount + transportCharges + loadingCharges + commission + otherCharges;
    const netAmount = grossAmount - weightShortage - mortalityDeduction - otherDeduction;

    const sale = this.saleRepository.create({
      invoiceNumber: createSaleDto.invoiceNumber,
      customerName: createSaleDto.customerName,
      saleDate: createSaleDto.saleDate,
      saleMode: createSaleDto.saleMode,
      productType: createSaleDto.productType,
      quantity: parseFloat(createSaleDto.quantity || '0'),
      unit: createSaleDto.unit,
      unitPrice: parseFloat(createSaleDto.unitPrice || '0'),
      totalAmount,
      transportCharges,
      loadingCharges,
      commission,
      otherCharges,
      weightShortage,
      mortalityDeduction,
      otherDeduction,
      grossAmount,
      netAmount,
      paymentStatus: createSaleDto.paymentStatus || 'pending',
      amountReceived: createSaleDto.amountReceived ? parseFloat(createSaleDto.amountReceived) : 0,
      notes: createSaleDto.notes,
      retailerId: createSaleDto.retailerId,
    });

    return this.saleRepository.save(sale);
  }

  async findAll(
    startDate?: string,
    endDate?: string,
    customer?: string,
    productType?: string,
    paymentStatus?: string,
  ): Promise<Sale[]> {
    const query = this.saleRepository.createQueryBuilder('sale')
      .leftJoinAndSelect('sale.retailer', 'retailer')
      .orderBy('sale.saleDate', 'DESC');

    if (startDate && endDate) {
      query.andWhere('sale.saleDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    if (customer) {
      query.andWhere('sale.customerName ILIKE :customer', {
        customer: `%${customer}%`,
      });
    }

    if (productType) {
      query.andWhere('sale.productType = :productType', { productType });
    }

    if (paymentStatus) {
      query.andWhere('sale.paymentStatus = :paymentStatus', { paymentStatus });
    }

    return query.getMany();
  }

  async getInvoiceList(): Promise<Array<{ id: string; invoiceNumber: string; saleDate: string; customerName: string }>> {
    const sales = await this.saleRepository
      .createQueryBuilder('sale')
      .select(['sale.id', 'sale.invoiceNumber', 'sale.saleDate', 'sale.customerName'])
      .orderBy('sale.saleDate', 'DESC')
      .limit(100)
      .getMany();

    return sales.map(sale => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate,
      customerName: sale.customerName,
    }));
  }

  async findOne(id: string): Promise<Sale> {
    const sale = await this.saleRepository.findOne({
      where: { id },
      relations: ['retailer'],
    });
    if (!sale) {
      throw new NotFoundException(`Sale with ID ${id} not found`);
    }
    return sale;
  }

  async update(id: string, updateSaleDto: UpdateSaleDto): Promise<Sale> {
    const sale = await this.findOne(id);

    // If invoice number is being updated, check for duplicates
    if (updateSaleDto.invoiceNumber && updateSaleDto.invoiceNumber !== sale.invoiceNumber) {
      const existingSale = await this.saleRepository.findOne({
        where: { invoiceNumber: updateSaleDto.invoiceNumber },
      });
      if (existingSale) {
        throw new BadRequestException(`Sale with invoice number ${updateSaleDto.invoiceNumber} already exists`);
      }
    }

    // Calculate total amount if quantity or unit price changed
    let totalAmount = sale.totalAmount;
    const quantity = updateSaleDto.quantity ? parseFloat(updateSaleDto.quantity) : sale.quantity;
    const unitPrice = updateSaleDto.unitPrice ? parseFloat(updateSaleDto.unitPrice) : sale.unitPrice;
    totalAmount = quantity * unitPrice;

    // Calculate charges
    const transportCharges = updateSaleDto.transportCharges 
      ? parseFloat(updateSaleDto.transportCharges) 
      : sale.transportCharges;
    const loadingCharges = updateSaleDto.loadingCharges 
      ? parseFloat(updateSaleDto.loadingCharges) 
      : sale.loadingCharges;
    const commission = updateSaleDto.commission 
      ? parseFloat(updateSaleDto.commission) 
      : sale.commission;
    const otherCharges = updateSaleDto.otherCharges 
      ? parseFloat(updateSaleDto.otherCharges) 
      : sale.otherCharges;

    // Calculate deductions
    const weightShortage = updateSaleDto.weightShortage 
      ? parseFloat(updateSaleDto.weightShortage) 
      : sale.weightShortage;
    const mortalityDeduction = updateSaleDto.mortalityDeduction 
      ? parseFloat(updateSaleDto.mortalityDeduction) 
      : sale.mortalityDeduction;
    const otherDeduction = updateSaleDto.otherDeduction 
      ? parseFloat(updateSaleDto.otherDeduction) 
      : sale.otherDeduction;

    // Calculate gross and net amounts
    const grossAmount = totalAmount + transportCharges + loadingCharges + commission + otherCharges;
    const netAmount = grossAmount - weightShortage - mortalityDeduction - otherDeduction;

    const updateData: any = {
      invoiceNumber: updateSaleDto.invoiceNumber || sale.invoiceNumber,
      customerName: updateSaleDto.customerName || sale.customerName,
      saleDate: updateSaleDto.saleDate || sale.saleDate,
      saleMode: updateSaleDto.saleMode || sale.saleMode,
      productType: updateSaleDto.productType || sale.productType,
      quantity,
      unit: updateSaleDto.unit || sale.unit,
      unitPrice,
      totalAmount,
      transportCharges,
      loadingCharges,
      commission,
      otherCharges,
      weightShortage,
      mortalityDeduction,
      otherDeduction,
      grossAmount,
      netAmount,
      paymentStatus: updateSaleDto.paymentStatus || sale.paymentStatus,
      amountReceived: updateSaleDto.amountReceived ? parseFloat(updateSaleDto.amountReceived) : sale.amountReceived,
      notes: updateSaleDto.notes || sale.notes,
      retailerId: updateSaleDto.retailerId || sale.retailerId,
    };

    Object.assign(sale, updateData);
    sale.updatedAt = new Date();
    return this.saleRepository.save(sale);
  }

  async remove(id: string): Promise<void> {
    const sale = await this.findOne(id);
    await this.saleRepository.remove(sale);
  }

  async updatePaymentStatus(id: string, paymentStatus: 'paid' | 'pending' | 'partial', amountReceived?: number): Promise<Sale> {
    const sale = await this.findOne(id);
    sale.paymentStatus = paymentStatus;
    if (amountReceived !== undefined) {
      sale.amountReceived = amountReceived;
    }
    sale.updatedAt = new Date();
    return this.saleRepository.save(sale);
  }
}