import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { BillingParty } from './entities/billing-party.entity';
import { BillingPayment } from './entities/billing-payment.entity';
import { BillingLedger, LedgerReferenceType } from './entities/billing-ledger.entity';
import { Expense } from '../expenses/expense.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { PurchaseOrder } from '../purchases/entities/purchase-order.entity';
import { Sale } from '../sales/sale.entity';
import { BillingSale } from './entities/billing-sale.entity';
import { getTodayIST } from '../common/date-utils';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(BillingParty) private partyRepo: Repository<BillingParty>,
    @InjectRepository(BillingPayment) private paymentRepo: Repository<BillingPayment>,
    @InjectRepository(BillingLedger) private ledgerRepo: Repository<BillingLedger>,
    @InjectRepository(Expense) private expenseRepo: Repository<Expense>,
    @InjectRepository(InventoryItem) private inventoryRepo: Repository<InventoryItem>,
    @InjectRepository(PurchaseOrder) private purchaseRepo: Repository<PurchaseOrder>,
    @InjectRepository(BillingSale) private saleRepo: Repository<BillingSale>,
    @InjectRepository(Sale) private mainSaleRepo: Repository<Sale>,
  ) { }

  // ─── Parties ──────────────────────────────────────────────────────────────

  async getParties(): Promise<BillingParty[]> {
    return this.partyRepo.find({ order: { name: 'ASC' } });
  }

  async getParty(id: string): Promise<BillingParty> {
    const party = await this.partyRepo.findOne({ where: { id } });
    if (!party) throw new NotFoundException(`Party ${id} not found`);
    return party;
  }

  async createParty(data: Partial<BillingParty>): Promise<BillingParty> {
    const party = this.partyRepo.create(data);
    const saved = await this.partyRepo.save(party);
    const savedId: string = (saved as any).id ?? (saved as any)[0]?.id;

    // Create opening balance ledger entry if openingBalance > 0
    if (data.openingBalance && data.openingBalance !== 0) {
      await this.ledgerRepo.save(this.ledgerRepo.create({
        partyId: savedId,
        referenceType: 'Opening',
        referenceId: savedId,
        debit: data.openingBalance > 0 ? data.openingBalance : 0,
        credit: data.openingBalance < 0 ? Math.abs(data.openingBalance) : 0,
        balance: data.openingBalance,
        date: getTodayIST(),
      }));
    }

    return this.partyRepo.findOne({ where: { id: savedId } }) as Promise<BillingParty>;
  }

  async updateParty(id: string, data: Partial<BillingParty>): Promise<BillingParty> {
    await this.partyRepo.update(id, { ...data, updatedAt: new Date() });
    return this.getParty(id);
  }

  async deleteParty(id: string): Promise<void> {
    const party = await this.getParty(id);
    await this.partyRepo.remove(party);
  }

  // ─── Sales ────────────────────────────────────────────────────────────────

  async getSales(partyId?: string): Promise<BillingSale[]> {
    const where: any = {};
    if (partyId) where.partyId = partyId;
    return this.saleRepo.find({ where, order: { date: 'DESC' } });
  }

  async createSale(data: Partial<BillingSale>): Promise<BillingSale> {
    const sale = this.saleRepo.create(data);
    const saved = await this.saleRepo.save(sale);
    const savedId: string = (saved as any).id ?? (saved as any)[0]?.id;

    // Create ledger entry
    await this.addLedgerEntry(data.partyId!, 'Sale', savedId, data.totalAmount || 0, 0, data.date!);

    // Update party balance
    await this.recalculatePartyBalance(data.partyId!);

    return this.saleRepo.findOne({ where: { id: savedId } }) as Promise<BillingSale>;
  }

  async updateSale(id: string, data: Partial<BillingSale>): Promise<BillingSale> {
    await this.saleRepo.update(id, { ...data, updatedAt: new Date() });

    // Update ledger entry
    const ledger = await this.ledgerRepo.findOne({ where: { referenceType: 'Sale', referenceId: id } });
    if (ledger) {
      await this.ledgerRepo.update(ledger.id, { debit: data.totalAmount || ledger.debit, date: data.date || ledger.date });
    }

    const sale = await this.saleRepo.findOne({ where: { id } });
    if (sale) await this.recalculatePartyBalance(sale.partyId);

    return this.saleRepo.findOne({ where: { id } }) as Promise<BillingSale>;
  }

  async deleteSale(id: string): Promise<void> {
    const sale = await this.saleRepo.findOne({ where: { id } });
    if (!sale) throw new NotFoundException(`Sale ${id} not found`);
    await this.ledgerRepo.delete({ referenceType: 'Sale', referenceId: id });
    await this.saleRepo.remove(sale);
    await this.recalculatePartyBalance(sale.partyId);
  }

  // ─── Payments ─────────────────────────────────────────────────────────────

  async getPayments(partyId?: string): Promise<BillingPayment[]> {
    const where: any = {};
    if (partyId) where.partyId = partyId;
    return this.paymentRepo.find({ where, order: { date: 'DESC' } });
  }

  async createPayment(data: Partial<BillingPayment>): Promise<BillingPayment> {
    const payment = this.paymentRepo.create(data);
    const saved = await this.paymentRepo.save(payment);
    const savedId: string = (saved as any).id ?? (saved as any)[0]?.id;

    if (data.status === 'Completed') {
      await this.addLedgerEntry(data.partyId!, 'Payment', savedId, 0, data.amount || 0, data.date!);
      await this.recalculatePartyBalance(data.partyId!);
    }

    return this.paymentRepo.findOne({ where: { id: savedId } }) as Promise<BillingPayment>;
  }

  async updatePayment(id: string, data: Partial<BillingPayment>): Promise<BillingPayment> {
    const old = await this.paymentRepo.findOne({ where: { id } });
    if (!old) throw new NotFoundException(`Payment ${id} not found`);

    await this.paymentRepo.update(id, { ...data, updatedAt: new Date() });

    // Handle ledger based on status change
    const ledger = await this.ledgerRepo.findOne({ where: { referenceType: 'Payment', referenceId: id } });
    if (data.status === 'Completed') {
      if (ledger) {
        await this.ledgerRepo.update(ledger.id, { credit: data.amount || ledger.credit, date: data.date || ledger.date });
      } else {
        await this.addLedgerEntry(old.partyId, 'Payment', id, 0, data.amount || old.amount, data.date || old.date);
      }
    } else if (ledger) {
      await this.ledgerRepo.remove(ledger);
    }

    await this.recalculatePartyBalance(old.partyId);
    return this.paymentRepo.findOne({ where: { id } }) as Promise<BillingPayment>;
  }

  async deletePayment(id: string): Promise<void> {
    const payment = await this.paymentRepo.findOne({ where: { id } });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    await this.ledgerRepo.delete({ referenceType: 'Payment', referenceId: id });
    await this.paymentRepo.remove(payment);
    await this.recalculatePartyBalance(payment.partyId);
  }

  // ─── Ledger ───────────────────────────────────────────────────────────────
  async recordVoucher(partyId: string, refId: string, amount: number, date: string, type: 'debit' | 'credit' = 'credit') {
    const debit = type === 'debit' ? Number(amount) : 0;
    const credit = type === 'credit' ? Number(amount) : 0;
    await this.addLedgerEntry(partyId, 'Voucher', refId, debit, credit, date);
    await this.recalculatePartyBalance(partyId);
  }

  async getLedger(partyId: string): Promise<BillingLedger[]> {
    return this.ledgerRepo.find({ where: { partyId }, order: { date: 'ASC', createdAt: 'ASC' } });
  }

  // Helper: Find or create billing party by name
  async findOrCreatePartyByName(name: string, type: PartyType = 'Retailer', phone?: string, address?: string): Promise<BillingParty> {
    // Try to find existing party by name (case-insensitive)
    const existing = await this.partyRepo
      .createQueryBuilder('party')
      .where('LOWER(party.name) = LOWER(:name)', { name })
      .getOne();
    
    if (existing) {
      return existing;
    }

    // Create new party
    const party = this.partyRepo.create({
      name,
      type,
      phone: phone || null,
      address: address || null,
      openingBalance: 0,
      currentBalance: 0,
      creditLimit: 0,
      paymentTerms: 30,
    });

    return await this.partyRepo.save(party);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async addLedgerEntry(partyId: string, type: LedgerReferenceType, refId: string, debit: number, credit: number, date: string) {
    await this.ledgerRepo.save(this.ledgerRepo.create({ partyId, referenceType: type, referenceId: refId, debit, credit, balance: 0, date }));
  }

  private async recalculatePartyBalance(partyId: string) {
    const party = await this.partyRepo.findOne({ where: { id: partyId } });
    if (!party) return;

    const ledgerEntries = await this.ledgerRepo.find({ where: { partyId }, order: { date: 'ASC', createdAt: 'ASC' } });

    let balance = 0;
    for (const entry of ledgerEntries) {
      balance += Number(entry.debit) - Number(entry.credit);
      await this.ledgerRepo.update(entry.id, { balance });
    }

    await this.partyRepo.update(partyId, { currentBalance: balance, updatedAt: new Date() });
  }

  // ─── Summary ──────────────────────────────────────────────────────────────

  async getSummary() {
    const parties = await this.partyRepo.find();
    const sales = await this.saleRepo.find();
    const payments = await this.paymentRepo.find({ where: { status: 'Completed' } as any });

    return {
      totalParties: parties.length,
      totalSales: sales.reduce((s, x) => s + Number(x.totalAmount), 0),
      pendingPayments: parties.reduce((s, p) => s + Math.max(0, Number(p.currentBalance)), 0),
      totalLedgers: parties.length,
    };
  }

  async getCompanyReport(fromDate?: string, toDate?: string) {
    try {
      const salesQuery = this.mainSaleRepo.createQueryBuilder('sale')
        .leftJoinAndSelect('sale.retailer', 'retailer');

      if (fromDate && toDate) {
        salesQuery.where('sale.saleDate BETWEEN :fromDate AND :toDate', { fromDate, toDate });
      }
      const sales = await salesQuery.getMany();

      const purchasesQuery = this.purchaseRepo.createQueryBuilder('po');
      if (fromDate && toDate) {
        purchasesQuery.where('po.orderDate BETWEEN :fromDate AND :toDate', { fromDate, toDate });
      }
      const purchases = await purchasesQuery.getMany();

      const expensesQuery = this.expenseRepo.createQueryBuilder('exp');
      if (fromDate && toDate) {
        expensesQuery.where('exp.expenseDate BETWEEN :fromDate AND :toDate', { fromDate, toDate });
      }
      const expenses = await expensesQuery.getMany();

      const inventory = await this.inventoryRepo.find();

      const totalRevenue = sales.reduce((sum, s) => sum + Number(s.netAmount || s.totalAmount || 0), 0);

      const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.netAmount || p.grossAmount || 0), 0);
      const totalTransportCharges = purchases.reduce((sum, p) => sum + Number(p.transportCharges || 0), 0);
      const totalOtherCharges = purchases.reduce((sum, p) => sum + Number(p.otherCharges || 0), 0);

      const totalDirectExpenses = expenses
        .filter(e => ['feed', 'medicine', 'transportation'].includes(e.category || ''))
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const openingStock = 0;
      const closingStock = inventory.reduce((sum, item) => sum + Number(item.currentStockLevel || 0), 0);

      const cogs = openingStock + totalPurchases + totalTransportCharges + totalOtherCharges + totalDirectExpenses - closingStock;

      const grossProfit = totalRevenue - cogs;

      const operatingExpenses = expenses
        .filter(e => !['feed', 'medicine', 'transportation'].includes(e.category || ''))
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const netProfit = grossProfit - operatingExpenses;

      const partyWiseSales: Record<string, number> = {};
      for (const sale of sales) {
        const customerName = sale.customerName || 'Unknown';
        partyWiseSales[customerName] = (partyWiseSales[customerName] || 0) + Number(sale.netAmount || sale.totalAmount || 0);
      }

      const expenseBreakdown: Record<string, number> = {};
      for (const expense of expenses) {
        const category = expense.category || 'other';
        expenseBreakdown[category] = (expenseBreakdown[category] || 0) + Number(expense.amount);
      }

      const summary = {
        totalRevenue,
        costOfGoodsSold: cogs,
        grossProfit,
        operatingExpenses,
        netProfit,
        openingStock,
        closingStock,
        totalPurchases,
        totalDirectExpenses,
      };

      const detailedStatement = [
        { label: 'Sales Revenue', value: totalRevenue, type: 'income' },
        { label: 'Opening Stock', value: openingStock, type: 'expense' },
        { label: 'Purchases', value: totalPurchases, type: 'expense' },
        { label: 'Direct Expenses', value: totalDirectExpenses, type: 'expense' },
        { label: 'Closing Stock', value: closingStock, type: 'income' },
        { label: 'Cost of Goods Sold', value: cogs, type: 'expense' },
        { label: 'Gross Profit', value: grossProfit, type: 'profit' },
        { label: 'Operating Expenses', value: operatingExpenses, type: 'expense' },
        { label: 'Net Profit', value: netProfit, type: 'profit' },
      ];

      const keyInsights = [];
      if (totalRevenue > 0) {
        if (grossProfit > 0) {
          const grossMargin = ((grossProfit / totalRevenue) * 100).toFixed(1);
          keyInsights.push({ type: 'success', message: `Gross Profit Margin: ${grossMargin}%` });
        } else {
          keyInsights.push({ type: 'error', message: 'Gross Loss detected' });
        }
        if (netProfit > 0) {
          const netMargin = ((netProfit / totalRevenue) * 100).toFixed(1);
          keyInsights.push({ type: 'success', message: `Net Profit Margin: ${netMargin}%` });
        } else {
          keyInsights.push({ type: 'error', message: 'Net Loss detected' });
        }
        if (operatingExpenses > totalRevenue * 0.5) {
          keyInsights.push({ type: 'warning', message: 'Operating expenses exceed 50% of revenue' });
        }
      }

      const auditLog = {
        generatedAt: new Date().toISOString(),
        dateRange: fromDate && toDate ? { from: fromDate, to: toDate } : null,
        dataSources: {
          salesCount: sales.length,
          purchasesCount: purchases.length,
          expensesCount: expenses.length,
          inventoryItemsCount: inventory.length,
        },
      };

      return {
        summary,
        detailedStatement,
        partyWiseSales: Object.entries(partyWiseSales).map(([party, amount]) => ({ party, amount })),
        expenseBreakdown: Object.entries(expenseBreakdown).map(([category, amount]) => ({ category, amount })),
        keyInsights,
        auditLog,
      };
    } catch (error) {
      console.error('Error in getCompanyReport:', error);
      throw error;
    }
  }
}
