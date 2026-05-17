import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BirdReturn } from './entities/bird-return.entity';
import { Sale } from './sale.entity';
import { CreateBirdReturnDto } from './dto/create-bird-return.dto';
import { UpdateBirdReturnDto } from './dto/update-bird-return.dto';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class BirdReturnsService {
  constructor(
    @InjectRepository(BirdReturn)
    private readonly birdReturnRepository: Repository<BirdReturn>,
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    private readonly billingService: BillingService,
  ) {}

  private async generateReturnNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `RET-${year}-${month}-`;

    const lastReturn = await this.birdReturnRepository
      .createQueryBuilder('return')
      .where('return.returnNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('return.id', 'DESC')
      .limit(1)
      .getOne();

    if (lastReturn && lastReturn.returnNumber) {
      const lastNumber = parseInt(lastReturn.returnNumber.split('-').pop() || '0');
      return `${prefix}${String(lastNumber + 1).padStart(4, '0')}`;
    }

    return `${prefix}0001`;
  }

  async create(dto: CreateBirdReturnDto, createdBy?: string): Promise<BirdReturn> {
    // Verify sale exists
    const sale = await this.saleRepository.findOne({ 
      where: { id: dto.saleId },
      relations: ['retailer']
    });
    if (!sale) {
      throw new NotFoundException(`Sale ${dto.saleId} not found`);
    }

    // Validate number of birds returned doesn't exceed sale quantity
    const totalReturned = await this.getTotalBirdsReturnedForSale(dto.saleId);
    const saleQuantity = Number(sale.numberOfBirds || sale.quantity || 0);
    
    if (totalReturned + dto.numberOfBirdsReturned > saleQuantity) {
      throw new BadRequestException(
        `Cannot return ${dto.numberOfBirdsReturned} birds. Sale has ${saleQuantity} birds, ${totalReturned} already returned.`
      );
    }

    const returnNumber = await this.generateReturnNumber();

    const birdReturn = this.birdReturnRepository.create({
      returnNumber,
      returnDate: dto.returnDate,
      saleId: dto.saleId,
      customerName: dto.customerName,
      retailerId: dto.retailerId || sale.retailerId,
      numberOfBirdsReturned: dto.numberOfBirdsReturned,
      weightReturned: dto.weightReturned ? parseFloat(dto.weightReturned) : undefined,
      returnReason: dto.returnReason,
      reasonDescription: dto.reasonDescription,
      refundAmount: dto.refundAmount ? parseFloat(dto.refundAmount) : 0,
      adjustmentAmount: dto.adjustmentAmount ? parseFloat(dto.adjustmentAmount) : 0,
      status: dto.status || 'pending',
      returnedToInventory: dto.returnedToInventory || false,
      inventoryLocation: dto.inventoryLocation,
      notes: dto.notes,
    });

    const saved = await this.birdReturnRepository.save(birdReturn);

    // If auto-approved, process immediately
    if (saved.status === 'approved') {
      await this.processReturn(saved.id, createdBy);
    }

    return this.findOne(saved.id);
  }

  async findAll(
    startDate?: string,
    endDate?: string,
    saleId?: string,
    status?: string,
    customerId?: string,
    page?: number,
    limit?: number,
  ): Promise<any> {
    const query = this.birdReturnRepository
      .createQueryBuilder('return')
      .leftJoinAndSelect('return.sale', 'sale')
      .leftJoinAndSelect('return.retailer', 'retailer')
      .orderBy('return.returnDate', 'DESC');

    if (startDate && endDate) {
      query.andWhere('return.returnDate BETWEEN :startDate AND :endDate', { startDate, endDate });
    }
    if (saleId) {
      query.andWhere('return.saleId = :saleId', { saleId });
    }
    if (status) {
      query.andWhere('return.status = :status', { status });
    }
    if (customerId) {
      query.andWhere('return.customerName ILIKE :customer', { customer: `%${customerId}%` });
    }

    if (page && limit) {
      const skip = (page - 1) * limit;
      const [data, total] = await query.skip(skip).take(limit).getManyAndCount();

      const summary = {
        totalReturns: total,
        totalBirdsReturned: data.reduce((sum, r) => sum + r.numberOfBirdsReturned, 0),
        totalRefundAmount: data.reduce((sum, r) => sum + Number(r.refundAmount || 0), 0),
      };

      return { data, total, page, limit, summary };
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<BirdReturn> {
    const birdReturn = await this.birdReturnRepository.findOne({
      where: { id },
      relations: ['sale', 'retailer'],
    });
    if (!birdReturn) {
      throw new NotFoundException(`Bird return ${id} not found`);
    }
    return birdReturn;
  }

  async findBySaleId(saleId: string): Promise<BirdReturn[]> {
    return this.birdReturnRepository.find({
      where: { saleId },
      relations: ['sale', 'retailer'],
      order: { returnDate: 'DESC' },
    });
  }

  async getTotalBirdsReturnedForSale(saleId: string): Promise<number> {
    const result = await this.birdReturnRepository
      .createQueryBuilder('return')
      .select('SUM(return.numberOfBirdsReturned)', 'total')
      .where('return.saleId = :saleId', { saleId })
      .andWhere('return.status != :rejected', { rejected: 'rejected' })
      .getRawOne();

    return parseInt(result?.total || '0');
  }

  async update(id: string, dto: UpdateBirdReturnDto): Promise<BirdReturn> {
    const birdReturn = await this.findOne(id);

    // Prevent updates to processed returns
    if (birdReturn.status === 'processed') {
      throw new BadRequestException('Cannot update processed returns');
    }

    // If changing number of birds, validate
    if (dto.numberOfBirdsReturned && dto.numberOfBirdsReturned !== birdReturn.numberOfBirdsReturned) {
      const totalReturned = await this.getTotalBirdsReturnedForSale(birdReturn.saleId);
      const currentReturnBirds = birdReturn.numberOfBirdsReturned;
      const newTotal = totalReturned - currentReturnBirds + dto.numberOfBirdsReturned;

      const sale = await this.saleRepository.findOne({ where: { id: birdReturn.saleId } });
      const saleQuantity = Number(sale?.numberOfBirds || sale?.quantity || 0);

      if (newTotal > saleQuantity) {
        throw new BadRequestException(
          `Cannot update to ${dto.numberOfBirdsReturned} birds. Would exceed sale quantity.`
        );
      }
    }

    Object.assign(birdReturn, {
      returnDate: dto.returnDate ?? birdReturn.returnDate,
      customerName: dto.customerName ?? birdReturn.customerName,
      retailerId: dto.retailerId ?? birdReturn.retailerId,
      numberOfBirdsReturned: dto.numberOfBirdsReturned ?? birdReturn.numberOfBirdsReturned,
      weightReturned: dto.weightReturned ? parseFloat(dto.weightReturned) : birdReturn.weightReturned,
      returnReason: dto.returnReason ?? birdReturn.returnReason,
      reasonDescription: dto.reasonDescription ?? birdReturn.reasonDescription,
      refundAmount: dto.refundAmount ? parseFloat(dto.refundAmount) : birdReturn.refundAmount,
      adjustmentAmount: dto.adjustmentAmount ? parseFloat(dto.adjustmentAmount) : birdReturn.adjustmentAmount,
      status: dto.status ?? birdReturn.status,
      returnedToInventory: dto.returnedToInventory ?? birdReturn.returnedToInventory,
      inventoryLocation: dto.inventoryLocation ?? birdReturn.inventoryLocation,
      notes: dto.notes ?? birdReturn.notes,
      updatedAt: new Date(),
    });

    return this.birdReturnRepository.save(birdReturn);
  }

  async approveReturn(id: string, approvedBy: string): Promise<BirdReturn> {
    const birdReturn = await this.findOne(id);

    if (birdReturn.status !== 'pending') {
      throw new BadRequestException(`Return is already ${birdReturn.status}`);
    }

    birdReturn.status = 'approved';
    birdReturn.approvedBy = approvedBy;
    birdReturn.approvedAt = new Date();
    birdReturn.updatedAt = new Date();

    return this.birdReturnRepository.save(birdReturn);
  }

  async rejectReturn(id: string, approvedBy: string, reason?: string): Promise<BirdReturn> {
    const birdReturn = await this.findOne(id);

    if (birdReturn.status !== 'pending') {
      throw new BadRequestException(`Return is already ${birdReturn.status}`);
    }

    birdReturn.status = 'rejected';
    birdReturn.approvedBy = approvedBy;
    birdReturn.approvedAt = new Date();
    if (reason) {
      birdReturn.notes = (birdReturn.notes || '') + `\nRejection reason: ${reason}`;
    }
    birdReturn.updatedAt = new Date();

    return this.birdReturnRepository.save(birdReturn);
  }

  async processReturn(id: string, processedBy?: string): Promise<BirdReturn> {
    const birdReturn = await this.findOne(id);

    if (birdReturn.status !== 'approved') {
      throw new BadRequestException('Return must be approved before processing');
    }

    // Update sale record - reduce quantity and adjust amounts
    const sale = await this.saleRepository.findOne({ where: { id: birdReturn.saleId } });
    if (sale) {
      // Reduce bird count
      if (sale.numberOfBirds) {
        sale.numberOfBirds = Math.max(0, sale.numberOfBirds - birdReturn.numberOfBirdsReturned);
      }

      // Adjust financial amounts
      if (birdReturn.refundAmount > 0) {
        sale.netAmount = Number(sale.netAmount) - birdReturn.refundAmount;
        sale.amountReceived = Math.max(0, Number(sale.amountReceived) - birdReturn.refundAmount);
        
        // Update payment status
        if (sale.amountReceived === 0) {
          sale.paymentStatus = 'pending';
        } else if (sale.amountReceived < sale.netAmount) {
          sale.paymentStatus = 'partial';
        }
      }

      sale.updatedAt = new Date();
      await this.saleRepository.save(sale);

      // Create billing ledger entry for the return (CREDIT - increases what we owe them)
      if (birdReturn.refundAmount > 0 && sale.retailerId) {
        try {
          await this.billingService.recordTransaction({
            partyType: 'retailer',
            partyId: parseInt(sale.retailerId),
            partyName: sale.customerName,
            transactionType: 'return',
            transactionDate: birdReturn.returnDate,
            amount: birdReturn.refundAmount,
            referenceType: 'sale',
            referenceId: parseInt(sale.id),
            referenceNumber: sale.invoiceNumber,
            description: `Bird return: ${birdReturn.returnNumber} - ${birdReturn.numberOfBirdsReturned} birds`,
            notes: birdReturn.notes,
          });
        } catch (error) {
          console.error('Failed to create billing entry for return:', error);
        }
      }
    }

    // Mark as processed
    birdReturn.status = 'processed';
    birdReturn.processedBy = processedBy || 'system';
    birdReturn.processedAt = new Date();
    birdReturn.updatedAt = new Date();

    return this.birdReturnRepository.save(birdReturn);
  }

  async remove(id: string): Promise<void> {
    const birdReturn = await this.findOne(id);

    if (birdReturn.status === 'processed') {
      throw new BadRequestException('Cannot delete processed returns');
    }

    await this.birdReturnRepository.remove(birdReturn);
  }

  async getReturnStats(startDate?: string, endDate?: string): Promise<any> {
    const query = this.birdReturnRepository.createQueryBuilder('return');

    if (startDate && endDate) {
      query.where('return.returnDate BETWEEN :startDate AND :endDate', { startDate, endDate });
    }

    const returns = await query.getMany();

    const stats = {
      totalReturns: returns.length,
      totalBirdsReturned: returns.reduce((sum, r) => sum + r.numberOfBirdsReturned, 0),
      totalRefundAmount: returns.reduce((sum, r) => sum + Number(r.refundAmount || 0), 0),
      byStatus: {
        pending: returns.filter(r => r.status === 'pending').length,
        approved: returns.filter(r => r.status === 'approved').length,
        rejected: returns.filter(r => r.status === 'rejected').length,
        processed: returns.filter(r => r.status === 'processed').length,
      },
      byReason: returns.reduce((acc, r) => {
        acc[r.returnReason] = (acc[r.returnReason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return stats;
  }
}
