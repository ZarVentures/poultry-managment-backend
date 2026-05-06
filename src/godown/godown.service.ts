import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GodownInwardEntry } from './godown-inward.entity';
import { GodownSale } from './godown-sale.entity';
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
    @InjectRepository(GodownMortality)
    private mortalityRepo: Repository<GodownMortality>,
    @InjectRepository(GodownExpense)
    private expenseRepo: Repository<GodownExpense>,
    private readonly cagesService: CagesService,
  ) {}

  // ─── Inward Entries ───────────────────────────────────────────────────────

  async createInward(data: any) {
    const { cageIds, godownInwardWeight, ...entryData } = data;
    const entry = this.inwardRepo.create(entryData);
    const savedResult = await this.inwardRepo.save(entry);
    const savedId: string = (savedResult as any).id ?? (savedResult as any)[0]?.id;

    // Mark selected cages as in_godown in master cages table
    if (cageIds && cageIds.length > 0) {
      await this.cagesService.markInGodown(cageIds, savedId, godownInwardWeight);
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

  async createSale(data: any) {
    const { cageIds, godownSaleWeight, ...saleData } = data;
    const sale = this.saleRepo.create(saleData);
    const savedResult = await this.saleRepo.save(sale);
    const savedId: string = (savedResult as any).id ?? (savedResult as any)[0]?.id;

    // Mark selected cages as godown_sold in master cages table
    if (cageIds && cageIds.length > 0) {
      await this.cagesService.markGodownSold(cageIds, savedId, godownSaleWeight);
    }

    return this.findOneSale(savedId);
  }

  async findAllSales() {
    return this.saleRepo.find({ order: { saleDate: 'DESC' } });
  }

  async findOneSale(id: string) {
    return this.saleRepo.findOne({ where: { id } });
  }

  async updateSale(id: string, data: any) {
    // Filter out fields that don't exist in the entity
    const { cages, retailerId, vehicleId, ...validData } = data;
    
    // Only include retailerId and vehicleId if they have valid values
    if (retailerId) {
      validData.retailerId = retailerId;
    }
    if (vehicleId) {
      validData.vehicleId = vehicleId;
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
