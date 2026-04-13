import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GodownInwardEntry } from './godown-inward.entity';
import { GodownInwardCage } from './godown-inward-cage.entity';
import { GodownSale } from './godown-sale.entity';
import { GodownSaleCage } from './godown-sale-cage.entity';
import { GodownMortality } from './godown-mortality.entity';
import { GodownExpense } from './godown-expense.entity';

@Injectable()
export class GodownService {
  constructor(
    @InjectRepository(GodownInwardEntry)
    private inwardRepo: Repository<GodownInwardEntry>,
    @InjectRepository(GodownInwardCage)
    private inwardCageRepo: Repository<GodownInwardCage>,
    @InjectRepository(GodownSale)
    private saleRepo: Repository<GodownSale>,
    @InjectRepository(GodownSaleCage)
    private saleCageRepo: Repository<GodownSaleCage>,
    @InjectRepository(GodownMortality)
    private mortalityRepo: Repository<GodownMortality>,
    @InjectRepository(GodownExpense)
    private expenseRepo: Repository<GodownExpense>,
  ) {}

  // ─── Inward Entries ───────────────────────────────────────────────────────

  async createInward(data: any) {
    const { cages, ...entryData } = data;
    const entry = this.inwardRepo.create(entryData);
    const saved = await this.inwardRepo.save(entry);

    if (cages && cages.length > 0) {
      const cageEntities = cages.map((c: any) =>
        this.inwardCageRepo.create({ ...c, godownInwardId: saved.id })
      );
      await this.inwardCageRepo.save(cageEntities);
    }

    return this.findOneInward(saved.id);
  }

  async findAllInward() {
    return this.inwardRepo.find({
      relations: ['cages'],
      order: { entryDate: 'DESC' },
    });
  }

  async findOneInward(id: string) {
    return this.inwardRepo.findOne({ where: { id }, relations: ['cages'] });
  }

  async updateInward(id: string, data: any) {
    const { cages, ...entryData } = data;
    await this.inwardRepo.update(id, entryData);

    if (cages !== undefined) {
      // Delete existing cages and replace
      await this.inwardCageRepo.delete({ godownInwardId: id });
      if (cages.length > 0) {
        const cageEntities = cages.map((c: any) =>
          this.inwardCageRepo.create({ ...c, godownInwardId: id })
        );
        await this.inwardCageRepo.save(cageEntities);
      }
    }

    return this.findOneInward(id);
  }

  async removeInward(id: string) {
    // Cages cascade delete via FK
    await this.inwardRepo.delete(id);
  }

  // ─── Sales ────────────────────────────────────────────────────────────────

  async createSale(data: any) {
    const { cages, ...saleData } = data;
    const sale = this.saleRepo.create(saleData);
    const saved = await this.saleRepo.save(sale);

    if (cages && cages.length > 0) {
      const cageEntities = cages.map((c: any) =>
        this.saleCageRepo.create({ ...c, godownSaleId: saved.id })
      );
      await this.saleCageRepo.save(cageEntities);
    }

    return this.findOneSale(saved.id);
  }

  async findAllSales() {
    return this.saleRepo.find({
      relations: ['cages'],
      order: { saleDate: 'DESC' },
    });
  }

  async findOneSale(id: string) {
    return this.saleRepo.findOne({ where: { id }, relations: ['cages'] });
  }

  async updateSale(id: string, data: any) {
    const { cages, ...saleData } = data;
    await this.saleRepo.update(id, saleData);

    if (cages !== undefined) {
      await this.saleCageRepo.delete({ godownSaleId: id });
      if (cages.length > 0) {
        const cageEntities = cages.map((c: any) =>
          this.saleCageRepo.create({ ...c, godownSaleId: id })
        );
        await this.saleCageRepo.save(cageEntities);
      }
    }

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
    return this.mortalityRepo.find({ order: { mortalityDate: 'DESC' } });
  }

  async findOneMortality(id: string) {
    return this.mortalityRepo.findOne({ where: { id } });
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
