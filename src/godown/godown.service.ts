import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GodownInwardEntry } from './godown-inward.entity';
import { GodownSale } from './entities/godown-sale.entity';
import { GodownSalePayment } from './entities/godown-sale-payment.entity';
import { GodownMortality } from './godown-mortality.entity';
import { GodownExpense } from './godown-expense.entity';
import { CagesService } from '../cages/cages.service';

@Injectable()
export class GodownService {
  constructor(
    @InjectRepository(GodownInwardEntry)
    private inwardRepo: Repository<GodownInwardEntry>,
    @InjectRepository(GodownSale)
    private saleRepo: Repository<GodownSale>,
    @InjectRepository(GodownSalePayment)
    private salePaymentRepo: Repository<GodownSalePayment>,
    @InjectRepository(GodownMortality)
    private mortalityRepo: Repository<GodownMortality>,
    @InjectRepository(GodownExpense)
    private expenseRepo: Repository<GodownExpense>,
    private readonly cagesService: CagesService,
  ) { }

  // ─── Inward Entries ───────────────────────────────────────────────────────

  async createInward(data: any) {
    const { cageIds, godownInwardWeight, actualWeight, weightLoss, ...entryData } = data;

    if (actualWeight) entryData.actualWeight = parseFloat(actualWeight);
    if (weightLoss) entryData.weightLoss = parseFloat(weightLoss);
    // If godownInwardWeight is provided, it's the final stock weight
    if (godownInwardWeight) entryData.totalWeight = parseFloat(godownInwardWeight);

    const entry = this.inwardRepo.create(entryData);
    const savedResult = await this.inwardRepo.save(entry);
    const savedId: string = (savedResult as any).id ?? (savedResult as any)[0]?.id;

    // Mark selected cages as in_godown in master cages table
    if (cageIds && cageIds.length > 0) {
      await this.cagesService.markInGodown(cageIds, savedId, parseFloat(godownInwardWeight || entryData.totalWeight || 0));
    }

    return this.findOneInward(savedId);
  }

  async findAllInward() {
    return this.inwardRepo.find({ order: { entryDate: 'DESC' } });
  }

  async findOneInward(id: string) {
    return this.inwardRepo.findOne({ where: { id } });
  }

  async updateInward(id: string, data: any) {
    // Strip fields that are not columns on the entity (e.g. cages, cageIds)
    const { cages, cageIds, godownInwardWeight, ...updateData } = data;
    await this.inwardRepo.update(id, updateData);
    return this.findOneInward(id);
  }

  async removeInward(id: string) {
    await this.inwardRepo.delete(id);
  }

  // ─── Sales ────────────────────────────────────────────────────────────────

  private async generateSaleNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `GDS-${year}-${month}-`;

    // Find the last sale number with this prefix
    const lastSale = await this.saleRepo
      .createQueryBuilder('sale')
      .where('sale.saleNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('sale.id', 'DESC')
      .limit(1)
      .getOne();

    if (lastSale && lastSale.saleNo) {
      const lastNumber = parseInt(lastSale.saleNo.split('-').pop() || '0');
      return `${prefix}${String(lastNumber + 1).padStart(4, '0')}`;
    }

    return `${prefix}0001`;
  }

  async createSale(data: any) {
    const { cageIds, godownSaleWeight, payments, weightLoss, ...saleData } = data;

    // Auto-generate sale number if not provided
    if (!saleData.saleNo) {
      saleData.saleNo = await this.generateSaleNumber();
    }

    if (weightLoss) {
      saleData.weightLoss = parseFloat(weightLoss);
    }

    // Calculate total payment made from payments array
    const totalPaymentMade = (payments || []).reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0);
    saleData.amountReceived = totalPaymentMade;

    const sale = this.saleRepo.create(saleData);
    const savedResult = await this.saleRepo.save(sale);
    const savedId: string = (savedResult as any).id ?? (savedResult as any)[0]?.id;

    // Save payments if provided
    if (payments && payments.length > 0) {
      const validPayments = payments
        .filter((p: any) => parseFloat(p.amount || '0') > 0)
        .map((p: any) => this.salePaymentRepo.create({
          godownSaleId: savedId,
          paymentMode: p.paymentMode,
          amount: parseFloat(p.amount),
        }));
      if (validPayments.length > 0) {
        await this.salePaymentRepo.save(validPayments);
      }
    }

    // Mark selected cages as godown_sold in master cages table
    // Support either simple cageIds array or detailed cages array with partials
    const { cages: cageDetails } = data;
    if (cageDetails && Array.isArray(cageDetails) && cageDetails.length > 0) {
      for (const cage of cageDetails) {
        if (cage.id && (cage.soldBirds || cage.numberOfBirds)) {
          await this.cagesService.partialGodownSale(
            cage.id,
            savedId,
            cage.soldBirds || cage.numberOfBirds,
            cage.soldWeight || cage.cageWeight || 0,
            cage.weightLoss || 0
          );
        }
      }
    } else if (cageIds && cageIds.length > 0) {
      await this.cagesService.markGodownSold(cageIds, savedId, godownSaleWeight);
    }

    return this.findOneSale(savedId);
  }

  async findAllSales() {
    return this.saleRepo.find({
      order: { saleDate: 'DESC' },
      relations: ['payments']
    });
  }

  async findOneSale(id: string) {
    return this.saleRepo.findOne({
      where: { id },
      relations: ['payments']
    });
  }

  async updateSale(id: string, data: any) {
    // Filter out fields that don't exist in the entity
    const { cages, payments, ...validData } = data;

    // Handle payments update
    if (payments !== undefined) {
      // Delete existing payments
      await this.salePaymentRepo.delete({ godownSaleId: id });

      // Add new payments
      const validPayments = payments
        .filter((p: any) => parseFloat(p.amount || '0') > 0)
        .map((p: any) => this.salePaymentRepo.create({
          godownSaleId: id,
          paymentMode: p.paymentMode,
          amount: parseFloat(p.amount),
        }));

      if (validPayments.length > 0) {
        await this.salePaymentRepo.save(validPayments);
      }

      // Update amount_received
      const totalPaymentMade = payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0);
      validData.amountReceived = totalPaymentMade;
    }

    await this.saleRepo.update(id, validData);
    return this.findOneSale(id);
  }

  async removeSale(id: string) {
    await this.saleRepo.delete(id);
  }

  // ─── Mortality ────────────────────────────────────────────────────────────

  async createMortality(data: Partial<GodownMortality>) {
    const mortality = this.mortalityRepo.create(data);
    return this.mortalityRepo.save(mortality);
  }

  async findAllMortality() {
    return this.mortalityRepo.find({
      order: { mortalityDate: 'DESC' },
      relations: ['godownInward'],
    });
  }

  async findOneMortality(id: string) {
    return this.mortalityRepo.findOne({ where: { id }, relations: ['godownInward'] });
  }

  async updateMortality(id: string, data: Partial<GodownMortality>) {
    await this.mortalityRepo.update(id, data);
    return this.findOneMortality(id);
  }

  async removeMortality(id: string) {
    await this.mortalityRepo.delete(id);
  }

  // ─── Expenses ─────────────────────────────────────────────────────────────

  async createExpense(data: Partial<GodownExpense>) {
    const expense = this.expenseRepo.create(data);
    return this.expenseRepo.save(expense);
  }

  async findAllExpenses() {
    return this.expenseRepo.find({ order: { expenseDate: 'DESC' } });
  }

  async findOneExpense(id: string) {
    return this.expenseRepo.findOne({ where: { id } });
  }

  async updateExpense(id: string, data: Partial<GodownExpense>) {
    await this.expenseRepo.update(id, data);
    return this.findOneExpense(id);
  }

  async removeExpense(id: string) {
    await this.expenseRepo.delete(id);
  }

  // ─── Summary ──────────────────────────────────────────────────────────────

  async getSummary() {
    const totalInward = await this.inwardRepo
      .createQueryBuilder('entry')
      .select('SUM(entry.numberOfBirds)', 'total')
      .getRawOne();

    const totalSold = await this.saleRepo
      .createQueryBuilder('sale')
      .select('SUM(sale.numberOfBirds)', 'total')
      .getRawOne();

    const totalMortality = await this.mortalityRepo
      .createQueryBuilder('mortality')
      .select('SUM(mortality.numberOfBirdsDied)', 'total')
      .getRawOne();

    const currentStock =
      (parseInt(totalInward.total) || 0) -
      (parseInt(totalSold.total) || 0) -
      (parseInt(totalMortality.total) || 0);

    return {
      totalInward: parseInt(totalInward.total) || 0,
      totalSold: parseInt(totalSold.total) || 0,
      totalMortality: parseInt(totalMortality.total) || 0,
      currentStock,
    };
  }
}
