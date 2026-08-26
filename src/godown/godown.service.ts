import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { GodownMaster } from './godown-master.entity';
import { GodownInwardEntry } from './godown-inward.entity';
import { GodownSale } from './entities/godown-sale.entity';
import { GodownSalePayment } from './entities/godown-sale-payment.entity';
import { GodownMortality } from './godown-mortality.entity';
import { GodownExpense } from './godown-expense.entity';
import { BirdReturn } from '../sales/entities/bird-return.entity';
import { CagesService } from '../cages/cages.service';
import { TenantContextService } from '../tenants/tenant-context.service';

@Injectable()
export class GodownService {
  constructor(
    @InjectRepository(GodownMaster)
    private godownRepo: Repository<GodownMaster>,
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
    @InjectRepository(BirdReturn)
    private birdReturnRepo: Repository<BirdReturn>,
    private readonly cagesService: CagesService,
    private readonly tenantContext: TenantContextService,
  ) { }

  private getTenantId(): string | null {
    return this.tenantContext.getTenantId();
  }

  private tenantWhere(extra: any): any {
    const tenantId = this.getTenantId();
    return tenantId ? { ...extra, tenantId } : extra;
  }

  private applyTenant<T extends ObjectLiteral>(query: SelectQueryBuilder<T>, alias: string): SelectQueryBuilder<T> {
    const tenantId = this.getTenantId();
    if (tenantId) query.andWhere(`${alias}.tenantId = :tenantId`, { tenantId });
    return query;
  }

  private applyGodown<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    alias: string,
    godownId?: string,
  ): SelectQueryBuilder<T> {
    if (godownId && godownId !== 'all') {
      query.andWhere(`${alias}.godownId = :godownId`, { godownId });
    }
    return query;
  }

  private withGodownName<T extends { godown?: GodownMaster; godownName?: string }>(entity: T): T {
    if (entity?.godown) {
      entity.godownName = entity.godown.name;
    }
    return entity;
  }

  private async ensureDefaultGodown(): Promise<GodownMaster> {
    const tenantId = this.getTenantId();
    const where = this.tenantWhere({ code: 'DEFAULT' });
    let godown = await this.godownRepo.findOne({ where });
    if (!godown) {
      godown = this.godownRepo.create({
        name: 'Default Godown',
        code: 'DEFAULT',
        location: 'Default',
        status: 'active',
        tenantId: tenantId ?? undefined,
      });
      godown = await this.godownRepo.save(godown);
    }
    return godown;
  }

  private async normalizeGodownId(godownId?: string | null): Promise<string> {
    if (godownId) {
      const exists = await this.godownRepo.findOne({ where: this.tenantWhere({ id: godownId }) });
      if (!exists) throw new BadRequestException('Invalid godownId');
      return godownId;
    }
    const fallback = await this.ensureDefaultGodown();
    return fallback.id;
  }

  // ─── Godown Master ─────────────────────────────────────────────────────────

  async createGodown(data: any) {
    const entity = this.godownRepo.create({
      name: String(data.name || '').trim(),
      code: String(data.code || '').trim().toUpperCase(),
      location: data.location || undefined,
      address: data.address || undefined,
      capacityBirds: data.capacityBirds === '' || data.capacityBirds == null ? undefined : Number(data.capacityBirds),
      managerName: data.managerName || undefined,
      phone: data.phone || undefined,
      status: data.status || 'active',
      notes: data.notes || undefined,
      tenantId: this.getTenantId() ?? undefined,
    });

    if (!entity.name || !entity.code) {
      throw new BadRequestException('Godown name and code are required');
    }

    return this.godownRepo.save(entity);
  }

  async findAllGodowns(page?: number, limit?: number, search?: string, status?: string) {
    const query = this.godownRepo.createQueryBuilder('godown')
      .orderBy('godown.name', 'ASC');
    this.applyTenant(query, 'godown');

    if (search) {
      query.andWhere(
        '(godown.name ILIKE :search OR godown.code ILIKE :search OR godown.location ILIKE :search OR godown.managerName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status && status !== 'all') {
      query.andWhere('godown.status = :status', { status });
    }

    if (page && limit) {
      const skip = (Number(page) - 1) * Number(limit);
      const [data, total] = await query.skip(skip).take(Number(limit)).getManyAndCount();
      return { data, total, page: Number(page), limit: Number(limit) };
    }

    return query.getMany();
  }

  async findActiveGodowns() {
    const list = await this.godownRepo.find({
      where: this.tenantWhere({ status: 'active' }),
      order: { name: 'ASC' },
    });
    if (list.length > 0) return list;
    return [await this.ensureDefaultGodown()];
  }

  async findOneGodown(id: string) {
    const godown = await this.godownRepo.findOne({ where: this.tenantWhere({ id }) });
    if (!godown) throw new NotFoundException(`Godown with id ${id} not found`);
    return godown;
  }

  async updateGodown(id: string, data: any) {
    const existing = await this.findOneGodown(id);
    Object.assign(existing, {
      ...data,
      code: data.code !== undefined ? String(data.code).trim().toUpperCase() : existing.code,
      capacityBirds: data.capacityBirds === '' ? null : data.capacityBirds,
    });
    return this.godownRepo.save(existing);
  }

  async removeGodown(id: string) {
    const [inwardCount, saleCount, mortalityCount, expenseCount] = await Promise.all([
      this.inwardRepo.count({ where: this.tenantWhere({ godownId: id }) }),
      this.saleRepo.count({ where: this.tenantWhere({ godownId: id }) }),
      this.mortalityRepo.count({ where: this.tenantWhere({ godownId: id }) }),
      this.expenseRepo.count({ where: this.tenantWhere({ godownId: id }) }),
    ]);
    if (inwardCount + saleCount + mortalityCount + expenseCount > 0) {
      await this.godownRepo.update(this.tenantWhere({ id }), { status: 'inactive' });
      return;
    }
    await this.godownRepo.delete(this.tenantWhere({ id }));
  }

  // ─── Inward Entries ───────────────────────────────────────────────────────

  async createInward(data: any) {
    const { cageIds, cages, godownInwardWeight, actualWeight, weightLoss, ...entryData } = data;
    entryData.godownId = await this.normalizeGodownId(entryData.godownId);

    if (!entryData.inwardNo) {
      entryData.inwardNo = await this.generateInwardNumber();
    }

    if (actualWeight) entryData.actualWeight = parseFloat(actualWeight);
    if (weightLoss) entryData.weightLoss = parseFloat(weightLoss);
    // If godownInwardWeight is provided, it's the final stock weight
    if (godownInwardWeight) entryData.totalWeight = parseFloat(godownInwardWeight);

    const entry = this.inwardRepo.create({ ...entryData, tenantId: this.getTenantId() ?? undefined });
    const savedResult = await this.inwardRepo.save(entry);
    const savedId: string = (savedResult as any).id ?? (savedResult as any)[0]?.id;

    // Mark selected cages as in_godown in master cages table
    const idsFromPayload = Array.isArray(cageIds) ? cageIds : [];
    const idsFromCages = Array.isArray(cages)
      ? cages.map((c: any) => c.id).filter(Boolean)
      : [];
    const allCageIds = [...new Set([...idsFromPayload, ...idsFromCages].map(String))];

    if (allCageIds.length > 0) {
      await this.cagesService.markInGodown(
        allCageIds,
        savedId,
        parseFloat(godownInwardWeight || entryData.totalWeight || 0) || undefined,
      );

      // Apply per-cage godown weights when provided
      if (Array.isArray(cages) && cages.length > 0) {
        await this.cagesService.updateGodownInwardCages(
          savedId,
          cages.map((c: any) => ({
            id: c.id,
            cageId: c.cageId,
            numberOfBirds: c.numberOfBirds,
            godownInwardWeight: c.cageWeight ?? c.godownInwardWeight ?? c.godownWeight,
          })),
        );
      }
    }

    return this.findOneInward(savedId);
  }

  async findAllInward(page?: number, limit?: number, search?: string, godownId?: string) {
    const query = this.inwardRepo.createQueryBuilder('inward')
      .leftJoinAndSelect('inward.godown', 'godown')
      .orderBy('inward.entryDate', 'DESC');

    this.applyTenant(query, 'inward');
    this.applyGodown(query, 'inward', godownId);

    if (search) {
      query.andWhere(
        '(inward.farmerName ILIKE :search OR inward.vehicleNumber ILIKE :search OR inward.farmHouseName ILIKE :search OR inward.inwardNo ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (page && limit) {
      const skip = (page - 1) * limit;
      const [data, total] = await query.skip(skip).take(limit).getManyAndCount();
      return { data: data.map((entry) => this.withGodownName(entry)), total, page, limit };
    }

    return (await query.getMany()).map((entry) => this.withGodownName(entry));
  }

  async findOneInward(id: string) {
    const entry = await this.inwardRepo.findOne({ where: this.tenantWhere({ id }), relations: ['godown'] });
    if (!entry) return null;

    const linkedCages = await this.cagesService.getByGodownInwardId(id);
    return {
      ...entry,
      godownName: entry.godown?.name,
      cages: linkedCages.map((c) => ({
        id: c.id,
        cageId: c.cageId,
        numberOfBirds: c.numberOfBirds,
        cageWeight: c.godownInwardWeight != null ? Number(c.godownInwardWeight) : Number(c.purchaseWeight || 0),
        purchaseWeight: Number(c.purchaseWeight || 0),
        status: c.status,
        purchaseOrderId: c.purchaseOrderId,
        godownInwardId: c.godownInwardId,
      })),
    };
  }

  async updateInward(id: string, data: any) {
    // Strip fields that are not columns on the entity (e.g. cages, cageIds)
    const { cages, cageIds, godownInwardWeight, actualWeight, weightLoss, cageUpdates, ...updateData } = data;

    if (actualWeight !== undefined) updateData.actualWeight = parseFloat(actualWeight);
    if (weightLoss !== undefined) updateData.weightLoss = parseFloat(weightLoss);
    if (godownInwardWeight !== undefined) updateData.totalWeight = parseFloat(godownInwardWeight);
    if (updateData.godownId !== undefined) updateData.godownId = await this.normalizeGodownId(updateData.godownId);

    await this.inwardRepo.update(id, updateData);

    // Re-link / update cages associated with this inward entry
    if (cageIds && Array.isArray(cageIds) && cageIds.length > 0) {
      await this.cagesService.markInGodown(
        cageIds,
        id,
        parseFloat(godownInwardWeight || updateData.totalWeight || 0) || undefined,
      );
    }

    // Persist per-cage edits (birds / godown weight) when provided
    if (cageUpdates && Array.isArray(cageUpdates) && cageUpdates.length > 0) {
      await this.cagesService.updateGodownInwardCages(id, cageUpdates);
    } else if (cages && Array.isArray(cages) && cages.length > 0) {
      await this.cagesService.updateGodownInwardCages(
        id,
        cages.map((c: any) => ({
          id: c.id,
          cageId: c.cageId,
          numberOfBirds: c.numberOfBirds,
          godownInwardWeight: c.cageWeight ?? c.godownInwardWeight ?? c.godownWeight,
        })),
      );
    }

    return this.findOneInward(id);
  }

  async removeInward(id: string) {
    await this.inwardRepo.delete(id);
  }

  private async generateInwardNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `GDI-${year}-${month}-`;

    const qb = this.inwardRepo
      .createQueryBuilder('inward')
      .where('inward.inwardNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('inward.id', 'DESC')
      .limit(1);
    this.applyTenant(qb, 'inward');
    const lastInward = await qb.getOne();

    if (lastInward && lastInward.inwardNo) {
      const lastNumber = parseInt(lastInward.inwardNo.split('-').pop() || '0');
      return `${prefix}${String(lastNumber + 1).padStart(4, '0')}`;
    }

    return `${prefix}0001`;
  }

  async generateNextInwardNumber(): Promise<string> {
    return this.generateInwardNumber();
  }

  // ─── Sales ────────────────────────────────────────────────────────────────

  private async generateSaleNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `GDS-${year}-${month}-`;

    // Find the last sale number with this prefix
    const qb = this.saleRepo
      .createQueryBuilder('sale')
      .where('sale.saleNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('sale.id', 'DESC')
      .limit(1);
    this.applyTenant(qb, 'sale');
    const lastSale = await qb.getOne();

    if (lastSale && lastSale.saleNo) {
      const lastNumber = parseInt(lastSale.saleNo.split('-').pop() || '0');
      return `${prefix}${String(lastNumber + 1).padStart(4, '0')}`;
    }

    return `${prefix}0001`;
  }

  async generateNextSaleNumber(): Promise<string> {
    return this.generateSaleNumber();
  }

  async createSale(data: any) {
    const { cageIds, godownSaleWeight, payments, weightLoss, ...saleData } = data;
    saleData.godownId = await this.normalizeGodownId(saleData.godownId);

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

    const sale = this.saleRepo.create({ ...saleData, tenantId: this.getTenantId() ?? undefined });
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
          tenantId: this.getTenantId() ?? undefined,
        }));
      if (validPayments.length > 0) {
        await this.salePaymentRepo.save(validPayments);
      }
    }

    return this.findOneSale(savedId);
  }

  async findAllSales(page?: number, limit?: number, search?: string, godownId?: string) {
    const query = this.saleRepo.createQueryBuilder('sale')
      .leftJoinAndSelect('sale.godown', 'godown')
      .leftJoinAndSelect('sale.payments', 'payments')
      .orderBy('sale.saleDate', 'DESC');

    this.applyTenant(query, 'sale');
    this.applyGodown(query, 'sale', godownId);

    if (search) {
      query.andWhere(
        '(sale.retailerName ILIKE :search OR sale.saleNo ILIKE :search OR sale.vehicleNumber ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (page && limit) {
      const skip = (page - 1) * limit;
      const [data, total] = await query.skip(skip).take(limit).getManyAndCount();
      return { data: data.map((sale) => this.withGodownName(sale)), total, page, limit };
    }

    return (await query.getMany()).map((sale) => this.withGodownName(sale));
  }

  async findOneSale(id: string) {
    const sale = await this.saleRepo.findOne({
      where: this.tenantWhere({ id }),
      relations: ['payments', 'godown']
    });
    return sale ? this.withGodownName(sale) : sale;
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
          tenantId: this.getTenantId() ?? undefined,
        }));

      if (validPayments.length > 0) {
        await this.salePaymentRepo.save(validPayments);
      }

      // Update amount_received
      const totalPaymentMade = payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0);
      validData.amountReceived = totalPaymentMade;
    }
    if (validData.godownId !== undefined) validData.godownId = await this.normalizeGodownId(validData.godownId);

    await this.saleRepo.update(id, validData);
    return this.findOneSale(id);
  }

  async removeSale(id: string) {
    await this.saleRepo.delete(id);
  }

  // ─── Mortality ────────────────────────────────────────────────────────────

  async createMortality(data: Partial<GodownMortality>) {
    const godownId = await this.normalizeGodownId(data.godownId);
    const mortality = this.mortalityRepo.create({ ...data, godownId, tenantId: this.getTenantId() ?? undefined });
    return this.mortalityRepo.save(mortality);
  }

  async findAllMortality(page?: number, limit?: number, search?: string, godownId?: string) {
    const query = this.mortalityRepo.createQueryBuilder('mortality')
      .leftJoinAndSelect('mortality.godown', 'godown')
      .leftJoinAndSelect('mortality.godownInward', 'godownInward')
      .orderBy('mortality.mortalityDate', 'DESC');

    this.applyTenant(query, 'mortality');
    this.applyGodown(query, 'mortality', godownId);

    if (search) {
      query.andWhere(
        '(godownInward.farmerName ILIKE :search OR mortality.reason ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (page && limit) {
      const skip = (page - 1) * limit;
      const [data, total] = await query.skip(skip).take(limit).getManyAndCount();
      return { data: data.map((mortality) => this.withGodownName(mortality)), total, page, limit };
    }

    return (await query.getMany()).map((mortality) => this.withGodownName(mortality));
  }

  async findOneMortality(id: string) {
    const mortality = await this.mortalityRepo.findOne({ where: this.tenantWhere({ id }), relations: ['godownInward', 'godown'] });
    return mortality ? this.withGodownName(mortality) : mortality;
  }

  async updateMortality(id: string, data: Partial<GodownMortality>) {
    if (data.godownId !== undefined) data.godownId = await this.normalizeGodownId(data.godownId);
    await this.mortalityRepo.update(id, data);
    return this.findOneMortality(id);
  }

  async removeMortality(id: string) {
    await this.mortalityRepo.delete(id);
  }

  // ─── Expenses ─────────────────────────────────────────────────────────────

  async createExpense(data: Partial<GodownExpense>) {
    const godownId = await this.normalizeGodownId(data.godownId);
    const expense = this.expenseRepo.create({ ...data, godownId, tenantId: this.getTenantId() ?? undefined });
    return this.expenseRepo.save(expense);
  }

  async findAllExpenses(page?: number, limit?: number, search?: string, startDate?: string, endDate?: string, godownId?: string) {
    const query = this.expenseRepo.createQueryBuilder('expense')
      .leftJoinAndSelect('expense.godown', 'godown')
      .orderBy('expense.expenseDate', 'DESC');

    this.applyTenant(query, 'expense');
    this.applyGodown(query, 'expense', godownId);

    if (search) {
      query.andWhere(
        '(expense.expenseCategory ILIKE :search OR expense.description ILIKE :search OR expense.paidTo ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (startDate) {
      query.andWhere('expense.expenseDate >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('expense.expenseDate <= :endDate', { endDate });
    }

    if (page && limit) {
      const skip = (page - 1) * limit;
      const [data, total] = await query.skip(skip).take(limit).getManyAndCount();
      return { data: data.map((expense) => this.withGodownName(expense)), total, page, limit };
    }

    return (await query.getMany()).map((expense) => this.withGodownName(expense));
  }

  async findOneExpense(id: string) {
    const expense = await this.expenseRepo.findOne({ where: this.tenantWhere({ id }), relations: ['godown'] });
    return expense ? this.withGodownName(expense) : expense;
  }

  async updateExpense(id: string, data: Partial<GodownExpense>) {
    if (data.godownId !== undefined) data.godownId = await this.normalizeGodownId(data.godownId);
    await this.expenseRepo.update(id, data);
    return this.findOneExpense(id);
  }

  async removeExpense(id: string) {
    await this.expenseRepo.delete(id);
  }

  // ─── Summary ──────────────────────────────────────────────────────────────

  async getSummary(godownId?: string) {
    const inwardQuery = this.inwardRepo
      .createQueryBuilder('entry')
      .select([
        'SUM(entry.numberOfBirds) AS birds',
        'SUM(entry.totalWeight) AS weight',
        'SUM(entry.totalAmount) AS value',
      ]);
    this.applyTenant(inwardQuery, 'entry');
    this.applyGodown(inwardQuery, 'entry', godownId);
    const inward = await inwardQuery.getRawOne();

    const soldQuery = this.saleRepo
      .createQueryBuilder('sale')
      .select([
        'SUM(sale.numberOfBirds) AS birds',
        'SUM(sale.totalWeight) AS weight',
        'SUM(sale.totalAmount) AS value',
      ]);
    this.applyTenant(soldQuery, 'sale');
    this.applyGodown(soldQuery, 'sale', godownId);
    const sold = await soldQuery.getRawOne();

    const mortalityQuery = this.mortalityRepo
      .createQueryBuilder('mortality')
      .select([
        'SUM(mortality.numberOfBirdsDied) AS birds',
        'SUM(mortality.weightOfDeadBirds) AS weight',
      ]);
    this.applyTenant(mortalityQuery, 'mortality');
    this.applyGodown(mortalityQuery, 'mortality', godownId);
    const mortality = await mortalityQuery.getRawOne();

    const selectedGodown = godownId && godownId !== 'all'
      ? await this.godownRepo.findOne({ where: this.tenantWhere({ id: godownId }) })
      : null;

    const totalInwardBirds = parseFloat(inward.birds) || 0;
    const totalInwardWeight = parseFloat(inward.weight) || 0;
    const totalInwardValue = parseFloat(inward.value) || 0;
    const totalSoldBirds = parseFloat(sold.birds) || 0;
    const totalSoldWeight = parseFloat(sold.weight) || 0;
    const totalSoldValue = parseFloat(sold.value) || 0;
    const totalMortalityBirds = parseFloat(mortality.birds) || 0;
    const totalMortalityWeight = parseFloat(mortality.weight) || 0;

    return {
      godownId: selectedGodown?.id ?? null,
      godownName: selectedGodown?.name ?? null,
      totalInward: totalInwardBirds,
      totalSold: totalSoldBirds,
      totalMortality: totalMortalityBirds,
      currentStock: totalInwardBirds - totalSoldBirds - totalMortalityBirds,
      totalInwardWeight,
      totalSoldWeight,
      totalMortalityWeight,
      currentWeight: totalInwardWeight - totalSoldWeight - totalMortalityWeight,
      totalInwardValue,
      totalSoldValue,
      currentValue: totalInwardValue - totalSoldValue,
    };
  }

  /**
   * Chronological godown stock ledger with opening / running / closing balances.
   * Sources: inward (+), sales (−), godown returns (+/−), mortality (−).
   *
   * Processed godown bird returns reduce sale qty in DB; for ledger we restore
   * original sale qty and show RETURN rows so return birds are visible.
   */
  async getStockLedger(filters?: {
    startDate?: string;
    endDate?: string;
    godownId?: string;
    type?: string;
    search?: string;
  }) {
    const startDate = filters?.startDate || undefined;
    const endDate = filters?.endDate || undefined;
    const godownId = filters?.godownId && filters.godownId !== 'all' ? filters.godownId : undefined;
    const typeFilter = (filters?.type || 'all').toLowerCase();
    const search = (filters?.search || '').trim().toLowerCase();

    const tenantId = this.getTenantId();
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (godownId) where.godownId = godownId;

    const selectedGodown = godownId
      ? await this.godownRepo.findOne({ where: this.tenantWhere({ id: godownId }) })
      : null;

    const [inwards, sales, mortalities, birdReturns] = await Promise.all([
      this.inwardRepo.find({ where, relations: ['godown'], order: { entryDate: 'ASC', id: 'ASC' } }),
      this.saleRepo.find({ where, relations: ['godown'], order: { saleDate: 'ASC', id: 'ASC' } }),
      this.mortalityRepo.find({
        where,
        relations: ['godownInward', 'godown'],
        order: { mortalityDate: 'ASC', id: 'ASC' },
      }),
      this.birdReturnRepo.find({
        where: { ...(tenantId ? { tenantId } : {}), status: 'processed' },
        relations: ['sale', 'sale.godown'],
        order: { returnDate: 'ASC', id: 'ASC' },
      }),
    ]);

    type Movement = {
      date: string;
      createdAt: Date | string;
      sortId: string;
      movementType: 'INWARD' | 'SALE' | 'MORTALITY' | 'RETURN';
      referenceType: string;
      referenceId: string;
      referenceNo: string;
      godownId?: string | null;
      godownName?: string | null;
      party: string;
      purchaseInvoiceNo?: string;
      vehicleId?: string;
      birdsIn: number;
      birdsOut: number;
      weightIn: number;
      weightOut: number;
      ratePerKg?: number;
      amount?: number;
      notes?: string;
    };

    // Per-sale totals that were deducted when returns were processed
    const returnAdjustBySale = new Map<string, { birds: number; weight: number }>();
    for (const r of birdReturns) {
      if (godownId && String(r.sale?.godownId || '') !== String(godownId)) continue;
      const saleId = String(r.saleId);
      const prev = returnAdjustBySale.get(saleId) || { birds: 0, weight: 0 };
      prev.birds += Number(r.numberOfBirdsReturned) || 0;
      prev.weight += Number(r.weightReturned) || 0;
      returnAdjustBySale.set(saleId, prev);
    }

    const movements: Movement[] = [];

    for (const e of inwards) {
      movements.push({
        date: String(e.entryDate).slice(0, 10),
        createdAt: e.createdAt,
        sortId: `I-${e.id}`,
        movementType: 'INWARD',
        referenceType: 'Godown Inward',
        referenceId: String(e.id),
        referenceNo: e.inwardNo || `INW-${e.id}`,
        godownId: e.godownId || null,
        godownName: e.godown?.name || null,
        party: e.supplierName || '-',
        purchaseInvoiceNo: e.purchaseInvoiceNo,
        vehicleId: e.vehicleId,
        birdsIn: Number(e.numberOfBirds) || 0,
        birdsOut: 0,
        weightIn: Number(e.totalWeight) || 0,
        weightOut: 0,
        ratePerKg: e.ratePerKg != null ? Number(e.ratePerKg) : undefined,
        amount: e.totalAmount != null ? Number(e.totalAmount) : undefined,
        notes: e.notes,
      });
    }

    for (const s of sales) {
      const adj = returnAdjustBySale.get(String(s.id)) || { birds: 0, weight: 0 };
      // Restore original sold qty (returns had reduced sale.numberOfBirds)
      const birdsOut = (Number(s.numberOfBirds) || 0) + adj.birds;
      const weightOut = (Number(s.totalWeight) || 0) + adj.weight;
      movements.push({
        date: String(s.saleDate).slice(0, 10),
        createdAt: s.createdAt,
        sortId: `S-${s.id}`,
        movementType: 'SALE',
        referenceType: 'Godown Sale',
        referenceId: String(s.id),
        referenceNo: s.saleNo || s.invoiceNumber || `GDS-${s.id}`,
        godownId: s.godownId || null,
        godownName: s.godown?.name || null,
        party: s.customerName || '-',
        vehicleId: s.vehicleId,
        birdsIn: 0,
        birdsOut,
        weightIn: 0,
        weightOut,
        ratePerKg: s.ratePerKg != null ? Number(s.ratePerKg) : undefined,
        amount: s.totalAmount != null ? Number(s.totalAmount) : undefined,
        notes: adj.birds > 0
          ? `${s.notes || ''} | Includes ${adj.birds} birds later returned`.trim()
          : s.notes,
      });
    }

    for (const r of birdReturns) {
      if (godownId && String(r.sale?.godownId || '') !== String(godownId)) continue;
      const birds = Number(r.numberOfBirdsReturned) || 0;
      const weight = Number(r.weightReturned) || 0;
      const isDead = r.returnReason === 'dead';
      const toStock = !!r.returnedToInventory;
      // Birds come back from customer (+). If not restocked and not dead, they leave again (−).
      // Dead birds leave via mortality row (created on process).
      const birdsIn = birds;
      const birdsOut = !toStock && !isDead ? birds : 0;
      const weightIn = weight;
      const weightOut = !toStock && !isDead ? weight : 0;

      let noteParts = [
        `Reason: ${r.returnReason}`,
        toStock ? 'Restocked to godown' : isDead ? 'Dead — see mortality' : 'Not restocked',
        r.reasonDescription,
        r.notes,
      ].filter(Boolean);

      movements.push({
        date: String(r.returnDate).slice(0, 10),
        createdAt: r.createdAt || r.processedAt || new Date(),
        sortId: `R-${r.id}`,
        movementType: 'RETURN',
        referenceType: 'Godown Return',
        referenceId: String(r.id),
        referenceNo: r.returnNumber || `RET-${r.id}`,
        godownId: r.sale?.godownId || null,
        godownName: r.sale?.godown?.name || null,
        party: r.customerName || '-',
        birdsIn,
        birdsOut,
        weightIn,
        weightOut,
        amount: r.refundAmount != null ? Number(r.refundAmount) : undefined,
        notes: noteParts.join(' | '),
      });
    }

    for (const m of mortalities) {
      movements.push({
        date: String(m.mortalityDate).slice(0, 10),
        createdAt: m.createdAt,
        sortId: `M-${m.id}`,
        movementType: 'MORTALITY',
        referenceType: 'Godown Mortality',
        referenceId: String(m.id),
        referenceNo: m.godownInward?.inwardNo
          ? `MOR-${m.id} (${m.godownInward.inwardNo})`
          : `MOR-${m.id}`,
        godownId: m.godownId || null,
        godownName: m.godown?.name || null,
        party: m.reason || 'Mortality',
        birdsIn: 0,
        birdsOut: Number(m.numberOfBirdsDied) || 0,
        weightIn: 0,
        weightOut: Number(m.weightOfDeadBirds) || 0,
        notes: m.notes || m.reason,
      });
    }

    movements.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const ta = new Date(a.createdAt).getTime() || 0;
      const tb = new Date(b.createdAt).getTime() || 0;
      if (ta !== tb) return ta - tb;
      return a.sortId.localeCompare(b.sortId);
    });

    const start = startDate ? String(startDate).slice(0, 10) : undefined;
    const end = endDate ? String(endDate).slice(0, 10) : undefined;

    let openingBirds = 0;
    let openingWeight = 0;
    for (const m of movements) {
      if (start && m.date < start) {
        openingBirds += m.birdsIn - m.birdsOut;
        openingWeight += m.weightIn - m.weightOut;
      }
    }

    let periodMovements = movements.filter((m) => {
      if (start && m.date < start) return false;
      if (end && m.date > end) return false;
      return true;
    });

    if (typeFilter && typeFilter !== 'all') {
      periodMovements = periodMovements.filter(
        (m) => m.movementType.toLowerCase() === typeFilter,
      );
    }

    if (search) {
      periodMovements = periodMovements.filter((m) => {
        const hay = [
          m.referenceNo,
          m.party,
          m.purchaseInvoiceNo,
          m.notes,
          m.referenceType,
          m.movementType,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(search);
      });
    }

    let runningBirds = openingBirds;
    let runningWeight = openingWeight;
    let periodInBirds = 0;
    let periodOutBirds = 0;
    let periodInWeight = 0;
    let periodOutWeight = 0;
    let periodInAmount = 0;
    let periodOutAmount = 0;
    let soldBirds = 0;
    let soldWeight = 0;
    let mortalityBirds = 0;
    let mortalityWeight = 0;
    let returnBirdsIn = 0;
    let returnWeightIn = 0;

    const entries = periodMovements.map((m) => {
      runningBirds += m.birdsIn - m.birdsOut;
      runningWeight += m.weightIn - m.weightOut;
      periodInBirds += m.birdsIn;
      periodOutBirds += m.birdsOut;
      periodInWeight += m.weightIn;
      periodOutWeight += m.weightOut;
      if (m.birdsIn > 0) periodInAmount += m.amount || 0;
      if (m.birdsOut > 0) periodOutAmount += m.amount || 0;
      if (m.movementType === 'SALE') {
        soldBirds += m.birdsOut;
        soldWeight += m.weightOut;
      }
      if (m.movementType === 'MORTALITY') {
        mortalityBirds += m.birdsOut;
        mortalityWeight += m.weightOut;
      }
      if (m.movementType === 'RETURN') {
        returnBirdsIn += m.birdsIn;
        returnWeightIn += m.weightIn;
      }

      return {
        date: m.date,
        movementType: m.movementType,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        referenceNo: m.referenceNo,
        godownId: m.godownId || null,
        godownName: m.godownName || null,
        party: m.party,
        purchaseInvoiceNo: m.purchaseInvoiceNo || null,
        vehicleId: m.vehicleId || null,
        birdsIn: m.birdsIn,
        birdsOut: m.birdsOut,
        weightIn: Number(m.weightIn.toFixed(2)),
        weightOut: Number(m.weightOut.toFixed(2)),
        ratePerKg: m.ratePerKg ?? null,
        amount: m.amount ?? null,
        notes: m.notes || null,
        runningBirds,
        runningWeight: Number(runningWeight.toFixed(2)),
      };
    });

    return {
      godownId: selectedGodown?.id ?? null,
      godownName: selectedGodown?.name ?? null,
      startDate: start || null,
      endDate: end || null,
      opening: {
        birds: openingBirds,
        weight: Number(openingWeight.toFixed(2)),
      },
      period: {
        birdsIn: periodInBirds,
        birdsOut: periodOutBirds,
        weightIn: Number(periodInWeight.toFixed(2)),
        weightOut: Number(periodOutWeight.toFixed(2)),
        amountIn: Number(periodInAmount.toFixed(2)),
        amountOut: Number(periodOutAmount.toFixed(2)),
        soldBirds,
        soldWeight: Number(soldWeight.toFixed(2)),
        mortalityBirds,
        mortalityWeight: Number(mortalityWeight.toFixed(2)),
        returnBirds: returnBirdsIn,
        returnWeight: Number(returnWeightIn.toFixed(2)),
      },
      closing: {
        birds: runningBirds,
        weight: Number(runningWeight.toFixed(2)),
      },
      entries,
      totalEntries: entries.length,
    };
  }
}
