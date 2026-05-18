import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { BillingParty, PartyType } from './entities/billing-party.entity';
import { BillingPayment } from './entities/billing-payment.entity';
import { BillingLedger, LedgerReferenceType } from './entities/billing-ledger.entity';
import { Expense } from '../expenses/expense.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { PurchaseOrder } from '../purchases/entities/purchase-order.entity';
import { Sale } from '../sales/sale.entity';
import { BillingSale } from './entities/billing-sale.entity';
import { getTodayIST } from '../common/date-utils';
import { Farmer } from '../farmers/farmer.entity';

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
    @InjectRepository(Farmer) private farmerRepo: Repository<Farmer>,
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

    // Create opening balance ledger entry if openingBalance is non-zero
    if (data.openingBalance && Number(data.openingBalance) !== 0) {
      const parsedOpening = Number(data.openingBalance);
      await this.ledgerRepo.save(this.ledgerRepo.create({
        partyId: savedId,
        referenceType: 'Opening',
        referenceId: savedId,
        debit: parsedOpening > 0 ? parsedOpening : 0,
        credit: parsedOpening < 0 ? Math.abs(parsedOpening) : 0,
        balance: parsedOpening,
        date: '2000-01-01', // Set to a very old date so it always acts as the starting seed balance
      }));
    }

    return this.partyRepo.findOne({ where: { id: savedId } }) as Promise<BillingParty>;
  }

  async updateParty(id: string, data: Partial<BillingParty>): Promise<BillingParty> {
    // Sync the "Opening" entry in the billing_ledger table when opening balance is updated
    if (data.openingBalance !== undefined) {
      const existingOpening = await this.ledgerRepo.findOne({
        where: { partyId: id, referenceType: 'Opening' },
      });

      const parsedOpening = Number(data.openingBalance || 0);

      if (existingOpening) {
        if (parsedOpening === 0) {
          await this.ledgerRepo.remove(existingOpening);
        } else {
          existingOpening.debit = parsedOpening > 0 ? parsedOpening : 0;
          existingOpening.credit = parsedOpening < 0 ? Math.abs(parsedOpening) : 0;
          existingOpening.balance = parsedOpening;
          await this.ledgerRepo.save(existingOpening);
        }
      } else if (parsedOpening !== 0) {
        await this.ledgerRepo.save(this.ledgerRepo.create({
          partyId: id,
          referenceType: 'Opening',
          referenceId: id,
          debit: parsedOpening > 0 ? parsedOpening : 0,
          credit: parsedOpening < 0 ? Math.abs(parsedOpening) : 0,
          balance: parsedOpening,
          date: '2000-01-01',
        }));
      }
    }

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

  async recordTransaction(data: {
    partyType: string;
    partyId: number;
    partyName: string;
    transactionType: string;
    transactionDate: string;
    amount: number;
    referenceType: string;
    referenceId: number;
    referenceNumber: string;
    description: string;
    notes?: string;
  }) {
    // Find or create billing party by name
    const party = await this.findOrCreatePartyByName(
      data.partyName,
      data.partyType === 'farmer' ? 'Farm' : 'Retailer'
    );

    // For a return, we credit the customer (we owe them, or they owe us less)
    const debit = data.transactionType === 'return' ? 0 : data.amount;
    const credit = data.transactionType === 'return' ? data.amount : 0;

    await this.addLedgerEntry(party.id, 'Voucher', data.referenceNumber, debit, credit, data.transactionDate);
    await this.recalculatePartyBalance(party.id);
  }

  async getLedger(partyId: string): Promise<BillingLedger[]> {
    const party = await this.partyRepo.findOne({ where: { id: partyId } });
    if (!party) return [];

    // Get direct ledger entries (e.g. Opening Balance, paid PaymentVouchers)
    const directEntries = await this.ledgerRepo.find({ where: { partyId }, order: { date: 'ASC', createdAt: 'ASC' } });

    const dynamicEntries: any[] = [];

    if (party.type === 'Farm') {
      // For a Farm (farmer), load their PurchaseOrders and PurchaseOrderPayments dynamically
      const purchaseOrders = await this.purchaseRepo.find({
        where: { supplierName: party.name },
        relations: ['payments'],
      });

      for (const po of purchaseOrders) {
        // 1. Add Purchase Order as a CREDIT entry (what we owe them increases)
        dynamicEntries.push({
          id: `po-${po.id}`,
          partyId,
          referenceType: 'Purchase',
          referenceId: po.orderNumber,
          debit: 0,
          credit: Number(po.netAmount || po.totalAmount || 0),
          balance: 0,
          date: po.orderDate,
          createdAt: po.createdAt,
        });

        // 2. Add each Purchase Order Payment as a DEBIT entry (what we owe them decreases)
        for (const pay of po.payments || []) {
          const payDate = pay.createdAt ? new Date(pay.createdAt).toISOString().split('T')[0] : po.orderDate;
          dynamicEntries.push({
            id: `pay-${pay.id}`,
            partyId,
            referenceType: 'Payment',
            referenceId: `${po.orderNumber}-P`,
            debit: Number(pay.amount),
            credit: 0,
            balance: 0,
            date: payDate,
            createdAt: pay.createdAt,
          });
        }
      }
    } else if (party.type === 'Retailer') {
      // For a Retailer, load their Sales and SalePayments dynamically
      const sales = await this.mainSaleRepo.find({
        where: { customerName: party.name },
        relations: ['payments'],
      });

      for (const sale of sales) {
        // 1. Add Sale as a DEBIT entry (what they owe us increases)
        dynamicEntries.push({
          id: `sale-${sale.id}`,
          partyId,
          referenceType: 'Sale',
          referenceId: sale.invoiceNumber || sale.saleNo || `INV-${sale.id}`,
          debit: Number(sale.netAmount || sale.totalAmount || 0),
          credit: 0,
          balance: 0,
          date: sale.saleDate,
          createdAt: sale.createdAt,
        });

        // 2. Add each Sale Payment as a CREDIT entry (what they owe us decreases)
        for (const pay of sale.payments || []) {
          const payDate = pay.createdAt ? new Date(pay.createdAt).toISOString().split('T')[0] : sale.saleDate;
          dynamicEntries.push({
            id: `pay-${pay.id}`,
            partyId,
            referenceType: 'Payment',
            referenceId: `${sale.invoiceNumber || sale.saleNo || `INV-${sale.id}`}-P`,
            debit: 0,
            credit: Number(pay.amount),
            balance: 0,
            date: payDate,
            createdAt: pay.createdAt,
          });
        }
      }
    }

    // Combine all entries
    const allEntries = [...directEntries, ...dynamicEntries];

    // Sort by date ASC, then by createdAt ASC
    allEntries.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Recalculate balances sequentially
    let balance = 0;
    for (const entry of allEntries) {
      balance += Number(entry.debit || 0) - Number(entry.credit || 0);
      entry.balance = balance;
    }

    return allEntries as BillingLedger[];
  }

  // Helper: Find or create billing party by name
  async findOrCreatePartyByName(name: string, type: PartyType = 'Retailer', phone?: string, address?: string): Promise<BillingParty> {
    // Try to find existing party by name (case-insensitive)
    const existing = await this.partyRepo
      .createQueryBuilder('party')
      .where('LOWER(party.name) = LOWER(:name)', { name })
      .getOne();
    
    if (existing) {
      // If the existing party has type 'Retailer' but they are actually a farmer, let's update their type to 'Farm'
      const isFarmer = await this.farmerRepo
        .createQueryBuilder('farmer')
        .where('LOWER(farmer.name) = LOWER(:name)', { name })
        .getOne();
      
      if (isFarmer && existing.type !== 'Farm') {
        existing.type = 'Farm';
        await this.partyRepo.save(existing);
      }
      return existing;
    }

    const isFarmer = await this.farmerRepo
      .createQueryBuilder('farmer')
      .where('LOWER(farmer.name) = LOWER(:name)', { name })
      .getOne();

    const calculatedType: PartyType = isFarmer ? 'Farm' : type;

    // Create new party
    const party = this.partyRepo.create({
      name,
      type: calculatedType,
      phone: phone || undefined,
      address: address || undefined,
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

    if (party.type !== 'Farm') {
      const ledgerEntries = await this.ledgerRepo.find({ where: { partyId }, order: { date: 'ASC', createdAt: 'ASC' } });

      let balance = 0;
      for (const entry of ledgerEntries) {
        balance += Number(entry.debit) - Number(entry.credit);
        await this.ledgerRepo.update(entry.id, { balance });
      }

      await this.partyRepo.update(partyId, { currentBalance: balance, updatedAt: new Date() });
      return;
    }

    // For a Farm party, get combined ledger entries to update current balance
    const ledgerEntries = await this.getLedger(partyId);
    const balance = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].balance : 0;
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
