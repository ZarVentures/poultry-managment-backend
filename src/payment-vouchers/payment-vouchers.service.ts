import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PaymentVoucher } from './payment-voucher.entity';
import { CreatePaymentVoucherDto } from './dto/create-payment-voucher.dto';
import { UpdatePaymentVoucherDto } from './dto/update-payment-voucher.dto';

@Injectable()
export class PaymentVouchersService {
  constructor(
    @InjectRepository(PaymentVoucher)
    private paymentVoucherRepository: Repository<PaymentVoucher>,
  ) {}

  async create(createDto: CreatePaymentVoucherDto, userId: number): Promise<PaymentVoucher> {
    // Generate voucher number
    const voucherNumber = await this.generateVoucherNumber();

    const voucher = this.paymentVoucherRepository.create({
      ...createDto,
      voucherNumber,
      createdById: userId,
    });

    return await this.paymentVoucherRepository.save(voucher);
  }

  async findAll(filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    payeeType?: string;
  }): Promise<PaymentVoucher[]> {
    const query = this.paymentVoucherRepository.createQueryBuilder('voucher')
      .leftJoinAndSelect('voucher.createdBy', 'createdBy')
      .leftJoinAndSelect('voucher.approvedBy', 'approvedBy')
      .orderBy('voucher.voucherDate', 'DESC')
      .addOrderBy('voucher.id', 'DESC');

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

    return await query.getMany();
  }

  async findOne(id: number): Promise<PaymentVoucher> {
    const voucher = await this.paymentVoucherRepository.findOne({
      where: { id },
      relations: ['createdBy', 'approvedBy'],
    });

    if (!voucher) {
      throw new NotFoundException(`Payment voucher with ID ${id} not found`);
    }

    return voucher;
  }

  async update(id: number, updateDto: UpdatePaymentVoucherDto): Promise<PaymentVoucher> {
    const voucher = await this.findOne(id);
    Object.assign(voucher, updateDto);
    return await this.paymentVoucherRepository.save(voucher);
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
    return await this.paymentVoucherRepository.save(voucher);
  }

  async cancel(id: number): Promise<PaymentVoucher> {
    const voucher = await this.findOne(id);
    voucher.status = 'cancelled';
    return await this.paymentVoucherRepository.save(voucher);
  }

  async getStats(startDate?: string, endDate?: string): Promise<any> {
    const query = this.paymentVoucherRepository.createQueryBuilder('voucher');

    if (startDate && endDate) {
      query.where('voucher.voucherDate BETWEEN :startDate AND :endDate', {
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
    const lastVoucher = await this.paymentVoucherRepository
      .createQueryBuilder('voucher')
      .where('voucher.voucherNumber LIKE :pattern', { pattern: `PV-${year}-${month}-%` })
      .orderBy('voucher.id', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastVoucher) {
      const lastSequence = parseInt(lastVoucher.voucherNumber.split('-').pop() || '0');
      sequence = lastSequence + 1;
    }

    return `PV-${year}-${month}-${String(sequence).padStart(4, '0')}`;
  }
}
