import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { GodownInwardEntry } from './godown-inward.entity';
import { GodownSale } from './entities/godown-sale.entity';
import { GodownSalePayment } from './entities/godown-sale-payment.entity';
import { GodownMortality } from './godown-mortality.entity';
import { GodownExpense } from './godown-expense.entity';
import { BirdReturn } from '../sales/entities/bird-return.entity';
import { Mortality } from '../mortality/mortality.entity';
import { CagesService } from '../cages/cages.service';
import { TenantContextService } from '../tenants/tenant-context.service';
import { normalizeToIST } from '../common/date-utils';

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
    @InjectRepository(BirdReturn)
    private birdReturnRepo: Repository<BirdReturn>,
    @InjectRepository(Mortality)
    private farmMortalityRepo: Repository<Mortality>,
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

  private n(v: any): number {
    const x = parseFloat(String(v ?? ''));
    return Number.isFinite(x) ? x : 0;
  }

  private round2(v: number): number {
    return Math.round((v + Number.EPSILON) * 100) / 100;
  }

  private ymd(value?: string | Date | null): string {
    if (!value) return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  }

  /** A weighed kg is present only when the value is a real number, including zero. */
  measuredKg(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const x = parseFloat(String(value));
    if (!Number.isFinite(x) || x < 0) return null;
    return x;
  }

  /** Expected inward kg = birds × that row's average weight. Recorded kg is only a fallback. */
  private inwardExpectedKg(e: {
    numberOfBirds?: number;
    averageWeight?: number;
    totalWeight?: number;
    actualWeight?: number;
  }): number {
    const birds = this.n(e.numberOfBirds);
    if (birds <= 0) return 0;
    const avg = this.n(e.averageWeight);
    if (avg > 0) return birds * avg;
    const recorded = this.measuredKg(e.totalWeight) ?? this.measuredKg(e.actualWeight);
    return recorded != null && recorded > 0 ? recorded : 0;
  }

  /** Kg actually weighed at inward. Missing scale weight stays missing. */
  private inwardWeighedKg(e: {
    actualWeight?: number | null;
    totalWeight?: number | null;
  }): number | null {
    const actual = this.measuredKg(e.actualWeight);
    if (actual != null) return actual;
    return this.measuredKg(e.totalWeight);
  }

  private inwardLineRate(e: { ratePerKg?: number; totalAmount?: number }, expectedKg: number): number | null {
    const rate = this.measuredKg(e.ratePerKg);
    if (rate != null && rate > 0) return rate;
    const amount = this.measuredKg(e.totalAmount);
    if (amount != null && amount > 0 && expectedKg > 0) return amount / expectedKg;
    return null;
  }

  /**
   * Bird-weighted average weight and expected-kg-weighted average inward rate.
   * Rows after asOnDate are ignored.
   */
  inwardAverages(
    entries: Array<{
      entryDate?: string | Date;
      numberOfBirds?: number;
      averageWeight?: number;
      totalWeight?: number;
      actualWeight?: number;
      ratePerKg?: number;
      totalAmount?: number;
    }>,
    asOnDate?: string,
  ) {
    const end = asOnDate ? this.ymd(asOnDate) : '';
    let birds = 0;
    let expectedKg = 0;
    let rateKg = 0;
    let rateValue = 0;
    for (const e of entries) {
      const rowDate = this.ymd(e.entryDate);
      if (end && (!rowDate || rowDate > end)) continue;
      const rowBirds = this.n(e.numberOfBirds);
      if (rowBirds <= 0) continue;
      const kg = this.inwardExpectedKg(e);
      const rate = this.inwardLineRate(e, kg);
      birds += rowBirds;
      expectedKg += kg;
      if (rate != null && rate > 0 && kg > 0) {
        rateKg += kg;
        rateValue += kg * rate;
      }
    }
    return {
      birds,
      expectedKg: this.round2(expectedKg),
      avgWeight: birds > 0 && expectedKg > 0 ? expectedKg / birds : 0,
      avgRate: rateKg > 0 ? rateValue / rateKg : 0,
      value: this.round2(rateValue),
    };
  }

  async getInwardAverages(asOnDate?: string) {
    const where: any = {};
    const tenantId = this.getTenantId();
    if (tenantId) where.tenantId = tenantId;
    const entries = await this.inwardRepo.find({ where });
    return this.inwardAverages(entries, asOnDate);
  }

  /**
   * Birds sold in the period. Processed returns already reduce sale.numberOfBirds.
   * A return outside the window is added back so that period does not drop birds
   * that were still sold, and a return inside the window is not counted twice.
   */
  async countGodownSoldBirds(startDate?: string, endDate?: string): Promise<number> {
    const tenantId = this.getTenantId();
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    const [sales, returns] = await Promise.all([
      this.saleRepo.find({ where }),
      this.birdReturnRepo.find({ where: tenantId ? { tenantId, status: 'processed' } : { status: 'processed' } }),
    ]);
    const start = startDate ? this.ymd(startDate) : '';
    const end = endDate ? this.ymd(endDate) : '';
    let birds = 0;
    for (const sale of sales) {
      const saleDate = this.ymd(sale.saleDate);
      if (!saleDate) continue;
      if (start && saleDate < start) continue;
      if (end && saleDate > end) continue;
      let count = this.n(sale.numberOfBirds);
      for (const ret of returns) {
        if (String(ret.saleId) !== String(sale.id)) continue;
        const returnDate = this.ymd(ret.returnDate);
        if (!returnDate) continue;
        const outside = (end && returnDate > end) || (start && returnDate < start);
        if (outside) count += this.n(ret.numberOfBirdsReturned);
      }
      birds += count;
    }
    return birds;
  }

  /** Stock kg = birds × shared inward average weight. */
  private stockKg(birds: number, avgKgPerBird: number): number {
    const b = this.n(birds);
    if (b > 0 && avgKgPerBird > 0) return this.round2(b * avgKgPerBird);
    return 0;
  }

  /** Kg written on the inward. Expected kg is only used when nothing was weighed. */
  private inwardDocumentKg(e: {
    numberOfBirds?: number;
    averageWeight?: number;
    totalWeight?: number;
    actualWeight?: number;
  }): number {
    const recorded = this.measuredKg(e.totalWeight) ?? this.measuredKg(e.actualWeight);
    if (recorded != null && recorded > 0) return this.round2(recorded);
    return this.round2(this.inwardExpectedKg(e));
  }

  /**
   * Same kg the Godown Sale screen shows: Number(sale.totalWeight).
   * Do not replace it with birds × average.
   */
  private saleDocumentKg(sale: { totalWeight?: number | null }): number {
    return this.round2(this.n(sale.totalWeight));
  }

  /** Kg written on the return. A missing return kg falls back to stock kg. */
  private returnDocumentKg(weightReturned: unknown, birds: number, avgKgPerBird: number): number {
    const recorded = this.measuredKg(weightReturned);
    if (recorded != null && recorded > 0) return this.round2(recorded);
    return this.stockKg(birds, avgKgPerBird);
  }

  /**
   * Shrinkage against a real scale weight. Missing weight is null, not a verified 0 kg loss.
   * A recorded 0 kg is a real measurement.
   */
  shrinkageKg(stockKg: number, weighedKg: number | null): number | null {
    if (weighedKg == null || !Number.isFinite(weighedKg)) return null;
    return Math.max(0, this.round2(this.n(stockKg) - weighedKg));
  }

  /**
   * Period weighted average of opening inventory plus new inward stock.
   * Returns 0 when there is no weight, so callers can fall back to the pool rate.
   */
  weightedAverageRate(
    openingWeight: number,
    openingValue: number,
    inwardWeight: number,
    inwardValue: number,
  ): number {
    const weight = this.n(openingWeight) + this.n(inwardWeight);
    const value = this.n(openingValue) + this.n(inwardValue);
    if (weight <= 0) return 0;
    return value / weight;
  }

  /**
   * Godown weight loss for a date range, from stock movement — not from each inward bill.
   *
   * Opening + Inward + returns in − sold − mortality − returns out − closing.
   * Mortality and returns are known movements, so they are not called weight loss.
   * A negative result is a discrepancy, not weight loss.
   * Sold kg is the billed sale weight; a sale with no weight uses its stock kg and is flagged.
   */
  reconcileGodownWeight(input: {
    openingWeight: number;
    inwardWeight: number;
    returnWeightIn?: number;
    soldWeight: number;
    mortalityWeight?: number;
    returnWeightOut?: number;
    closingWeight: number;
    rate?: number;
    unmeasuredSaleCount?: number;
    negativeStock?: boolean;
  }) {
    const openingWeight = this.round2(this.n(input.openingWeight));
    const inwardWeight = this.round2(this.n(input.inwardWeight));
    const returnWeightIn = this.round2(this.n(input.returnWeightIn));
    const soldWeight = this.round2(this.n(input.soldWeight));
    const mortalityWeight = this.round2(this.n(input.mortalityWeight));
    const returnWeightOut = this.round2(this.n(input.returnWeightOut));
    const closingWeight = this.round2(this.n(input.closingWeight));
    const availableWeight = this.round2(openingWeight + inwardWeight);
    const literalDifference = this.round2(availableWeight - soldWeight - closingWeight);
    const raw = this.round2(
      openingWeight + inwardWeight + returnWeightIn - soldWeight - mortalityWeight - returnWeightOut - closingWeight,
    );
    const weightLoss = raw > 0 ? raw : 0;
    const discrepancyKg = raw < 0 ? raw : 0;
    const unmeasuredSaleCount = this.n(input.unmeasuredSaleCount);
    const negativeStock = !!input.negativeStock;
    const flagged = discrepancyKg < 0 || unmeasuredSaleCount > 0 || negativeStock;
    const notes: string[] = [];
    if (discrepancyKg < 0) {
      notes.push('Sold, mortality, returns, or closing exceed available stock. The negative difference is not weight loss.');
    }
    if (unmeasuredSaleCount > 0) {
      notes.push(`${unmeasuredSaleCount} sale(s) have no billed kg, so their stock kg was used and that gap is not treated as a measured loss.`);
    }
    if (negativeStock) {
      notes.push('A movement drove bird stock below zero. Check sales against available birds.');
    }
    if (!notes.length) {
      notes.push('Weight loss = opening + inward + returns in − sold − mortality − returns out − closing.');
    }
    const rate = this.round2(this.n(input.rate));
    const weightLossPercent = availableWeight > 0 ? this.round2((weightLoss / availableWeight) * 100) : 0;
    return {
      openingWeight,
      inwardWeight,
      returnWeightIn,
      soldWeight,
      mortalityWeight,
      returnWeightOut,
      closingWeight,
      availableWeight,
      literalDifference,
      rawDifference: raw,
      weightLoss,
      discrepancyKg,
      weightLossPercent,
      averageRate: rate,
      weightLossCost: this.round2(weightLoss * rate),
      unmeasuredSaleCount,
      negativeStock,
      flagged,
      note: notes.join(' '),
    };
  }

  private dayBeforeYmd(ymd: string): string {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    dt.setDate(dt.getDate() - 1);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  /** Line average kg/bird. Document average wins; otherwise the shared inward average. */
  private movementAvgWeight(
    m: { averageWeight?: number | null; birdsIn: number; birdsOut: number },
    sharedAvg: number,
  ): number | null {
    const own = this.measuredKg(m.averageWeight);
    if (own != null && own > 0) return this.round2(own);
    const birds = m.birdsIn || m.birdsOut;
    if (birds > 0 && sharedAvg > 0) return this.round2(sharedAvg);
    return null;
  }

  private movementWeighedKg(m: {
    movementType: string;
    weighedKg?: number | null;
    billedKg?: number | null;
  }): number | null {
    if (m.movementType === 'SALE') return m.billedKg ?? null;
    if (m.movementType === 'INWARD' || m.movementType === 'MORTALITY') return m.weighedKg ?? null;
    return null;
  }

  private movementWeightLoss(m: {
    movementType: string;
    weightIn: number;
    weightOut: number;
    weighedKg?: number | null;
    billedKg?: number | null;
  }): number | null {
    if (m.movementType === 'INWARD') return this.shrinkageKg(m.weightIn, m.weighedKg ?? null);
    if (m.movementType === 'SALE') return this.shrinkageKg(m.weightOut, m.billedKg ?? null);
    if (m.movementType === 'MORTALITY') return this.shrinkageKg(m.weightOut, m.weighedKg ?? null);
    return null;
  }

  // ─── Inward Entries ───────────────────────────────────────────────────────

  async createInward(data: any) {
    const { cageIds, cages, godownInwardWeight, actualWeight, weightLoss, ...entryData } = data;

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

    await this.persistComputedInwardLoss(savedId);
    return this.findOneInward(savedId);
  }

  async findAllInward(page?: number, limit?: number, search?: string) {
    const query = this.inwardRepo.createQueryBuilder('inward')
      .orderBy('inward.entryDate', 'DESC');

    this.applyTenant(query, 'inward');

    if (search) {
      query.andWhere(
        '(inward.farmerName ILIKE :search OR inward.vehicleNumber ILIKE :search OR inward.farmHouseName ILIKE :search OR inward.inwardNo ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (page && limit) {
      const skip = (page - 1) * limit;
      const [data, total] = await query.skip(skip).take(limit).getManyAndCount();
      return { data, total, page, limit };
    }

    return query.getMany();
  }

  async findOneInward(id: string) {
    const entry = await this.inwardRepo.findOne({ where: this.tenantWhere({ id }) });
    if (!entry) return null;

    const linkedCages = await this.cagesService.getByGodownInwardId(id);
    return {
      ...entry,
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

    await this.persistComputedInwardLoss(id);
    return this.findOneInward(id);
  }

  private async persistComputedInwardLoss(inwardId: string) {
    const cages = await this.cagesService.getByGodownInwardId(inwardId);
    if (!cages.length) return;
    const purchaseWeight = cages.reduce((sum, c) => sum + (parseFloat(String(c.purchaseWeight || 0)) || 0), 0);
    const actualWeight = cages.reduce((sum, c) => {
      const godownWt = c.godownInwardWeight != null ? parseFloat(String(c.godownInwardWeight)) : parseFloat(String(c.purchaseWeight || 0));
      return sum + (Number.isFinite(godownWt) ? godownWt : 0);
    }, 0);
    const weightLoss = Math.max(0, Math.round((purchaseWeight - actualWeight) * 100) / 100);
    await this.inwardRepo.update(inwardId, {
      weightLoss,
      actualWeight: Math.round(actualWeight * 100) / 100,
    });
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

    const qb = this.saleRepo
      .createQueryBuilder('sale')
      .select(['sale.id', 'sale.saleNo', 'sale.invoiceNumber'])
      .where('(sale.saleNo LIKE :prefix OR sale.invoiceNumber LIKE :prefix)', { prefix: `${prefix}%` });
    this.applyTenant(qb, 'sale');
    const rows = await qb.getMany();

    let max = 0;
    for (const row of rows) {
      for (const value of [row.saleNo, row.invoiceNumber]) {
        if (!value || !String(value).startsWith(prefix)) continue;
        const n = parseInt(String(value).slice(prefix.length), 10);
        if (Number.isFinite(n) && n > max) max = n;
      }
    }

    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  }

  async generateNextSaleNumber(): Promise<string> {
    return this.generateSaleNumber();
  }

  private async assertGodownBirdsAvailable(requestedBirds: number, excludeSaleId?: string) {
    const requested = Math.floor(Number(requestedBirds) || 0);
    if (requested <= 0) {
      throw new BadRequestException('Number of birds must be greater than 0');
    }

    const summary = await this.getSummary();
    let available = Number(summary.currentStock) || 0;
    if (excludeSaleId) {
      const existing = await this.findOneSale(excludeSaleId);
      available += Number(existing?.numberOfBirds) || 0;
    }

    if (available <= 0) {
      throw new BadRequestException('Cannot record sale. Godown has 0 birds in stock.');
    }
    if (requested > available) {
      throw new BadRequestException(
        `Cannot sell ${requested} birds. Only ${available} birds available in godown.`,
      );
    }
  }

  private pickSaleColumns(data: any) {
    const keys = [
      'saleDate',
      'saleNo',
      'invoiceNumber',
      'customerName',
      'retailerId',
      'vehicleId',
      'numberOfBirds',
      'averageWeight',
      'totalWeight',
      'ratePerKg',
      'totalAmount',
      'paymentStatus',
      'weightLoss',
      'paymentMode',
      'amountReceived',
      'notes',
    ] as const;
    const out: Record<string, any> = {};
    for (const key of keys) {
      if (data[key] !== undefined && data[key] !== '') {
        out[key] = data[key];
      }
    }
    return out;
  }

  private rethrowSaveError(error: any): never {
    const pg = error?.driverError ?? error;
    const message =
      pg?.detail ||
      pg?.message ||
      error?.message ||
      'Failed to save sale';
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException(message);
  }

  async createSale(data: any) {
    const { payments, weightLoss, ...rest } = data;
    const saleData = this.pickSaleColumns(rest);
    if (saleData.saleDate) {
      saleData.saleDate = normalizeToIST(String(saleData.saleDate));
    }

    await this.assertGodownBirdsAvailable(saleData.numberOfBirds);

    const providedNumber = String(saleData.saleNo || saleData.invoiceNumber || '').trim();
    let saleNumber = providedNumber;
    if (!saleNumber) {
      for (let i = 0; i < 5; i++) {
        const candidate = await this.generateSaleNumber();
        const clash = await this.saleRepo.findOne({
          where: [
            this.tenantWhere({ saleNo: candidate }),
            this.tenantWhere({ invoiceNumber: candidate }),
          ],
        });
        if (!clash) {
          saleNumber = candidate;
          break;
        }
      }
    }
    if (!saleNumber) {
      throw new BadRequestException('Could not generate a sale number. Please try again.');
    }

    const existingNumber = await this.saleRepo.findOne({
      where: [
        this.tenantWhere({ saleNo: saleNumber }),
        this.tenantWhere({ invoiceNumber: saleNumber }),
      ],
    });
    if (existingNumber) {
      throw new BadRequestException(`Sale ${saleNumber} already exists`);
    }

    saleData.saleNo = saleNumber;
    saleData.invoiceNumber = saleNumber;

    if (weightLoss) {
      saleData.weightLoss = parseFloat(weightLoss);
    }

    // Calculate total payment made from payments array
    const totalPaymentMade = (payments || []).reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0);
    saleData.amountReceived = totalPaymentMade;

    try {
      const insertPayload = {
        ...saleData,
        tenantId: this.getTenantId() ?? undefined,
      };
      const insertResult = await this.saleRepo.insert(insertPayload);
      const savedId: string = String(insertResult.identifiers?.[0]?.id);

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
    } catch (error: any) {
      this.rethrowSaveError(error);
    }
  }

  async findAllSales(page?: number, limit?: number, search?: string) {
    const query = this.saleRepo.createQueryBuilder('sale')
      .leftJoinAndSelect('sale.payments', 'payments')
      .orderBy('sale.saleDate', 'DESC');

    this.applyTenant(query, 'sale');

    if (search) {
      query.andWhere(
        '(sale.retailerName ILIKE :search OR sale.saleNo ILIKE :search OR sale.vehicleNumber ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (page && limit) {
      const skip = (page - 1) * limit;
      const [data, total] = await query.skip(skip).take(limit).getManyAndCount();
      return { data, total, page, limit };
    }

    return query.getMany();
  }

  async findOneSale(id: string) {
    return this.saleRepo.findOne({
      where: this.tenantWhere({ id }),
      relations: ['payments']
    });
  }

  async updateSale(id: string, data: any) {
    const { payments, weightLoss, ...rest } = data;
    const validData = this.pickSaleColumns(rest);
    if (validData.saleDate) {
      validData.saleDate = normalizeToIST(String(validData.saleDate));
    }
    if (weightLoss !== undefined && weightLoss !== '') {
      validData.weightLoss = parseFloat(weightLoss);
    }

    const requestedBirds =
      validData.numberOfBirds !== undefined
        ? validData.numberOfBirds
        : (await this.findOneSale(id))?.numberOfBirds;
    await this.assertGodownBirdsAvailable(requestedBirds, id);

    try {
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

      if (Object.keys(validData).length > 0) {
        await this.saleRepo
          .createQueryBuilder()
          .update(GodownSale)
          .set(validData)
          .where('id = :id', { id })
          .execute();
      }
      return this.findOneSale(id);
    } catch (error: any) {
      this.rethrowSaveError(error);
    }
  }

  async removeSale(id: string) {
    await this.saleRepo.delete(id);
  }

  // ─── Mortality ────────────────────────────────────────────────────────────

  async createMortality(data: Partial<GodownMortality>) {
    const mortality = this.mortalityRepo.create({ ...data, tenantId: this.getTenantId() ?? undefined });
    return this.mortalityRepo.save(mortality);
  }

  async findAllMortality(page?: number, limit?: number, search?: string) {
    const query = this.mortalityRepo.createQueryBuilder('mortality')
      .leftJoinAndSelect('mortality.godownInward', 'godownInward')
      .orderBy('mortality.mortalityDate', 'DESC');

    this.applyTenant(query, 'mortality');

    if (search) {
      query.andWhere(
        '(godownInward.farmerName ILIKE :search OR mortality.reason ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (page && limit) {
      const skip = (page - 1) * limit;
      const [data, total] = await query.skip(skip).take(limit).getManyAndCount();
      return { data, total, page, limit };
    }

    return query.getMany();
  }

  async findOneMortality(id: string) {
    return this.mortalityRepo.findOne({ where: this.tenantWhere({ id }), relations: ['godownInward'] });
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
    const expense = this.expenseRepo.create({ ...data, tenantId: this.getTenantId() ?? undefined });
    return this.expenseRepo.save(expense);
  }

  async findAllExpenses(page?: number, limit?: number, search?: string, startDate?: string, endDate?: string) {
    const query = this.expenseRepo.createQueryBuilder('expense')
      .orderBy('expense.expenseDate', 'DESC');

    this.applyTenant(query, 'expense');

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
      return { data, total, page, limit };
    }

    return query.getMany();
  }

  async findOneExpense(id: string) {
    return this.expenseRepo.findOne({ where: this.tenantWhere({ id }) });
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
    const inwardQuery = this.inwardRepo
      .createQueryBuilder('entry')
      .select([
        'SUM(entry.numberOfBirds) AS birds',
        'SUM(COALESCE(entry.totalWeight, entry.actualWeight, COALESCE(entry.numberOfBirds, 0) * COALESCE(entry.averageWeight, 0))) AS weight',
        'SUM(COALESCE(NULLIF(entry.totalAmount, 0), COALESCE(entry.totalWeight, entry.actualWeight, 0) * COALESCE(entry.ratePerKg, 0))) AS value',
      ]);
    this.applyTenant(inwardQuery, 'entry');
    const inward = await inwardQuery.getRawOne();

    const soldQuery = this.saleRepo
      .createQueryBuilder('sale')
      .select([
        'SUM(sale.numberOfBirds) AS birds',
        'SUM(sale.totalWeight) AS weight',
        'SUM(sale.totalAmount) AS value',
      ]);
    this.applyTenant(soldQuery, 'sale');
    const sold = await soldQuery.getRawOne();

    const mortalityQuery = this.mortalityRepo
      .createQueryBuilder('mortality')
      .select([
        'SUM(mortality.numberOfBirdsDied) AS birds',
        'SUM(mortality.weightOfDeadBirds) AS weight',
      ]);
    this.applyTenant(mortalityQuery, 'mortality');
    const mortality = await mortalityQuery.getRawOne();

    const totalInwardBirds = parseFloat(inward.birds) || 0;
    const totalInwardWeight = parseFloat(inward.weight) || 0;
    const totalInwardValue = parseFloat(inward.value) || 0;
    const totalSoldBirds = parseFloat(sold.birds) || 0;
    const totalSoldValue = parseFloat(sold.value) || 0;
    const totalMortalityBirds = parseFloat(mortality.birds) || 0;

    const returnsQuery = this.birdReturnRepo
      .createQueryBuilder('ret')
      .select([
        'SUM(ret.numberOfBirdsReturned) AS birds',
        'SUM(ret.weightReturned) AS weight',
      ])
      .where("ret.status IN ('processed', 'approved', 'pending')");
    this.applyTenant(returnsQuery, 'ret');
    const returns = await returnsQuery.getRawOne();

    const totalReturnBirds = parseFloat(returns?.birds) || 0;

    // Live availability must match stock ledger closing (inward − sales + returns − mortality).
    const [ledger, averages] = await Promise.all([
      this.getStockLedger(),
      this.getInwardAverages(),
    ]);
    const currentStock = Math.max(0, Number(ledger?.closing?.birds) || 0);
    const avgKgPerBird = averages.avgWeight > 0
      ? averages.avgWeight
      : (totalInwardBirds > 0 && totalInwardWeight > 0 ? totalInwardWeight / totalInwardBirds : 0);
    const inwardRate = averages.avgRate > 0
      ? averages.avgRate
      : (averages.expectedKg > 0 && averages.value > 0 ? averages.value / averages.expectedKg : 0);
    const stockInwardWeight = averages.expectedKg > 0 ? averages.expectedKg : totalInwardWeight;
    const stockInwardValue = averages.value > 0 ? averages.value : totalInwardValue;
    // Leftover kg = leftover birds × average weight. Value = that kg × average rate.
    const currentWeight = currentStock <= 0
      ? 0
      : avgKgPerBird > 0
        ? Math.round(currentStock * avgKgPerBird * 100) / 100
        : Math.max(0, Number(ledger?.closing?.weight) || 0);
    const currentValue = Math.max(0, Math.round(currentWeight * inwardRate * 100) / 100);

    return {
      totalInward: totalInwardBirds,
      totalSold: totalSoldBirds,
      totalMortality: totalMortalityBirds,
      totalReturns: totalReturnBirds,
      currentStock,
      totalInwardWeight: stockInwardWeight,
      totalSoldWeight: this.round2(this.n(ledger?.period?.soldWeight)),
      totalMortalityWeight: this.round2(this.n(ledger?.period?.mortalityWeight)),
      totalReturnWeight: this.round2(this.n(ledger?.period?.returnWeight)),
      currentWeight,
      totalInwardValue: stockInwardValue,
      totalSoldValue,
      currentValue,
      avgWeight: this.round2(avgKgPerBird),
      avgRate: this.round2(inwardRate),
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
    type?: string;
    search?: string;
  }) {
    const startDate = filters?.startDate || undefined;
    const endDate = filters?.endDate || undefined;
    const typeFilter = (filters?.type || 'all').toLowerCase();
    const search = (filters?.search || '').trim().toLowerCase();

    const tenantId = this.getTenantId();
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;

    const [inwards, sales, mortalities, farmMortalities, birdReturns] = await Promise.all([
      this.inwardRepo.find({ where, order: { entryDate: 'ASC', id: 'ASC' } }),
      this.saleRepo.find({ where, order: { saleDate: 'ASC', id: 'ASC' } }),
      this.mortalityRepo.find({
        where,
        relations: ['godownInward'],
        order: { mortalityDate: 'ASC', id: 'ASC' },
      }),
      this.farmMortalityRepo.find({
        where: tenantId ? { tenantId, source: 'godown' } : { source: 'godown' },
        order: { purchaseDate: 'ASC', id: 'ASC' },
      }),
      this.birdReturnRepo.find({
        where: tenantId
          ? [
              { tenantId, status: 'processed' },
              { tenantId, status: 'approved' },
              { tenantId, status: 'pending' },
            ]
          : [
              { status: 'processed' },
              { status: 'approved' },
              { status: 'pending' },
            ],
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
      party: string;
      purchaseInvoiceNo?: string;
      vehicleId?: string;
      birdsIn: number;
      birdsOut: number;
      weightIn: number;
      weightOut: number;
      stockWeightIn: number;
      stockWeightOut: number;
      ratePerKg?: number;
      amount?: number;
      notes?: string;
      affectsStock?: boolean;
      billedKg?: number | null;
      weighedKg?: number | null;
      averageWeight?: number | null;
      costKg?: number;
      costValue?: number;
    };

    // Per-sale totals that were deducted when returns were processed
    const returnAdjustBySale = new Map<string, { birds: number; weight: number }>();
    for (const r of birdReturns) {
      if (r.status !== 'processed') continue;
      const saleId = String(r.saleId);
      const prev = returnAdjustBySale.get(saleId) || { birds: 0, weight: 0 };
      prev.birds += Number(r.numberOfBirdsReturned) || 0;
      prev.weight += Number(r.weightReturned) || 0;
      returnAdjustBySale.set(saleId, prev);
    }

    const endLimit = endDate ? (this.ymd(endDate) || undefined) : undefined;
    const averages = this.inwardAverages(inwards, endLimit);
    const avgKgPerBird = averages.avgWeight;
    const avgRate = averages.avgRate;

    const movements: Movement[] = [];

    for (const e of inwards) {
      const expectedKg = this.inwardExpectedKg(e);
      const lineRate = this.inwardLineRate(e, expectedKg);
      const costValue = lineRate != null && expectedKg > 0 ? expectedKg * lineRate : this.n(e.totalAmount);
      movements.push({
        date: this.ymd(e.entryDate),
        createdAt: e.createdAt,
        sortId: `I-${e.id}`,
        movementType: 'INWARD',
        referenceType: 'Godown Inward',
        referenceId: String(e.id),
        referenceNo: e.inwardNo || `INW-${e.id}`,
        party: e.supplierName || '-',
        purchaseInvoiceNo: e.purchaseInvoiceNo,
        vehicleId: e.vehicleId,
        birdsIn: this.n(e.numberOfBirds),
        birdsOut: 0,
        weightIn: this.inwardDocumentKg(e),
        weightOut: 0,
        stockWeightIn: this.stockKg(this.n(e.numberOfBirds), avgKgPerBird),
        stockWeightOut: 0,
        weighedKg: this.inwardWeighedKg(e),
        averageWeight: this.measuredKg(e.averageWeight),
        ratePerKg: e.ratePerKg != null ? Number(e.ratePerKg) : undefined,
        amount: e.totalAmount != null ? Number(e.totalAmount) : undefined,
        costKg: expectedKg,
        costValue,
        notes: e.notes,
      });
    }

    for (const s of sales) {
      const adj = returnAdjustBySale.get(String(s.id)) || { birds: 0, weight: 0 };
      const birdsOut = this.n(s.numberOfBirds) + adj.birds;
      const billedKg = this.measuredKg(s.totalWeight);
      const weightOut = this.saleDocumentKg(s);
      movements.push({
        date: this.ymd(s.saleDate),
        createdAt: s.createdAt,
        sortId: `S-${s.id}`,
        movementType: 'SALE',
        referenceType: 'Godown Sale',
        referenceId: String(s.id),
        referenceNo: s.saleNo || s.invoiceNumber || `GDS-${s.id}`,
        party: s.customerName || '-',
        vehicleId: s.vehicleId,
        birdsIn: 0,
        birdsOut,
        weightIn: 0,
        weightOut,
        stockWeightIn: 0,
        stockWeightOut: this.stockKg(birdsOut, avgKgPerBird),
        ratePerKg: s.ratePerKg != null ? Number(s.ratePerKg) : undefined,
        averageWeight: weightOut > 0 && birdsOut > 0
          ? this.round2(weightOut / birdsOut)
          : this.measuredKg(s.averageWeight),
        amount: s.totalAmount != null ? Number(s.totalAmount) : undefined,
        notes: adj.birds > 0
          ? `${s.notes || ''} | Includes ${adj.birds} birds later returned`.trim()
          : s.notes,
        billedKg,
      });
    }

    for (const r of birdReturns) {
      const birds = this.n(r.numberOfBirdsReturned);
      const stockWeight = this.stockKg(birds, avgKgPerBird);
      const weight = this.returnDocumentKg(r.weightReturned, birds, avgKgPerBird);
      const isDead = r.returnReason === 'dead';
      const toStock = !!r.returnedToInventory;
      const processed = r.status === 'processed';
      const birdsOut = processed && !toStock && !isDead ? birds : 0;
      const weightOut = processed && !toStock && !isDead ? weight : 0;

      const noteParts = [
        r.status !== 'processed' ? `Status: ${r.status} (not yet processed)` : null,
        `Reason: ${r.returnReason}`,
        toStock ? 'Restocked to godown' : isDead ? 'Dead — see mortality' : 'Not restocked',
        r.reasonDescription,
        r.notes,
      ].filter(Boolean);

      movements.push({
        date: this.ymd(r.returnDate),
        createdAt: r.createdAt || r.processedAt || new Date(),
        sortId: `R-${r.id}`,
        movementType: 'RETURN',
        referenceType: 'Godown Return',
        referenceId: String(r.id),
        referenceNo: r.returnNumber || `RET-${r.id}`,
        party: r.customerName || '-',
        birdsIn: birds,
        birdsOut,
        weightIn: weight,
        weightOut,
        stockWeightIn: stockWeight,
        stockWeightOut: birdsOut > 0 ? stockWeight : 0,
        amount: r.refundAmount != null ? Number(r.refundAmount) : undefined,
        notes: noteParts.join(' | '),
        affectsStock: processed,
      });
    }

    const processedGodownMortalityIds = new Set(mortalities.map((m) => String(m.id)));

    for (const m of mortalities) {
      const birdsOut = this.n(m.numberOfBirdsDied);
      const recordedKg = this.measuredKg(m.weightOfDeadBirds);
      movements.push({
        date: this.ymd(m.mortalityDate),
        createdAt: m.createdAt,
        sortId: `M-${m.id}`,
        movementType: 'MORTALITY',
        referenceType: 'Godown Mortality',
        referenceId: String(m.id),
        referenceNo: m.godownInward?.inwardNo
          ? `MOR-${m.id} (${m.godownInward.inwardNo})`
          : `MOR-${m.id}`,
        party: m.reason || 'Mortality',
        birdsIn: 0,
        birdsOut,
        weightIn: 0,
        weightOut: this.stockKg(birdsOut, avgKgPerBird),
        stockWeightIn: 0,
        stockWeightOut: this.stockKg(birdsOut, avgKgPerBird),
        weighedKg: recordedKg ?? undefined,
        notes: m.notes || m.reason,
      });
    }

    for (const m of farmMortalities) {
      if (m.godownMortalityId && processedGodownMortalityIds.has(String(m.godownMortalityId))) continue;
      const birdsOut = this.n(m.numberOfBirdsDied);
      const recordedKg = this.measuredKg(m.weightOfDeadBirds);
      movements.push({
        date: this.ymd(m.purchaseDate || m.createdAt),
        createdAt: m.createdAt,
        sortId: `FM-${m.id}`,
        movementType: 'MORTALITY',
        referenceType: 'Godown Mortality',
        referenceId: String(m.id),
        referenceNo: m.recordNumber || `MRT-${m.id}`,
        party: m.cause || 'Mortality',
        birdsIn: 0,
        birdsOut,
        weightIn: 0,
        weightOut: this.stockKg(birdsOut, avgKgPerBird),
        stockWeightIn: 0,
        stockWeightOut: this.stockKg(birdsOut, avgKgPerBird),
        weighedKg: recordedKg ?? undefined,
        notes: m.notes || m.cause,
      });
    }

    movements.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const ta = new Date(a.createdAt).getTime() || 0;
      const tb = new Date(b.createdAt).getTime() || 0;
      if (ta !== tb) return ta - tb;
      return a.sortId.localeCompare(b.sortId);
    });

    const start = startDate ? (this.ymd(startDate) || undefined) : undefined;
    const end = endDate ? (this.ymd(endDate) || undefined) : undefined;

    let openingBirds = 0;
    let openingWeight = 0;
    for (const m of movements) {
      if (m.affectsStock === false) continue;
      if (start && m.date < start) {
        openingBirds += m.birdsIn - m.birdsOut;
        openingWeight += m.stockWeightIn - m.stockWeightOut;
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
    let soldStockWeight = 0;
    let mortalityBirds = 0;
    let mortalityWeight = 0;
    let returnBirdsIn = 0;
    let returnWeightIn = 0;
    let returnWeightOut = 0;
    let returnStockIn = 0;
    let returnStockOut = 0;
    let inwardBirds = 0;
    let inwardKg = 0;
    let inwardStockKg = 0;
    let billedSaleWeight = 0;

    const entries = periodMovements.map((m) => {
      if (m.affectsStock !== false) {
        runningBirds += m.birdsIn - m.birdsOut;
        runningWeight += m.stockWeightIn - m.stockWeightOut;
        periodInBirds += m.birdsIn;
        periodOutBirds += m.birdsOut;
        periodInWeight += m.weightIn;
        periodOutWeight += m.weightOut;
        if (m.birdsIn > 0) periodInAmount += m.amount || 0;
        if (m.birdsOut > 0) periodOutAmount += m.amount || 0;
        if (m.movementType === 'SALE') {
          soldBirds += m.birdsOut;
          soldWeight += m.weightOut;
          soldStockWeight += m.stockWeightOut;
          if (m.billedKg != null) billedSaleWeight += m.billedKg;
        }
        if (m.movementType === 'MORTALITY') {
          mortalityBirds += m.birdsOut;
          mortalityWeight += m.stockWeightOut;
        }
        if (m.movementType === 'INWARD') {
          inwardBirds += m.birdsIn;
          inwardKg += m.weightIn;
          inwardStockKg += m.stockWeightIn;
        }
      }
      if (m.movementType === 'RETURN') {
        returnBirdsIn += m.birdsIn;
        returnWeightIn += m.weightIn;
        returnWeightOut += m.weightOut;
        if (m.affectsStock !== false) {
          returnStockIn += m.stockWeightIn;
          returnStockOut += m.stockWeightOut;
        }
      }

      return {
        date: m.date,
        movementType: m.movementType,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        referenceNo: m.referenceNo,
        party: m.party,
        purchaseInvoiceNo: m.purchaseInvoiceNo || null,
        vehicleId: m.vehicleId || null,
        birdsIn: m.birdsIn,
        birdsOut: m.birdsOut,
        weightIn: Number(m.weightIn.toFixed(2)),
        weightOut: Number(m.weightOut.toFixed(2)),
        ratePerKg: m.ratePerKg ?? null,
        amount: m.amount ?? null,
        averageWeight: this.movementAvgWeight(m, avgKgPerBird),
        weighedKg: this.movementWeighedKg(m),
        weightLoss: this.movementWeightLoss({
          movementType: m.movementType,
          weightIn: m.stockWeightIn,
          weightOut: m.stockWeightOut,
          weighedKg: m.weighedKg,
          billedKg: m.billedKg,
        }),
        notes: m.notes || null,
        runningBirds,
        runningWeight: Number(runningWeight.toFixed(2)),
      };
    });

    const openingWeightFinal = openingBirds > 0 && avgKgPerBird > 0
      ? this.round2(openingBirds * avgKgPerBird)
      : Number(openingWeight.toFixed(2));
    const closingBirdsFinal = Math.max(0, runningBirds);
    const closingWeightFinal = closingBirdsFinal > 0 && avgKgPerBird > 0
      ? this.round2(closingBirdsFinal * avgKgPerBird)
      : Math.max(0, Number(runningWeight.toFixed(2)));
    const fromWeight = this.round2(openingWeightFinal + inwardStockKg + returnStockIn);
    const accountedWeight = this.round2(
      soldStockWeight + mortalityWeight + returnStockOut + closingWeightFinal,
    );

    let reconInwardKg = 0;
    let reconInwardCostKg = 0;
    let reconInwardValue = 0;
    let reconBilledKg = 0;
    let reconUnmeasuredSaleKg = 0;
    let reconUnmeasuredSales = 0;
    let reconMortalityKg = 0;
    let reconReturnIn = 0;
    let reconReturnOut = 0;
    let unmeasuredLossCount = 0;
    let scanBirds = 0;
    let birdsThroughEnd = 0;
    let negativeStock = false;
    for (const m of movements) {
      if (m.affectsStock === false) continue;
      scanBirds += m.birdsIn - m.birdsOut;
      if (scanBirds < -0.001) negativeStock = true;
      if (end && m.date > end) continue;
      birdsThroughEnd = scanBirds;
      if (start && m.date < start) continue;
      if (m.movementType === 'INWARD') {
        reconInwardKg += m.stockWeightIn;
        reconInwardCostKg += this.n(m.costKg);
        reconInwardValue += this.n(m.costValue);
        if (m.weighedKg == null) unmeasuredLossCount += 1;
      } else if (m.movementType === 'SALE') {
        if (m.billedKg != null) reconBilledKg += m.billedKg;
        else {
          reconUnmeasuredSaleKg += m.stockWeightOut;
          reconUnmeasuredSales += 1;
          unmeasuredLossCount += 1;
        }
      } else if (m.movementType === 'MORTALITY') {
        reconMortalityKg += m.stockWeightOut;
        if (m.weighedKg == null) unmeasuredLossCount += 1;
      } else if (m.movementType === 'RETURN') {
        reconReturnIn += m.stockWeightIn;
        reconReturnOut += m.stockWeightOut;
      }
    }

    const prior = start ? this.inwardAverages(inwards, this.dayBeforeYmd(start)) : null;
    const openingValue = this.round2(openingWeightFinal * (prior && prior.avgRate > 0 ? prior.avgRate : avgRate));
    const periodRate = this.weightedAverageRate(
      openingWeightFinal,
      openingValue,
      reconInwardCostKg,
      reconInwardValue,
    );
    const applicableRate = periodRate > 0 ? periodRate : avgRate;
    const reconClosingBirds = Math.max(0, birdsThroughEnd);
    const reconClosingWeight = reconClosingBirds > 0 && avgKgPerBird > 0
      ? this.round2(reconClosingBirds * avgKgPerBird)
      : 0;
    const reconciliation = this.reconcileGodownWeight({
      openingWeight: openingWeightFinal,
      inwardWeight: reconInwardKg,
      returnWeightIn: reconReturnIn,
      soldWeight: reconBilledKg + reconUnmeasuredSaleKg,
      mortalityWeight: reconMortalityKg,
      returnWeightOut: reconReturnOut,
      closingWeight: reconClosingWeight,
      rate: applicableRate,
      unmeasuredSaleCount: reconUnmeasuredSales,
      negativeStock,
    });
    const weightLoss = reconciliation.weightLoss;
    const weightLossPercent = reconciliation.weightLossPercent;

    return {
      startDate: start || null,
      endDate: end || null,
      opening: {
        birds: openingBirds,
        weight: openingWeightFinal,
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
        billedSaleWeight: this.round2(billedSaleWeight),
        mortalityBirds,
        mortalityWeight: Number(mortalityWeight.toFixed(2)),
        returnBirds: returnBirdsIn,
        returnWeight: Number(returnWeightIn.toFixed(2)),
        inwardBirds,
        inwardWeight: this.round2(inwardKg),
        inwardValue: this.round2(reconInwardValue),
        openingValue,
        fromWeight,
        accountedWeight,
        soldBilledWeight: this.round2(reconBilledKg + reconUnmeasuredSaleKg),
        weightLoss,
        weightLossValue: reconciliation.weightLossCost,
        weightLossCost: reconciliation.weightLossCost,
        unmeasuredLossCount,
        weightLossPercent,
        discrepancyKg: reconciliation.discrepancyKg,
        reconciliationFlagged: reconciliation.flagged,
        reconciliationNote: reconciliation.note,
        reconciliation,
      },
      avgWeight: this.round2(avgKgPerBird),
      avgRate: this.round2(avgRate),
      periodAverageRate: this.round2(applicableRate),
      closing: {
        birds: closingBirdsFinal,
        weight: closingWeightFinal,
      },
      entries,
      totalEntries: entries.length,
    };
  }
}
