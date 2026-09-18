import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { PurchaseOrder } from '../purchases/entities/purchase-order.entity';
import { Sale } from '../sales/sale.entity';
import { Expense } from '../expenses/expense.entity';

import { Retailer } from '../retailers/retailer.entity';
import { GodownSale } from '../godown/entities/godown-sale.entity';
import { GodownInwardEntry } from '../godown/godown-inward.entity';
import { Cage } from '../cages/cage.entity';

import { SalePayment } from '../sales/sale-payment.entity';
import { GodownSalePayment } from '../godown/entities/godown-sale-payment.entity';
import { Mortality } from '../mortality/mortality.entity';
import { GodownExpense } from '../godown/godown-expense.entity';
import { TenantContextService } from '../tenants/tenant-context.service';
import { BalanceSheetService } from './balance-sheet.service';
import { GodownService } from '../godown/godown.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseRepository: Repository<PurchaseOrder>,
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Retailer)
    private readonly retailerRepository: Repository<Retailer>,
    @InjectRepository(GodownSale)
    private readonly godownSaleRepository: Repository<GodownSale>,
    @InjectRepository(GodownInwardEntry)
    private readonly godownInwardRepository: Repository<GodownInwardEntry>,
    @InjectRepository(Cage)
    private readonly cageRepository: Repository<Cage>,
    @InjectRepository(SalePayment)
    private readonly salePaymentRepository: Repository<SalePayment>,
    @InjectRepository(GodownSalePayment)
    private readonly godownSalePaymentRepository: Repository<GodownSalePayment>,
    @InjectRepository(Mortality)
    private readonly mortalityRepository: Repository<Mortality>,
    @InjectRepository(GodownExpense)
    private readonly godownExpenseRepository: Repository<GodownExpense>,
    private readonly tenantContext: TenantContextService,
    private readonly balanceSheetService: BalanceSheetService,
    private readonly godownService: GodownService,
  ) { }

  private getTenantId(): string | null {
    return this.tenantContext.getTenantId();
  }

  private tenantWhere(extra: any): any {
    const tenantId = this.getTenantId();
    return tenantId ? { ...extra, tenantId } : extra;
  }

  private tenantSqlFilter(alias: string): string {
    const tenantId = this.getTenantId();
    return tenantId ? `${alias}.tenant_id = '${tenantId}'` : '1=1';
  }

  private tenantSqlFilterNoAlias(): string {
    const tenantId = this.getTenantId();
    return tenantId ? `tenant_id = '${tenantId}'` : '1=1';
  }

  private num(v: any): number {
    const x = parseFloat(v as any);
    return Number.isFinite(x) ? x : 0;
  }

  /** Billed kg on a godown invoice (fallback only). */
  private godownSoldKg(s: { totalWeight?: number; numberOfBirds?: number; averageWeight?: number }): number {
    const weight = this.num(s.totalWeight);
    if (weight > 0) return weight;
    const birds = this.num(s.numberOfBirds);
    const avg = this.num(s.averageWeight);
    return birds > 0 && avg > 0 ? birds * avg : 0;
  }

  private inwardEntryKg(e: { totalWeight?: number; actualWeight?: number; numberOfBirds?: number; averageWeight?: number }): number {
    const recorded = this.num(e.totalWeight) || this.num(e.actualWeight);
    if (recorded > 0) return recorded;
    const birds = this.num(e.numberOfBirds);
    const avg = this.num(e.averageWeight);
    return birds > 0 && avg > 0 ? this.round2(birds * avg) : 0;
  }

  /** Inward rate = rate entered when birds came into godown (kg-weighted). */
  private weightedInwardRate(entries: GodownInwardEntry[]): { kg: number; birds: number; rate: number } {
    let kg = 0;
    let birds = 0;
    let cost = 0;
    for (const e of entries) {
      const w = this.inwardEntryKg(e);
      const rate = this.num(e.ratePerKg);
      kg += w;
      birds += this.num(e.numberOfBirds);
      cost += rate > 0 ? w * rate : this.num(e.totalAmount);
    }
    return { kg, birds, rate: kg > 0 ? cost / kg : 0 };
  }

  /** Purchase rate = rate_per_kg entered on the purchase bill (kg-weighted). */
  private weightedPurchaseRate(orders: PurchaseOrder[]): number {
    let kg = 0;
    let cost = 0;
    for (const p of orders) {
      if (String(p.status) === 'cancelled') continue;
      const w = this.num(p.totalWeight);
      const rate = this.num(p.ratePerKg);
      kg += w;
      cost += rate > 0 ? w * rate : this.num(p.netAmount);
    }
    return kg > 0 ? cost / kg : 0;
  }

  private round2(v: number): number {
    return Math.round(v * 100) / 100;
  }

  /** Date-only range, matching dashboard string compare (avoids UTC Between dropping today's rows). */
  private dateBetween(startDate?: string, endDate?: string) {
    if (!startDate || !endDate) return undefined;
    return Between(startDate, endDate);
  }

  private parseSaleNotesWeightLossKg(notes?: string): number {
    if (!notes) return 0;
    try {
      const parsed = JSON.parse(notes);
      const kg = parseFloat(parsed?.weightLoss?.totalWeightLoss);
      return Number.isFinite(kg) ? kg : 0;
    } catch {
      return 0;
    }
  }

  private stageLoss(fromWeight: number, toWeight: number): number {
    return Math.max(0, this.round2(fromWeight - toWeight));
  }

  private todayYmd(): string {
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const y = ist.getFullYear();
    const m = String(ist.getMonth() + 1).padStart(2, '0');
    const d = String(ist.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private dayBefore(ymd: string): string {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  private channelSummary(key: string, label: string, rows: Array<{ birds: number; purchaseWeight: number; recordedWeight: number; weightLoss: number }>) {
    const birds = rows.reduce((s, r) => s + (r.birds || 0), 0);
    const purchaseWeight = this.round2(rows.reduce((s, r) => s + (r.purchaseWeight || 0), 0));
    const recordedWeight = this.round2(rows.reduce((s, r) => s + (r.recordedWeight || 0), 0));
    const weightLoss = this.round2(rows.reduce((s, r) => s + (r.weightLoss || 0), 0));
    return {
      key,
      label,
      documents: rows.length,
      birds,
      purchaseWeight,
      recordedWeight,
      weightLoss,
      lossPercent: purchaseWeight > 0 ? this.round2((weightLoss / purchaseWeight) * 100) : 0,
    };
  }

  async getPurchaseReport(startDate?: string, endDate?: string) {
    const whereClause: any = {};

    const orderRange = this.dateBetween(startDate, endDate);
    if (orderRange) whereClause.orderDate = orderRange;

    const purchases = await this.purchaseRepository.find({
      where: this.tenantWhere(whereClause),
      relations: ['cages'],
      order: { orderDate: 'DESC' },
    });

    const summary = {
      totalOrders: purchases.length,
      totalBirds: purchases.reduce((sum, p) => {
        const birds = (p.cages || []).reduce((s, c: any) => s + (parseInt(c.numberOfBirds) || 0), 0);
        return sum + birds;
      }, 0),
      totalWeight: purchases.reduce((sum, p) => sum + parseFloat(p.totalWeight as any), 0),
      totalAmount: purchases.reduce((sum, p) => sum + parseFloat(p.totalAmount as any), 0),
      totalNetAmount: purchases.reduce((sum, p) => sum + parseFloat(p.netAmount as any), 0),
      totalPaid: purchases.filter(p => p.purchasePaymentStatus === 'paid').length,
      totalPending: purchases.filter(p => p.purchasePaymentStatus === 'pending').length,
      totalPartial: purchases.filter(p => p.purchasePaymentStatus === 'partial').length,
    };

    return {
      summary,
      purchases: purchases.map(p => ({
        ...p,
        totalBirds: (p.cages || []).reduce((s, c: any) => s + (parseInt(c.numberOfBirds) || 0), 0),
      })),
      dateRange: { startDate, endDate },
    };
  }

  async getSalesReport(startDate?: string, endDate?: string) {
    const whereClause: any = {};

    const saleRange = this.dateBetween(startDate, endDate);
    if (saleRange) whereClause.saleDate = saleRange;

    const sales = (await this.saleRepository.find({
      where: this.tenantWhere(whereClause),
      order: { saleDate: 'DESC' },
    })).filter((s) => s.saleMode !== 'from_godown');

    const summary = {
      totalSales: sales.length,
      totalBirds: sales.reduce((sum, s) => sum + (parseInt(s.numberOfBirds as any) || 0), 0),
      totalQuantity: sales.reduce((sum, s) => sum + parseFloat(s.quantity as any), 0),
      totalAmount: sales.reduce((sum, s) => sum + parseFloat(s.totalAmount as any), 0),
      totalNetAmount: sales.reduce((sum, s) => sum + parseFloat(s.netAmount as any), 0),
      totalWeightShortage: sales.reduce((sum, s) => sum + parseFloat((s.weightShortage || 0) as any), 0),
      totalWeightShortageKg: sales.reduce((sum, s) => {
        const kg = parseFloat((s.weightShortageKg || 0) as any);
        if (kg > 0) return sum + kg;
        const amt = parseFloat((s.weightShortage || 0) as any);
        const rate = parseFloat((s.unitPrice || 0) as any);
        if (amt > 0 && rate > 0) return sum + (amt / rate);
        return sum;
      }, 0),
      totalMortalityDeduction: sales.reduce((sum, s) => sum + parseFloat((s.mortalityDeduction || 0) as any), 0),
      totalPaid: sales.filter(s => s.paymentStatus === 'paid').length,
      totalPending: sales.filter(s => s.paymentStatus === 'pending').length,
      totalPartial: sales.filter(s => s.paymentStatus === 'partial').length,
    };

    return {
      summary,
      sales,
      dateRange: { startDate, endDate },
    };
  }

  async getMortalityReport(startDate?: string, endDate?: string) {
    const whereClause: any = {};

    const orderRange = this.dateBetween(startDate, endDate);
    if (orderRange) whereClause.orderDate = orderRange;

    const purchases = await this.purchaseRepository
      .createQueryBuilder('purchase')
      .where(this.tenantWhere(whereClause))
      .orderBy('purchase.orderDate', 'DESC')
      .getMany();

    const totalDeduction = purchases.reduce((sum, p) => sum + parseFloat(p.mortalityDeduction as any || 0), 0);

    const summary = {
      totalOrders: purchases.length,
      totalMortalityDeduction: totalDeduction,
      averageMortalityPerOrder: purchases.length > 0 ? totalDeduction / purchases.length : 0,
    };

    return {
      summary,
      purchases: purchases.map(p => ({
        orderNumber: p.orderNumber,
        orderDate: p.orderDate,
        supplierName: p.supplierName,
        totalWeight: p.totalWeight,
        mortalityDeduction: parseFloat(p.mortalityDeduction as any) || 0,
        netAmount: p.netAmount,
      })),
      dateRange: { startDate, endDate },
    };
  }

  async getProfitLossReport(startDate?: string, endDate?: string) {
    const whereClausePurchase: any = {};
    const whereClauseSale: any = {};
    const whereClauseExpense: any = {};

    const orderRange = this.dateBetween(startDate, endDate);
    const saleRange = this.dateBetween(startDate, endDate);
    const expenseRange = this.dateBetween(startDate, endDate);
    if (orderRange) whereClausePurchase.orderDate = orderRange;
    if (saleRange) whereClauseSale.saleDate = saleRange;
    if (expenseRange) whereClauseExpense.expenseDate = expenseRange;

    const purchases = await this.purchaseRepository.find({ where: this.tenantWhere(whereClausePurchase) });
    const sales = await this.saleRepository.find({ where: this.tenantWhere(whereClauseSale) });
    const godownSales = await this.godownSaleRepository.find({ where: this.tenantWhere(whereClauseSale) });
    const expenses = await this.expenseRepository.find({
      where: this.tenantWhere(whereClauseExpense),
      relations: ['expenseCategory']
    });
    const godownExpenses = await this.godownExpenseRepository.find({
      where: this.tenantWhere(whereClauseExpense),
    });
    const mortalityWhere: any = {};
    const mortalityRange = this.dateBetween(startDate, endDate);
    if (mortalityRange) mortalityWhere.purchaseDate = mortalityRange;
    const mortalities = await this.mortalityRepository.find({ where: this.tenantWhere(mortalityWhere) });

    const poultryRevenue = sales.reduce((sum, s) => sum + parseFloat(s.netAmount as any), 0);
    const godownRevenue = godownSales.reduce((sum, s) => sum + parseFloat((s.totalAmount || 0) as any), 0);
    const totalRevenue = poultryRevenue + godownRevenue;
    const totalPurchase = purchases.reduce((sum, p) => sum + parseFloat(p.netAmount as any), 0);
    const totalCost = totalPurchase;
    const mainExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount as any), 0);
    const godownExpenseTotal = godownExpenses.reduce((sum, e) => sum + parseFloat(e.amount as any), 0);
    const totalExpenses = mainExpenses + godownExpenseTotal;
    const totalMortality = mortalities.reduce((sum, m) => {
      const amount = parseFloat(m.amount as any) || 0;
      if (amount > 0) return sum + amount;
      const weight = parseFloat(m.weightOfDeadBirds as any) || 0;
      const rate = parseFloat(m.ratePerKg as any) || 0;
      return sum + (weight > 0 && rate > 0 ? weight * rate : 0);
    }, 0);

    const closingAsOn = endDate || this.todayYmd();
    const inwardAsOnWhere: any = {};
    const purchaseAsOnWhere: any = {};
    const asOnRange = this.dateBetween('1970-01-01', closingAsOn);
    if (asOnRange) {
      inwardAsOnWhere.entryDate = asOnRange;
      purchaseAsOnWhere.orderDate = asOnRange;
    }
    const [closing, godownSummary, inwardsAsOn, purchasesAsOn] = await Promise.all([
      this.balanceSheetService.getInventoryValuation(closingAsOn),
      this.godownService.getSummary(),
      this.godownInwardRepository.find({ where: this.tenantWhere(inwardAsOnWhere) }),
      this.purchaseRepository.find({ where: this.tenantWhere(purchaseAsOnWhere) }),
    ]);

    const inwardStats = this.weightedInwardRate(inwardsAsOn);
    const summaryInwardKg = this.num(godownSummary.totalInwardWeight);
    const summaryInwardBirds = this.num(godownSummary.totalInward);
    const summaryInwardValue = this.num(godownSummary.totalInwardValue);
    const inwardRate = inwardStats.rate
      || (summaryInwardKg > 0 && summaryInwardValue > 0 ? summaryInwardValue / summaryInwardKg : 0)
      || this.num(closing.godownRate);
    const avgInwardKg = inwardStats.birds > 0 && inwardStats.kg > 0
      ? inwardStats.kg / inwardStats.birds
      : (summaryInwardBirds > 0 && summaryInwardKg > 0 ? summaryInwardKg / summaryInwardBirds : 0);
    const purchaseRate = this.weightedPurchaseRate(purchasesAsOn) || this.num(closing.purchaseRate);

    const godownStock = this.round2(
      this.num(godownSummary.currentValue) > 0
        ? this.num(godownSummary.currentValue)
        : this.num(godownSummary.currentWeight) * inwardRate,
    );
    const vehicleStock = this.round2(closing.vehicleInventory || 0);
    const availableStock = this.round2(godownStock + vehicleStock);

    let openingStock = 0;
    if (startDate) {
      const openingLedger = await this.godownService.getStockLedger({ endDate: this.dayBefore(startDate) });
      const openingGodown = this.round2(this.num(openingLedger?.closing?.weight) * inwardRate);
      const openingValuation = await this.balanceSheetService.getInventoryValuation(this.dayBefore(startDate));
      openingStock = this.round2(openingGodown + this.num(openingValuation.vehicleInventory));
    }

    const vehicleSoldKg = sales
      .filter(s => s.saleMode !== 'from_godown')
      .reduce((sum, s) => sum + this.num(s.quantity), 0);
    const godownSoldBirds = godownSales.reduce((sum, s) => sum + this.num(s.numberOfBirds), 0);
    const godownSoldStockKg = godownSoldBirds > 0 && avgInwardKg > 0
      ? this.round2(godownSoldBirds * avgInwardKg)
      : godownSales.reduce((sum, s) => sum + this.godownSoldKg(s), 0);
    const vehicleCogs = this.round2(vehicleSoldKg * purchaseRate);
    let godownCogs = this.round2(godownSoldStockKg * inwardRate);
    const inwardCostCap = this.round2(inwardStats.kg > 0 ? inwardStats.kg * inwardRate : summaryInwardValue);
    if (inwardCostCap > 0 && godownCogs > inwardCostCap) godownCogs = inwardCostCap;
    const cogs = this.round2(vehicleCogs + godownCogs);
    const grossProfit = this.round2(totalRevenue - cogs);
    const netProfit = this.round2(grossProfit - totalExpenses);
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      summary: {
        totalRevenue,
        poultryRevenue,
        godownRevenue,
        openingStock,
        availableStock,
        godownStock,
        vehicleStock,
        godownBirds: this.num(godownSummary.currentStock),
        godownWeightKg: this.round2(this.num(godownSummary.currentWeight)),
        vehicleBirds: this.num(closing.vehicleBirds),
        vehicleWeightKg: this.round2(this.num(closing.vehicleWeight)),
        totalPurchase,
        vehicleSoldKg: this.round2(vehicleSoldKg),
        godownSoldKg: this.round2(godownSoldStockKg),
        purchaseRate: this.round2(purchaseRate),
        godownRate: this.round2(inwardRate),
        vehicleCogs,
        godownCogs,
        cogs,
        totalMortality,
        totalCost: totalPurchase,
        grossProfit,
        totalExpenses,
        netProfit,
        profitMargin,
      },
      breakdown: {
        purchases: {
          count: purchases.length,
          total: totalCost,
        },
        sales: {
          count: sales.length + godownSales.length,
          total: totalRevenue,
          poultry: { count: sales.length, total: poultryRevenue },
          godown: { count: godownSales.length, total: godownRevenue },
        },
        expenses: {
          count: expenses.length,
          total: totalExpenses,
          byCategory: this.groupExpensesByCategory(expenses),
        },
      },
      dateRange: { startDate, endDate },
    };
  }

  private groupExpensesByCategory(expenses: Expense[]) {
    const grouped: Record<string, number> = {};

    expenses.forEach(expense => {
      const category = expense.expenseCategory?.name || expense.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = 0;
      }
      grouped[category] += parseFloat(expense.amount as any);
    });

    return grouped;
  }

  async getGodownSalesReport(startDate?: string, endDate?: string) {
    const whereClause: any = {};

    const saleRange = this.dateBetween(startDate, endDate);
    if (saleRange) whereClause.saleDate = saleRange;

    const sales = await this.godownSaleRepository.find({
      where: this.tenantWhere(whereClause),
      order: { saleDate: 'DESC' },
      relations: ['payments'],
    });

    const summary = {
      totalSales: sales.length,
      totalBirds: sales.reduce((sum, s) => sum + (parseInt(String(s.numberOfBirds || 0), 10) || 0), 0),
      totalAmount: sales.reduce((sum, s) => sum + parseFloat((s.totalAmount || 0) as any), 0),
      totalWeightLoss: sales.reduce((sum, s) => sum + parseFloat((s.weightLoss || 0) as any), 0),
      totalAmountReceived: sales.reduce((sum, s) => sum + parseFloat((s.amountReceived || 0) as any), 0),
      totalPaid: sales.filter(s => s.paymentStatus === 'paid').length,
      totalPending: sales.filter(s => s.paymentStatus === 'pending').length,
      totalPartial: sales.filter(s => s.paymentStatus === 'partial').length,
    };

    return {
      summary,
      sales,
      dateRange: { startDate, endDate },
    };
  }

  async getGodownInwardReport(startDate?: string, endDate?: string) {
    const whereClause: any = {};

    const entryRange = this.dateBetween(startDate, endDate);
    if (entryRange) whereClause.entryDate = entryRange;

    const entries = await this.godownInwardRepository.find({
      where: this.tenantWhere(whereClause),
      order: { entryDate: 'DESC' },
    });

    const invoiceNos = [...new Set(entries.map(e => e.purchaseInvoiceNo).filter(Boolean))] as string[];
    const purchases = invoiceNos.length
      ? await this.purchaseRepository.find({
          where: invoiceNos.map(orderNumber => this.tenantWhere({ orderNumber })),
        })
      : [];
    const purchaseByOrder = new Map(purchases.map(p => [p.orderNumber, p]));

    const inwardIds = entries.map(e => e.id);
    const inwardCages = inwardIds.length
      ? await this.cageRepository.find({ where: this.tenantWhere({ godownInwardId: In(inwardIds) }) })
      : [];
    const cagesByInward = new Map<string, Cage[]>();
    for (const cage of inwardCages) {
      const key = String(cage.godownInwardId);
      if (!cagesByInward.has(key)) cagesByInward.set(key, []);
      cagesByInward.get(key)!.push(cage);
    }

    const mapped = entries.map(e => {
      const purchase = e.purchaseInvoiceNo ? purchaseByOrder.get(e.purchaseInvoiceNo) : undefined;
      const weight = parseFloat((e.actualWeight ?? e.totalWeight ?? 0) as any) || 0;
      const rate = parseFloat((e.ratePerKg ?? purchase?.ratePerKg ?? 0) as any) || 0;
      const amount = parseFloat((e.totalAmount ?? 0) as any) || (weight * rate);
      const paidAmount = parseFloat((purchase?.totalPaymentMade ?? 0) as any) || 0;
      const related = cagesByInward.get(String(e.id)) || [];
      const cageLoss = related.reduce((sum, c) => {
        const purchaseWt = this.num(c.purchaseWeight);
        const godownWt = c.godownInwardWeight != null ? this.num(c.godownInwardWeight) : purchaseWt;
        return sum + this.stageLoss(purchaseWt, godownWt);
      }, 0);
      const storedLoss = parseFloat((e.weightLoss || 0) as any) || 0;
      return {
        ...e,
        birds: e.numberOfBirds || 0,
        weight,
        ratePerKg: rate,
        amount,
        paidAmount,
        weightLoss: this.round2(cageLoss > 0 ? cageLoss : storedLoss),
      };
    });

    const summary = {
      totalEntries: mapped.length,
      totalBirds: mapped.reduce((sum, e) => sum + (e.birds || 0), 0),
      totalWeight: mapped.reduce((sum, e) => sum + e.weight, 0),
      totalAmount: mapped.reduce((sum, e) => sum + e.amount, 0),
      totalPaid: mapped.reduce((sum, e) => sum + e.paidAmount, 0),
      totalWeightLoss: mapped.reduce((sum, e) => sum + e.weightLoss, 0),
    };

    return {
      summary,
      entries: mapped,
      dateRange: { startDate, endDate },
    };
  }

  async getGrossProfitReport(startDate?: string, endDate?: string) {
    const whereClausePurchase: any = {};
    const whereClauseSale: any = {};

    const orderRange = this.dateBetween(startDate, endDate);
    const saleRange = this.dateBetween(startDate, endDate);
    if (orderRange) whereClausePurchase.orderDate = orderRange;
    if (saleRange) whereClauseSale.saleDate = saleRange;

    const purchases = await this.purchaseRepository.find({ where: this.tenantWhere(whereClausePurchase) });
    const sales = await this.saleRepository.find({ where: this.tenantWhere(whereClauseSale) });
    const godownSales = await this.godownSaleRepository.find({ where: this.tenantWhere(whereClauseSale) });

    const poultryRevenue = sales.reduce((sum, s) => sum + parseFloat(s.netAmount as any), 0);
    const godownRevenue = godownSales.reduce((sum, s) => sum + parseFloat((s.totalAmount || 0) as any), 0);
    const totalRevenue = poultryRevenue + godownRevenue;
    const totalCost = purchases.reduce((sum, p) => sum + parseFloat(p.netAmount as any), 0);
    const grossProfit = totalRevenue - totalCost;
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      summary: {
        totalRevenue,
        totalCost,
        grossProfit,
        grossProfitMargin,
      },
      dateRange: { startDate, endDate },
    };
  }

  async getExpenseBreakdown(startDate?: string, endDate?: string) {
    const whereClause: any = {};

    const expenseRange = this.dateBetween(startDate, endDate);
    if (expenseRange) whereClause.expenseDate = expenseRange;

    const expenses = await this.expenseRepository.find({
      where: this.tenantWhere(whereClause),
      relations: ['expenseCategory']
    });
    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount as any), 0);
    const byCategory = this.groupExpensesByCategory(expenses);

    const breakdown = Object.entries(byCategory).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      count: expenses.filter(e => (e.expenseCategory?.name || e.category || 'Other') === category).length,
    })).sort((a, b) => b.amount - a.amount);

    return {
      summary: {
        totalExpenses,
        categoryCount: Object.keys(byCategory).length,
        totalCount: expenses.length,
      },
      breakdown,
      expenses: expenses
        .map(e => ({
          id: e.id,
          expenseDate: e.expenseDate,
          expenseOwner: e.expenseOwner || '',
          category: e.expenseCategory?.name || e.category || 'Other',
          description: e.description || '',
          amount: parseFloat(e.amount as any) || 0,
          paymentMethod: e.paymentMethod || '',
          notes: e.notes || '',
        }))
        .sort((a, b) => String(b.expenseDate).localeCompare(String(a.expenseDate))),
      dateRange: { startDate, endDate },
    };
  }

  async getBatchWiseProfit(startDate?: string, endDate?: string) {
    const whereClause: any = {};

    const orderRange = this.dateBetween(startDate, endDate);
    if (orderRange) whereClause.orderDate = orderRange;

    const purchases = await this.purchaseRepository.find({
      where: this.tenantWhere(whereClause),
      order: { orderDate: 'DESC' },
    });

    const batchProfit = purchases.map(purchase => {
      const cost = parseFloat(purchase.netAmount as any);
      // Note: In a real system, you'd match this with actual sales from this batch
      // For now, we'll show the cost and potential profit margin
      return {
        orderNumber: purchase.orderNumber,
        orderDate: purchase.orderDate,
        supplierName: purchase.supplierName,
        totalWeight: purchase.totalWeight,
        cost,
        // This would be calculated from matched sales in a complete system
        estimatedRevenue: 0,
        profit: 0,
        profitMargin: 0,
      };
    });

    return {
      batches: batchProfit,
      summary: {
        totalBatches: purchases.length,
        totalCost: purchases.reduce((sum, p) => sum + parseFloat(p.netAmount as any), 0),
      },
      dateRange: { startDate, endDate },
    };
  }

  async getFarmWiseProfit(startDate?: string, endDate?: string) {
    const whereClause: any = {};

    const orderRange = this.dateBetween(startDate, endDate);
    if (orderRange) whereClause.orderDate = orderRange;

    const purchases = await this.purchaseRepository.find({ where: this.tenantWhere(whereClause) });

    // Group by farmer
    const farmData: Record<string, any> = {};

    purchases.forEach(purchase => {
      const farmerKey = purchase.farmerId || purchase.supplierName || 'Unknown';

      if (!farmData[farmerKey]) {
        farmData[farmerKey] = {
          farmerId: purchase.farmerId,
          farmerName: purchase.supplierName,
          farmerMobile: purchase.farmerMobile,
          farmLocation: purchase.farmLocation,
          totalOrders: 0,
          totalCost: 0,
          totalWeight: 0,
        };
      }

      farmData[farmerKey].totalOrders += 1;
      farmData[farmerKey].totalCost += parseFloat(purchase.netAmount as any);
      farmData[farmerKey].totalWeight += parseFloat(purchase.totalWeight as any || '0');
    });

    const farmWiseData = Object.values(farmData).sort((a: any, b: any) => b.totalCost - a.totalCost);

    return {
      farms: farmWiseData,
      summary: {
        totalFarms: farmWiseData.length,
        totalCost: farmWiseData.reduce((sum: number, f: any) => sum + f.totalCost, 0),
        totalOrders: purchases.length,
      },
      dateRange: { startDate, endDate },
    };
  }

  async getCustomerWiseSales(startDate?: string, endDate?: string) {
    const whereClause: any = {};

    const saleRange = this.dateBetween(startDate, endDate);
    if (saleRange) whereClause.saleDate = saleRange;

    const sales = await this.saleRepository.find({ where: this.tenantWhere(whereClause) });
    const godownSales = await this.godownSaleRepository.find({ where: this.tenantWhere(whereClause) });

    // Group by customer (vehicle sales + godown sales)
    const customerData: Record<string, any> = {};

    const bumpCustomer = (customerName: string | undefined, revenue: number, quantity: number) => {
      const customerKey = customerName || 'Unknown';
      if (!customerData[customerKey]) {
        customerData[customerKey] = {
          customerName: customerName || 'Unknown',
          totalSales: 0,
          totalRevenue: 0,
          totalQuantity: 0,
        };
      }
      customerData[customerKey].totalSales += 1;
      customerData[customerKey].totalRevenue += revenue;
      customerData[customerKey].totalQuantity += quantity;
    };

    sales.forEach(sale => {
      bumpCustomer(
        sale.customerName,
        parseFloat(sale.netAmount as any) || 0,
        parseFloat(sale.quantity as any || '0') || 0,
      );
    });

    godownSales.forEach(sale => {
      bumpCustomer(
        sale.customerName,
        parseFloat((sale.totalAmount || 0) as any) || 0,
        parseFloat((sale.totalWeight || 0) as any) || 0,
      );
    });

    const customerWiseData = Object.values(customerData).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);

    return {
      customers: customerWiseData,
      summary: {
        totalCustomers: customerWiseData.length,
        totalRevenue: customerWiseData.reduce((sum: number, c: any) => sum + c.totalRevenue, 0),
        totalSales: sales.length + godownSales.length,
      },
      dateRange: { startDate, endDate },
    };
  }

  async getOutstandingReport(page?: number, limit?: number, sortBy: string = 'outstanding') {
    const offset = page && limit ? (page - 1) * limit : 0;
    const take = limit ? limit : 1000;
    const tenantId = this.getTenantId();
    const tenantRetailerFilter = tenantId ? `WHERE r.tenant_id = '${tenantId}'` : '';
    const tenantSalesFilter = tenantId ? `WHERE tenant_id = '${tenantId}'` : '';

    const query = `
      SELECT 
        r.id, r.name, r.phone,
        CAST(COALESCE(s.total_sales, 0) + COALESCE(gs.total_sales, 0) AS FLOAT) as "totalSales",
        CAST(COALESCE(s.total_received, 0) + COALESCE(gs.total_received, 0) AS FLOAT) as "totalReceived",
        CAST((COALESCE(s.total_sales, 0) + COALESCE(gs.total_sales, 0)) - (COALESCE(s.total_received, 0) + COALESCE(gs.total_received, 0)) AS FLOAT) as outstanding,
        CAST(COALESCE(s.sales_count, 0) + COALESCE(gs.sales_count, 0) AS INTEGER) as "salesCount"
      FROM retailers r
      LEFT JOIN (
        SELECT retailer_id, SUM(net_amount) as total_sales, SUM(amount_received) as total_received, COUNT(*) as sales_count
        FROM sales
        ${tenantSalesFilter}
        GROUP BY retailer_id
      ) s ON s.retailer_id = r.id
      LEFT JOIN (
        SELECT retailer_id, SUM(total_amount) as total_sales, SUM(amount_received) as total_received, COUNT(*) as sales_count
        FROM godown_sales
        ${tenantSalesFilter}
        GROUP BY retailer_id
      ) gs ON gs.retailer_id = r.id
      ${tenantRetailerFilter}
      ORDER BY ${sortBy === 'name' ? 'r.name ASC' : 'outstanding DESC'}
      OFFSET ${offset} LIMIT ${take}
    `;

    const countQuery = `SELECT COUNT(*) FROM retailers ${tenantId ? `WHERE tenant_id = '${tenantId}'` : ''}`;

    // Global summary totals (for all retailers)
    const summaryQuery = `
      SELECT 
        SUM(outstanding) FILTER (WHERE outstanding > 0) as "totalOutstanding",
        SUM(outstanding) FILTER (WHERE outstanding < 0) as "totalOverpaid",
        COUNT(*) FILTER (WHERE outstanding > 0) as "overdueCount",
        COUNT(*) as "totalRetailers"
      FROM (
        SELECT 
          (COALESCE(s.total_sales, 0) + COALESCE(gs.total_sales, 0)) - (COALESCE(s.total_received, 0) + COALESCE(gs.total_received, 0)) as outstanding
        FROM retailers r
        LEFT JOIN (
          SELECT retailer_id, SUM(net_amount) as total_sales, SUM(amount_received) as total_received
          FROM sales
          ${tenantSalesFilter}
          GROUP BY retailer_id
        ) s ON s.retailer_id = r.id
        LEFT JOIN (
          SELECT retailer_id, SUM(total_amount) as total_sales, SUM(amount_received) as total_received
          FROM godown_sales
          ${tenantSalesFilter}
          GROUP BY retailer_id
        ) gs ON gs.retailer_id = r.id
        ${tenantRetailerFilter}
      ) t
    `;

    const [data, counts, summaryData] = await Promise.all([
      this.retailerRepository.query(query),
      this.retailerRepository.query(countQuery),
      this.retailerRepository.query(summaryQuery),
    ]);

    const total = parseInt(counts[0].count);
    const summary = summaryData[0];

    return {
      data,
      total,
      page: page || 1,
      limit: limit || total,
      summary: {
        totalOutstanding: parseFloat(summary.totalOutstanding || 0),
        totalOverpaid: Math.abs(parseFloat(summary.totalOverpaid || 0)),
        overdueCount: parseInt(summary.overdueCount || 0),
        totalRetailers: parseInt(summary.totalRetailers || 0),
      }
    };
  }

  async getCollectionReport(filters: { startDate?: string; endDate?: string; mode?: string; page?: number; limit?: number }) {
    const { startDate, endDate, mode, page, limit } = filters;
    const offset = page && limit ? (page - 1) * limit : 0;
    const take = limit ? limit : 20;
    const tenantId = this.getTenantId();
    const tenantJoinFilter = tenantId ? ` AND s.tenant_id = '${tenantId}'` : '';
    const tenantVoucherFilter = tenantId ? ` AND v.tenant_id = '${tenantId}'` : '';

    let whereClause = 'WHERE 1=1';
    if (startDate && endDate) {
      whereClause += ` AND created_at BETWEEN '${startDate} 00:00:00' AND '${endDate} 23:59:59'`;
    }
    if (mode && mode !== 'all') {
      const modeKey = String(mode).toLowerCase().replace(/[^a-z_]/g, '');
      if (modeKey === 'bank') {
        whereClause += ` AND LOWER(payment_mode) IN ('bank', 'bank_transfer')`;
      } else if (modeKey) {
        whereClause += ` AND LOWER(payment_mode) = '${modeKey}'`;
      }
    }

    const unionQuery = `
      SELECT 
        id, sale_id,
        invoice_number as "invoiceNumber",
        customer_name as "customerName",
        payment_mode as "payment_mode",
        amount, created_at,
        'Completed' as status,
        'Regular' as type
      FROM (
        SELECT p.id, p.sale_id, s.invoice_number, s.customer_name, p.payment_mode, p.amount, p.created_at
        FROM sale_payments p
        JOIN sales s ON s.id = p.sale_id${tenantJoinFilter}
      ) t1
      UNION ALL
      SELECT 
        id, godown_sale_id as sale_id,
        invoice_number as "invoiceNumber",
        customer_name as "customerName",
        payment_mode as "payment_mode",
        amount, created_at,
        'Completed' as status,
        'Godown' as type
      FROM (
        SELECT p.id, p.godown_sale_id, s.invoice_number, s.customer_name, p.payment_mode, p.amount, p.created_at
        FROM godown_sale_payments p
        JOIN godown_sales s ON s.id = p.godown_sale_id${tenantJoinFilter}
      ) t2
      UNION ALL
      SELECT
        id, sale_id,
        invoice_number as "invoiceNumber",
        customer_name as "customerName",
        payment_mode as "payment_mode",
        amount, created_at,
        status,
        'Voucher' as type
      FROM (
        SELECT
          v.id::bigint as id,
          NULL::bigint as sale_id,
          v.voucher_number as invoice_number,
          v.payee_name as customer_name,
          v.payment_method as payment_mode,
          v.amount,
          COALESCE(v.paid_date, v.voucher_date)::timestamptz as created_at,
          CASE
            WHEN LOWER(COALESCE(v.status, 'paid')) IN ('paid', 'approved', 'completed') THEN 'Completed'
            ELSE INITCAP(v.status)
          END as status
        FROM payment_vouchers v
        WHERE LOWER(v.voucher_type) = 'in'
          AND LOWER(COALESCE(v.status, 'paid')) <> 'cancelled'
          ${tenantVoucherFilter}
      ) t3
    `;

    const dataQuery = `
      SELECT * FROM (${unionQuery}) u
      ${whereClause}
      ORDER BY created_at DESC
      OFFSET ${offset} LIMIT ${take}
    `;

    const countQuery = `
      SELECT COUNT(*) as total, SUM(amount) as total_amount
      FROM (${unionQuery}) u
      ${whereClause}
    `;

    const summaryQuery = `
      SELECT 
        LOWER(payment_mode) as mode, 
        SUM(amount) as amount 
      FROM (${unionQuery}) u
      ${whereClause}
      GROUP BY LOWER(payment_mode)
    `;

    const [data, counts, summaryData] = await Promise.all([
      this.salePaymentRepository.query(dataQuery),
      this.salePaymentRepository.query(countQuery),
      this.salePaymentRepository.query(summaryQuery),
    ]);

    const total = parseInt(counts[0].total || 0);
    const totalAmount = parseFloat(counts[0].total_amount || 0);

    const modeTotals: Record<string, number> = {};
    summaryData.forEach((s: any) => {
      modeTotals[s.mode] = parseFloat(s.amount);
    });

    return {
      data: data.map((d: any) => ({
        ...d,
        id: `${d.type || 'row'}-${d.id}`,
        amount: parseFloat(d.amount),
      })),
      total,
      page: page || 1,
      limit: limit || total,
      summary: {
        totalAmount,
        modeTotals
      }
    };
  }

  async getWeightLossReport(startDate?: string, endDate?: string) {
    const whereSale: any = {};
    const whereInward: any = {};
    const whereGodownSale: any = {};

    const saleRange = this.dateBetween(startDate, endDate);
    const inwardRange = this.dateBetween(startDate, endDate);
    if (saleRange) {
      whereSale.saleDate = saleRange;
      whereGodownSale.saleDate = saleRange;
    }
    if (inwardRange) whereInward.entryDate = inwardRange;

    const [sales, inwards, godownSales] = await Promise.all([
      this.saleRepository.find({
        where: this.tenantWhere(whereSale),
        order: { saleDate: 'DESC' },
      }),
      this.godownInwardRepository.find({
        where: this.tenantWhere(whereInward),
        order: { entryDate: 'DESC' },
      }),
      this.godownSaleRepository.find({
        where: this.tenantWhere(whereGodownSale),
        order: { saleDate: 'DESC' },
      }),
    ]);

    const saleIds = sales.map(s => s.id);
    const inwardIds = inwards.map(e => e.id);
    const godownSaleIds = godownSales.map(s => s.id);

    const orWhere: any[] = [];
    if (saleIds.length) orWhere.push(this.tenantWhere({ saleId: In(saleIds) }));
    if (inwardIds.length) orWhere.push(this.tenantWhere({ godownInwardId: In(inwardIds) }));
    if (godownSaleIds.length) orWhere.push(this.tenantWhere({ godownSaleId: In(godownSaleIds) }));

    const cages = orWhere.length ? await this.cageRepository.find({ where: orWhere }) : [];

    const cagesBySale = new Map<string, Cage[]>();
    const cagesByInward = new Map<string, Cage[]>();
    const cagesByGodownSale = new Map<string, Cage[]>();
    for (const cage of cages) {
      if (cage.saleId) {
        const key = String(cage.saleId);
        if (!cagesBySale.has(key)) cagesBySale.set(key, []);
        cagesBySale.get(key)!.push(cage);
      }
      if (cage.godownInwardId) {
        const key = String(cage.godownInwardId);
        if (!cagesByInward.has(key)) cagesByInward.set(key, []);
        cagesByInward.get(key)!.push(cage);
      }
      if (cage.godownSaleId) {
        const key = String(cage.godownSaleId);
        if (!cagesByGodownSale.has(key)) cagesByGodownSale.set(key, []);
        cagesByGodownSale.get(key)!.push(cage);
      }
    }

    const salesRows = sales.map(s => {
      const related = cagesBySale.get(String(s.id)) || [];
      const birds = related.reduce((sum, c) => sum + (parseInt(String(c.numberOfBirds), 10) || 0), 0) || (parseInt(String(s.numberOfBirds || 0), 10) || 0);
      const purchaseWeight = this.round2(related.reduce((sum, c) => sum + this.num(c.purchaseWeight), 0));
      const recordedWeight = this.round2(related.reduce((sum, c) => sum + this.num(c.saleWeight != null ? c.saleWeight : c.purchaseWeight), 0));
      const cageLoss = related.reduce((sum, c) => {
        const purchaseWt = this.num(c.purchaseWeight);
        const soldWt = c.saleWeight != null ? this.num(c.saleWeight) : purchaseWt;
        return sum + this.stageLoss(purchaseWt, soldWt);
      }, 0);
      const notesLoss = this.parseSaleNotesWeightLossKg(s.notes);
      const shortageKg = this.num(s.weightShortageKg);
      const weightLoss = this.round2(cageLoss > 0.001 ? cageLoss : (notesLoss > 0 ? notesLoss : shortageKg));
      const fromWeight = purchaseWeight > 0 ? purchaseWeight : this.round2(this.num(s.quantity) + weightLoss);
      const toWeight = recordedWeight > 0 ? recordedWeight : this.num(s.quantity);
      return {
        channel: 'vehicle_sales',
        channelLabel: 'Sales',
        documentNo: s.invoiceNumber || s.saleNo || '-',
        date: s.saleDate,
        party: s.customerName || '-',
        purchaseBillNo: s.purchaseBillNo || '-',
        birds,
        purchaseWeight: fromWeight,
        recordedWeight: toWeight,
        weightLoss,
        lossPercent: fromWeight > 0 ? this.round2((weightLoss / fromWeight) * 100) : 0,
      };
    });

    const inwardRows = inwards.map(e => {
      const related = cagesByInward.get(String(e.id)) || [];
      const birds = related.reduce((sum, c) => sum + (parseInt(String(c.numberOfBirds), 10) || 0), 0) || (e.numberOfBirds || 0);
      const purchaseWeight = this.round2(related.reduce((sum, c) => sum + this.num(c.purchaseWeight), 0));
      const recordedWeight = this.round2(related.reduce((sum, c) => {
        return sum + this.num(c.godownInwardWeight != null ? c.godownInwardWeight : c.purchaseWeight);
      }, 0));
      const cageLoss = related.reduce((sum, c) => {
        const purchaseWt = this.num(c.purchaseWeight);
        const godownWt = c.godownInwardWeight != null ? this.num(c.godownInwardWeight) : purchaseWt;
        return sum + this.stageLoss(purchaseWt, godownWt);
      }, 0);
      const storedLoss = this.num(e.weightLoss);
      const weightLoss = this.round2(cageLoss > 0.001 ? cageLoss : storedLoss);
      const fromWeight = purchaseWeight > 0 ? purchaseWeight : this.round2(this.num(e.actualWeight ?? e.totalWeight) + weightLoss);
      const toWeight = recordedWeight > 0 ? recordedWeight : this.num(e.actualWeight ?? e.totalWeight);
      return {
        channel: 'godown_inward',
        channelLabel: 'Godown Inward',
        documentNo: e.inwardNo || '-',
        date: e.entryDate,
        party: e.supplierName || '-',
        purchaseBillNo: e.purchaseInvoiceNo || '-',
        birds,
        purchaseWeight: fromWeight,
        recordedWeight: toWeight,
        weightLoss,
        lossPercent: fromWeight > 0 ? this.round2((weightLoss / fromWeight) * 100) : 0,
      };
    });

    const godownSalesRows = godownSales.map(s => {
      const related = cagesByGodownSale.get(String(s.id)) || [];
      const birds = related.reduce((sum, c) => sum + (parseInt(String(c.numberOfBirds), 10) || 0), 0) || (s.numberOfBirds || 0);
      const fromCageWeight = this.round2(related.reduce((sum, c) => {
        return sum + this.num(c.godownInwardWeight != null ? c.godownInwardWeight : c.purchaseWeight);
      }, 0));
      const recordedWeight = this.round2(related.reduce((sum, c) => {
        const fromWt = this.num(c.godownInwardWeight != null ? c.godownInwardWeight : c.purchaseWeight);
        return sum + this.num(c.godownSaleWeight != null ? c.godownSaleWeight : fromWt);
      }, 0));
      const cageLoss = related.reduce((sum, c) => {
        const fromWt = this.num(c.godownInwardWeight != null ? c.godownInwardWeight : c.purchaseWeight);
        const soldWt = c.godownSaleWeight != null ? this.num(c.godownSaleWeight) : fromWt;
        return sum + this.stageLoss(fromWt, soldWt);
      }, 0);
      const storedLoss = this.num(s.weightLoss);
      const cageWeightLoss = this.round2(cageLoss > 0.001 ? cageLoss : storedLoss);
      const fromWeight = fromCageWeight > 0 ? fromCageWeight : this.round2(this.num(s.totalWeight) + cageWeightLoss);
      const toWeight = recordedWeight > 0 ? recordedWeight : this.num(s.totalWeight);
      return {
        channel: 'godown_sales',
        channelLabel: 'Godown Sales',
        documentNo: s.invoiceNumber || s.saleNo || '-',
        date: s.saleDate,
        party: s.customerName || '-',
        purchaseBillNo: '-',
        birds,
        purchaseWeight: fromWeight,
        recordedWeight: toWeight,
        weightLoss: 0,
        lossPercent: 0,
      };
    });

    const salesChannel = this.channelSummary('vehicle_sales', 'Sales', salesRows);
    const inwardChannel = this.channelSummary('godown_inward', 'Godown Inward', inwardRows);

    const totalGodownInwardWeight = this.round2(
      inwards.reduce((sum, e) => sum + this.num(e.actualWeight ?? e.totalWeight), 0),
    );
    const totalGodownInwardBirds = inwards.reduce(
      (sum, e) => sum + (parseInt(String(e.numberOfBirds || 0), 10) || 0),
      0,
    );
    const totalGodownSaleWeight = this.round2(
      godownSales.reduce((sum, s) => sum + this.num(s.totalWeight), 0),
    );
    const godownSalesBirds = godownSales.reduce(
      (sum, s) => sum + (parseInt(String(s.numberOfBirds || 0), 10) || 0),
      0,
    );

    const availableCages = inwardIds.length
      ? await this.cageRepository.find({
          where: this.tenantWhere({ status: 'in_godown', godownInwardId: In(inwardIds) }),
        })
      : [];

    let availableBirds = availableCages.reduce(
      (sum, c) => sum + (parseInt(String(c.numberOfBirds), 10) || 0),
      0,
    );
    let availableBirdsWeight = this.round2(availableCages.reduce((sum, c) => {
      return sum + this.num(c.godownInwardWeight != null ? c.godownInwardWeight : c.purchaseWeight);
    }, 0));

    if (availableBirdsWeight <= 0) {
      availableBirds = Math.max(0, totalGodownInwardBirds - godownSalesBirds);
      const avgInwardWeight = totalGodownInwardBirds > 0
        ? totalGodownInwardWeight / totalGodownInwardBirds
        : 0;
      availableBirdsWeight = this.round2(availableBirds * avgInwardWeight);
    }

    const recordedGodownSalesWeight = this.round2(totalGodownSaleWeight + availableBirdsWeight);
    const godownSalesLoss = this.stageLoss(totalGodownInwardWeight, recordedGodownSalesWeight);
    const godownSalesChannel = {
      key: 'godown_sales',
      label: 'Godown Sales',
      documents: godownSalesRows.length,
      birds: godownSalesBirds,
      purchaseWeight: totalGodownInwardWeight,
      recordedWeight: recordedGodownSalesWeight,
      availableWeight: availableBirdsWeight,
      availableBirds,
      saleWeight: totalGodownSaleWeight,
      weightLoss: godownSalesLoss,
      lossPercent: totalGodownInwardWeight > 0
        ? this.round2((godownSalesLoss / totalGodownInwardWeight) * 100)
        : 0,
    };

    const godownSalesFormulaRow = {
      channel: 'godown_sales',
      channelLabel: 'Godown Sales',
      documentNo: 'Inward − Sale − Available',
      date: startDate || '',
      party: 'Total Inward − Total Sale − Available Birds Weight',
      purchaseBillNo: '-',
      birds: godownSalesBirds,
      purchaseWeight: totalGodownInwardWeight,
      recordedWeight: recordedGodownSalesWeight,
      weightLoss: godownSalesLoss,
      lossPercent: godownSalesChannel.lossPercent,
    };

    const byChannel = [salesChannel, inwardChannel, godownSalesChannel];
    const totalLoss = this.round2(byChannel.reduce((s, c) => s + c.weightLoss, 0));
    const totalPurchaseWeight = this.round2(byChannel.reduce((s, c) => s + c.purchaseWeight, 0));
    const totalRecordedWeight = this.round2(byChannel.reduce((s, c) => s + c.recordedWeight, 0));
    const totalBirds = byChannel.reduce((s, c) => s + c.birds, 0);

    return {
      summary: {
        totalLoss,
        totalBirds,
        totalPurchaseWeight,
        totalRecordedWeight,
        lossPercent: totalPurchaseWeight > 0 ? this.round2((totalLoss / totalPurchaseWeight) * 100) : 0,
        vehicleSalesLoss: salesChannel.weightLoss,
        godownInwardLoss: inwardChannel.weightLoss,
        godownSalesLoss: godownSalesChannel.weightLoss,
      },
      byChannel,
      details: [...salesRows, ...inwardRows, godownSalesFormulaRow, ...godownSalesRows],
      dateRange: { startDate, endDate },
    };
  }
}
