import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, SelectQueryBuilder, ObjectLiteral, Brackets } from 'typeorm';
import { BillingParty, PartyType } from './entities/billing-party.entity';
import { BillingPayment } from './entities/billing-payment.entity';
import { BillingLedger, LedgerReferenceType } from './entities/billing-ledger.entity';
import { Expense } from '../expenses/expense.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { PurchaseOrder } from '../purchases/entities/purchase-order.entity';
import { Sale } from '../sales/sale.entity';
import { Farmer } from '../farmers/farmer.entity';
import { Retailer } from '../retailers/retailer.entity';
import { GodownSale } from '../godown/entities/godown-sale.entity';
import { GodownSalePayment } from '../godown/entities/godown-sale-payment.entity';
import { BirdReturn } from '../sales/entities/bird-return.entity';
import { VehicleBirdReturn } from '../sales/entities/vehicle-bird-return.entity';
import { getTodayIST, normalizeToIST } from '../common/date-utils';
import { TenantContextService } from '../tenants/tenant-context.service';
//import { Farmer } from '../farmers/farmer.entity';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(BillingParty) private partyRepo: Repository<BillingParty>,
    @InjectRepository(BillingPayment) private paymentRepo: Repository<BillingPayment>,
    @InjectRepository(BillingLedger) private ledgerRepo: Repository<BillingLedger>,
    @InjectRepository(Expense) private expenseRepo: Repository<Expense>,
    @InjectRepository(InventoryItem) private inventoryRepo: Repository<InventoryItem>,
    @InjectRepository(PurchaseOrder) private purchaseRepo: Repository<PurchaseOrder>,
    @InjectRepository(Sale) private mainSaleRepo: Repository<Sale>,
    @InjectRepository(Farmer) private farmerRepo: Repository<Farmer>,
    @InjectRepository(Retailer) private retailerRepo: Repository<Retailer>,
    @InjectRepository(GodownSale) private godownSaleRepo: Repository<GodownSale>,
    @InjectRepository(GodownSalePayment) private godownSalePaymentRepo: Repository<GodownSalePayment>,
    @InjectRepository(BirdReturn) private birdReturnRepo: Repository<BirdReturn>,
    @InjectRepository(VehicleBirdReturn) private vehicleBirdReturnRepo: Repository<VehicleBirdReturn>,
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

  /** Calendar date YYYY-MM-DD. Never use toISOString() — that shifts IST dates back a day. */
  private toLedgerDate(value: string | Date | null | undefined, fallback?: string | Date | null): string {
    const pick = (raw: string | Date | null | undefined): string | null => {
      if (raw == null || raw === '') return null;
      if (raw instanceof Date) {
        if (Number.isNaN(raw.getTime())) return null;
        const utcMidnight =
          raw.getUTCHours() === 0 && raw.getUTCMinutes() === 0 && raw.getUTCSeconds() === 0;
        if (utcMidnight) {
          const y = raw.getUTCFullYear();
          const m = String(raw.getUTCMonth() + 1).padStart(2, '0');
          const d = String(raw.getUTCDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
        return normalizeToIST(raw.toISOString());
      }
      const text = String(raw).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
      const prefix = text.match(/^(\d{4}-\d{2}-\d{2})/);
      if (prefix && (text.includes('T00:00:00') || !text.includes('T'))) return prefix[1];
      if (text.includes('T') || text.includes(' ')) return normalizeToIST(text);
      return prefix ? prefix[1] : null;
    };
    return pick(value) || pick(fallback) || getTodayIST();
  }

  /**
   * Farm = supplier payable ledger.
   * Positive master opening means we owe the farmer, posted as credit (same as a purchase).
   * Running payable is credit - debit so the displayed balance stays positive.
   * Retailer/other parties keep the receivable convention (positive = debit).
   */
  private openingDebitCredit(partyType: string | undefined, parsedOpening: number) {
    const amount = Number(parsedOpening) || 0;
    if (partyType === 'Farm') {
      return {
        debit: amount < 0 ? Math.abs(amount) : 0,
        credit: amount > 0 ? amount : 0,
        balance: amount,
      };
    }
    return {
      debit: amount > 0 ? amount : 0,
      credit: amount < 0 ? Math.abs(amount) : 0,
      balance: amount,
    };
  }

  private ledgerSignedDelta(partyType: string | undefined, debit: number, credit: number) {
    const d = Number(debit || 0);
    const c = Number(credit || 0);
    return partyType === 'Farm' ? c - d : d - c;
  }

  private returnImpactAmount(r: { refundAmount?: number; adjustmentAmount?: number }) {
    return Number(r.refundAmount || 0) || Number(r.adjustmentAmount || 0);
  }

  private toReturnLedgerEntry(partyId: string, r: BirdReturn | VehicleBirdReturn, prefix: string) {
    const amount = this.returnImpactAmount(r);
    return {
      id: `${prefix}-${r.id}`,
      partyId,
      referenceType: 'Return',
      referenceId: r.returnNumber,
      debit: 0,
      credit: amount,
      balance: 0,
      date: this.toLedgerDate(r.returnDate),
      createdAt: r.createdAt,
      totalBirds: Number(r.numberOfBirdsReturned || 0),
      totalWeight: Number(r.weightReturned || 0),
    };
  }

  private processedReturnImpactBySale(returns: Array<BirdReturn | VehicleBirdReturn>) {
    const map: Record<string, number> = {};
    for (const r of returns) {
      if (r.status !== 'processed') continue;
      const saleId = String(r.saleId);
      map[saleId] = (map[saleId] || 0) + this.returnImpactAmount(r);
    }
    return map;
  }

  // ─── Parties ──────────────────────────────────────────────────────────────

  async getParties(): Promise<BillingParty[]> {
    return this.partyRepo.find({ where: this.tenantWhere({}), order: { name: 'ASC' } });
  }

  async getParty(id: string): Promise<BillingParty> {
    const party = await this.partyRepo.findOne({ where: this.tenantWhere({ id }) });
    if (!party) throw new NotFoundException(`Party ${id} not found`);
    return party;
  }

  async createParty(data: Partial<BillingParty>): Promise<BillingParty> {
    const party = this.partyRepo.create({ ...data, tenantId: this.getTenantId() ?? undefined });
    const saved = await this.partyRepo.save(party);
    const savedId: string = (saved as any).id ?? (saved as any)[0]?.id;

    // Create opening balance ledger entry if openingBalance is non-zero
    if (data.openingBalance && Number(data.openingBalance) !== 0) {
      const parsedOpening = Number(data.openingBalance);
      const { debit, credit, balance } = this.openingDebitCredit(data.type, parsedOpening);
      await this.ledgerRepo.save(this.ledgerRepo.create({
        partyId: savedId,
        referenceType: 'Opening',
        referenceId: savedId,
        debit,
        credit,
        balance,
        date: '2000-01-01', // Set to a very old date so it always acts as the starting seed balance
        tenantId: this.getTenantId() ?? undefined,
      }));
    }

    // Recalculate balance so currentBalance reflects opening balance
    await this.recalculatePartyBalance(savedId);

    return this.partyRepo.findOne({ where: this.tenantWhere({ id: savedId }) }) as Promise<BillingParty>;
  }

  async updateParty(id: string, data: Partial<BillingParty>): Promise<BillingParty> {
    // Sync the "Opening" entry in the billing_ledger table when opening balance is updated
    if (data.openingBalance !== undefined) {
      const existingParty = await this.partyRepo.findOne({ where: this.tenantWhere({ id }) });
      const partyType = data.type || existingParty?.type;
      const existingOpening = await this.ledgerRepo.findOne({
        where: this.tenantWhere({ partyId: id, referenceType: 'Opening' }),
      });

      const parsedOpening = Number(data.openingBalance || 0);
      const { debit, credit, balance } = this.openingDebitCredit(partyType, parsedOpening);

      if (existingOpening) {
        if (parsedOpening === 0) {
          await this.ledgerRepo.remove(existingOpening);
        } else {
          existingOpening.debit = debit;
          existingOpening.credit = credit;
          existingOpening.balance = balance;
          await this.ledgerRepo.save(existingOpening);
        }
      } else if (parsedOpening !== 0) {
        await this.ledgerRepo.save(this.ledgerRepo.create({
          partyId: id,
          referenceType: 'Opening',
          referenceId: id,
          debit,
          credit,
          balance,
          date: '2000-01-01',
          tenantId: this.getTenantId() ?? undefined,
        }));
      }
    }

    await this.partyRepo.update(id, { ...data, updatedAt: new Date() });
    await this.recalculatePartyBalance(id);
    return this.getParty(id);
  }

  async deleteParty(id: string): Promise<void> {
    const party = await this.getParty(id);
    await this.partyRepo.remove(party);
  }

  // ─── Sales (redirected to main sales module) ──────────────────────────────

  async getSales(partyId?: string): Promise<any[]> {
    if (partyId) {
      return this.mainSaleRepo.find({ where: this.tenantWhere({ customerName: partyId }) as any, order: { saleDate: 'DESC' } });
    }
    return this.mainSaleRepo.find({ where: this.tenantWhere({}), order: { saleDate: 'DESC' } });
  }

  async createSale(data: any): Promise<any> {
    throw new NotFoundException('Use POST /api/sales to create sales. Billing sales table does not exist.');
  }

  async updateSale(id: string, data: any): Promise<any> {
    throw new NotFoundException('Use PATCH /api/sales/:id to update sales. Billing sales table does not exist.');
  }

  async deleteSale(id: string): Promise<void> {
    throw new NotFoundException('Use DELETE /api/sales/:id to delete sales. Billing sales table does not exist.');
  }

  // ─── Payments ─────────────────────────────────────────────────────────────

  async getPayments(partyId?: string): Promise<BillingPayment[]> {
    const where: any = this.tenantWhere({});
    if (partyId) where.partyId = partyId;
    return this.paymentRepo.find({ where, order: { date: 'DESC' } });
  }

  async createPayment(data: Partial<BillingPayment>): Promise<BillingPayment> {
    const payment = this.paymentRepo.create({ ...data, tenantId: this.getTenantId() ?? undefined });
    const saved = await this.paymentRepo.save(payment);
    const savedId: string = (saved as any).id ?? (saved as any)[0]?.id;

    if (data.status === 'Completed') {
      await this.addLedgerEntry(data.partyId!, 'Payment', savedId, 0, data.amount || 0, data.date!);
      await this.recalculatePartyBalance(data.partyId!);
    }

    return this.paymentRepo.findOne({ where: this.tenantWhere({ id: savedId }) }) as Promise<BillingPayment>;
  }

  async updatePayment(id: string, data: Partial<BillingPayment>): Promise<BillingPayment> {
    const old = await this.paymentRepo.findOne({ where: this.tenantWhere({ id }) });
    if (!old) throw new NotFoundException(`Payment ${id} not found`);

    await this.paymentRepo.update(id, { ...data, updatedAt: new Date() });

    // Handle ledger based on status change
    const ledger = await this.ledgerRepo.findOne({ where: this.tenantWhere({ referenceType: 'Payment', referenceId: id }) });
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
    return this.paymentRepo.findOne({ where: this.tenantWhere({ id }) }) as Promise<BillingPayment>;
  }

  async deletePayment(id: string): Promise<void> {
    const payment = await this.paymentRepo.findOne({ where: this.tenantWhere({ id }) });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    await this.ledgerRepo.delete({ referenceType: 'Payment', referenceId: id });
    await this.paymentRepo.remove(payment);
    await this.recalculatePartyBalance(payment.partyId);
  }

  // ─── Ledger ───────────────────────────────────────────────────────────────
  async recordVoucher(partyId: string, refId: string, amount: number, date: string, type: 'debit' | 'credit' = 'credit') {
    const debit = type === 'debit' ? Number(amount) : 0;
    const credit = type === 'credit' ? Number(amount) : 0;

    const existing = await this.ledgerRepo.findOne({
      where: this.tenantWhere({ referenceType: 'Voucher', referenceId: refId })
    });

    if (existing) {
      existing.partyId = partyId;
      existing.debit = debit;
      existing.credit = credit;
      existing.date = date;
      await this.ledgerRepo.save(existing);
    } else {
      await this.addLedgerEntry(partyId, 'Voucher', refId, debit, credit, date);
    }

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
    const party = await this.partyRepo.findOne({ where: this.tenantWhere({ id: partyId }) });
    if (!party) return [];

    // Get direct ledger entries (e.g. Opening Balance, paid PaymentVouchers)
    const directEntries = await this.ledgerRepo.find({ where: this.tenantWhere({ partyId }), order: { date: 'ASC', createdAt: 'ASC' } });

    // Align Opening debit/credit with master opening (positive = payable/credit).
    if (party.type === 'Farm') {
      for (const entry of directEntries) {
        if (entry.referenceType !== 'Opening') continue;
        const stored = Number(party.openingBalance);
        const amount = Number.isFinite(stored) && stored !== 0
          ? stored
          : Number(entry.credit || 0) - Number(entry.debit || 0);
        const { debit, credit, balance } = this.openingDebitCredit('Farm', amount);
        entry.debit = debit;
        entry.credit = credit;
        entry.balance = balance;
      }
    }

    const dynamicEntries: any[] = [];

    if (party.type === 'Farm') {
      // For a Farm (farmer), load their PurchaseOrders and PurchaseOrderPayments dynamically (case-insensitive)
      const purchaseQuery = this.purchaseRepo
        .createQueryBuilder('po')
        .leftJoinAndSelect('po.payments', 'payments')
        .where('TRIM(LOWER(po.supplierName)) = TRIM(LOWER(:name))', { name: party.name });
      this.applyTenant(purchaseQuery, 'po');
      const purchaseOrders = await purchaseQuery.getMany();

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
          date: this.toLedgerDate(po.orderDate),
          createdAt: po.createdAt,
        });

        // 2. Add each Purchase Order Payment as a DEBIT entry (what we owe them decreases)
        for (const pay of po.payments || []) {
          const payDate = this.toLedgerDate((pay as any).paymentDate || pay.createdAt, po.orderDate);
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
      const retailer = await this.retailerRepo
        .createQueryBuilder('retailer')
        .where('TRIM(LOWER(retailer.name)) = TRIM(LOWER(:name))', { name: party.name });
      this.applyTenant(retailer, 'retailer');
      const matchedRetailer = await retailer.getOne();

      const vehicleReturnQuery = this.vehicleBirdReturnRepo
        .createQueryBuilder('vr')
        .where('vr.status <> :rejected', { rejected: 'rejected' })
        .andWhere(new Brackets((qb) => {
          qb.where('TRIM(LOWER(vr.customerName)) = TRIM(LOWER(:name))', { name: party.name });
          if (matchedRetailer?.id) {
            qb.orWhere('vr.retailerId = :retailerId', { retailerId: matchedRetailer.id });
          }
        }));
      this.applyTenant(vehicleReturnQuery, 'vr');
      const vehicleReturns = await vehicleReturnQuery.getMany();

      const godownReturnQuery = this.birdReturnRepo
        .createQueryBuilder('gr')
        .where('gr.status <> :rejected', { rejected: 'rejected' })
        .andWhere(new Brackets((qb) => {
          qb.where('TRIM(LOWER(gr.customerName)) = TRIM(LOWER(:name))', { name: party.name });
          if (matchedRetailer?.id) {
            qb.orWhere('gr.retailerId = :retailerId', { retailerId: matchedRetailer.id });
          }
        }));
      this.applyTenant(godownReturnQuery, 'gr');
      const godownReturns = await godownReturnQuery.getMany();

      const vehicleReturnImpact = this.processedReturnImpactBySale(vehicleReturns);
      const godownReturnImpact = this.processedReturnImpactBySale(godownReturns);

      // For a Retailer, load their Sales and SalePayments dynamically (case-insensitive)
      const saleQuery = this.mainSaleRepo
        .createQueryBuilder('sale')
        .leftJoinAndSelect('sale.payments', 'payments')
        .where(new Brackets((qb) => {
          qb.where('TRIM(LOWER(sale.customerName)) = TRIM(LOWER(:name))', { name: party.name });
          if (matchedRetailer?.id) {
            qb.orWhere('sale.retailerId = :saleRetailerId', { saleRetailerId: matchedRetailer.id });
          }
        }));
      this.applyTenant(saleQuery, 'sale');
      const sales = await saleQuery.getMany();

      for (const sale of sales) {
        const restored = Number(sale.netAmount || sale.totalAmount || 0) + (vehicleReturnImpact[String(sale.id)] || 0);
        dynamicEntries.push({
          id: `sale-${sale.id}`,
          partyId,
          referenceType: 'Sale',
          referenceId: sale.invoiceNumber || sale.saleNo || `INV-${sale.id}`,
          debit: restored,
          credit: 0,
          balance: 0,
          date: this.toLedgerDate(sale.saleDate),
          createdAt: sale.createdAt,
        });

        for (const pay of sale.payments || []) {
          const payDate = this.toLedgerDate((pay as any).paymentDate || pay.createdAt, sale.saleDate);
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

      const godownQuery = this.godownSaleRepo
        .createQueryBuilder('gs')
        .leftJoinAndSelect('gs.payments', 'gsPayments')
        .where(new Brackets((qb) => {
          qb.where('TRIM(LOWER(gs.customerName)) = TRIM(LOWER(:name))', { name: party.name });
          if (matchedRetailer?.id) {
            qb.orWhere('gs.retailerId = :gsRetailerId', { gsRetailerId: matchedRetailer.id });
          }
        }));
      this.applyTenant(godownQuery, 'gs');
      const godownSales = await godownQuery.getMany();

      for (const gs of godownSales) {
        const saleDate = this.toLedgerDate(gs.saleDate);
        const restored = Number(gs.totalAmount || 0) + (godownReturnImpact[String(gs.id)] || 0);
        dynamicEntries.push({
          id: `gs-${gs.id}`,
          partyId,
          referenceType: 'Sale',
          referenceId: gs.invoiceNumber || gs.saleNo || `GS-${gs.id}`,
          debit: restored,
          credit: 0,
          balance: 0,
          date: saleDate,
          createdAt: gs.createdAt,
        });

        for (const pay of gs.payments || []) {
          const payDate = this.toLedgerDate((pay as any).paymentDate, saleDate);
          dynamicEntries.push({
            id: `gspay-${pay.id}`,
            partyId,
            referenceType: 'Payment',
            referenceId: `${gs.invoiceNumber || gs.saleNo || `GS-${gs.id}`}-P`,
            debit: 0,
            credit: Number(pay.amount),
            balance: 0,
            date: payDate,
            createdAt: pay.createdAt,
          });
        }
      }

      for (const r of vehicleReturns) {
        dynamicEntries.push(this.toReturnLedgerEntry(partyId, r, 'vret'));
      }
      for (const r of godownReturns) {
        dynamicEntries.push(this.toReturnLedgerEntry(partyId, r, 'gret'));
      }

      const returnKeys = new Set(
        [...vehicleReturns, ...godownReturns].map((r) => `${r.returnDate}|${this.returnImpactAmount(r)}`),
      );
      for (let i = directEntries.length - 1; i >= 0; i--) {
        const entry = directEntries[i];
        const isReturnVoucher =
          (entry.referenceType === 'Voucher' || entry.referenceType === 'Return') &&
          Number(entry.credit || 0) > 0 &&
          returnKeys.has(`${entry.date}|${Number(entry.credit)}`);
        if (isReturnVoucher) directEntries.splice(i, 1);
      }
    }

    // Combine all entries
    const allEntries = [...directEntries, ...dynamicEntries].map((entry) => ({
      ...entry,
      date: this.toLedgerDate(entry.date),
    }));

    // Sort by date ASC, then by createdAt ASC
    allEntries.sort((a, b) => {
      if (a.date !== b.date) {
        return String(a.date).localeCompare(String(b.date));
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Recalculate balances sequentially.
    // Farm payable: Opening + Purchases (credit) - Payments/OUT vouchers (debit).
    // Retailer receivable: Sales (debit) - Payments (credit).
    let balance = 0;
    for (const entry of allEntries) {
      balance += this.ledgerSignedDelta(party.type, Number(entry.debit || 0), Number(entry.credit || 0));
      entry.balance = balance;
    }

    return allEntries.map((entry) => ({
      id: entry.id,
      partyId: entry.partyId,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      debit: Number(entry.debit || 0),
      credit: Number(entry.credit || 0),
      balance: Number(entry.balance || 0),
      date: entry.date,
      createdAt: entry.createdAt,
      totalBirds: Number((entry as any).totalBirds || (entry as any).numberOfBirdsReturned || 0),
      totalWeight: Number((entry as any).totalWeight || (entry as any).weightReturned || 0),
      ratePerKg: Number((entry as any).ratePerKg || 0),
    })) as unknown as BillingLedger[];
  }

  // ── Ledger by Farmer ID ───────────────────────────────────────────────────
  async getLedgerByFarmerId(farmerId: string): Promise<BillingLedger[]> {
    const farmer = await this.farmerRepo.findOne({ where: this.tenantWhere({ id: farmerId }) });
    if (!farmer) throw new NotFoundException(`Farmer ${farmerId} not found`);
    const party = await this.findOrCreatePartyByName(farmer.name, 'Farm', farmer.phone, farmer.address);
    const farmerOpening = Number(farmer.openingBalance || 0);
    if (farmerOpening !== Number(party.openingBalance || 0)) {
      await this.updateParty(party.id, { openingBalance: farmerOpening });
    }
    return this.getLedger(party.id);
  }

  // ── Ledger by Retailer ID ─────────────────────────────────────────────────
  async getLedgerByRetailerId(retailerId: string): Promise<BillingLedger[]> {
    const retailer = await this.retailerRepo.findOne({ where: this.tenantWhere({ id: retailerId }) });
    if (!retailer) throw new NotFoundException(`Retailer ${retailerId} not found`);
    const party = await this.findOrCreatePartyByName(retailer.name, 'Retailer', retailer.phone, retailer.address);
    return this.getLedger(party.id);
  }

  // Helper: Find or create billing party by name
  async findOrCreatePartyByName(name: string, type: PartyType = 'Retailer', phone?: string, address?: string): Promise<BillingParty> {
    // Try to find existing party by name (case-insensitive & trimmed)
    const partyQuery = this.partyRepo
      .createQueryBuilder('party')
      .where('TRIM(LOWER(party.name)) = TRIM(LOWER(:name))', { name });
    this.applyTenant(partyQuery, 'party');
    const existing = await partyQuery.getOne();
    
    if (existing) {
      // If the existing party has type 'Retailer' but they are actually a farmer, let's update their type to 'Farm'
      const farmerQuery = this.farmerRepo
        .createQueryBuilder('farmer')
        .where('TRIM(LOWER(farmer.name)) = TRIM(LOWER(:name))', { name });
      this.applyTenant(farmerQuery, 'farmer');
      const isFarmer = await farmerQuery.getOne();
      
      if (isFarmer && existing.type !== 'Farm') {
        existing.type = 'Farm';
        await this.partyRepo.save(existing);
      }
      return existing;
    }

    const farmerQuery = this.farmerRepo
      .createQueryBuilder('farmer')
      .where('TRIM(LOWER(farmer.name)) = TRIM(LOWER(:name))', { name });
    this.applyTenant(farmerQuery, 'farmer');
    const isFarmer = await farmerQuery.getOne();

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
      tenantId: this.getTenantId() ?? undefined,
    });

    return await this.partyRepo.save(party);
  }

  // ─── Opening Balance Sync ──────────────────────────────────────────────────
  async syncFarmerOpeningBalance(farmerId: string, name: string, phone?: string, address?: string, openingBalance?: number) {
    const party = await this.findOrCreatePartyByName(name, 'Farm', phone, address);
    if (openingBalance !== undefined) {
      await this.updateParty(party.id, { openingBalance });
    }
  }

  async syncRetailerOpeningBalance(retailerId: string, name: string, phone?: string, address?: string, openingBalance?: number) {
    const party = await this.findOrCreatePartyByName(name, 'Retailer', phone, address);
    if (openingBalance !== undefined) {
      await this.updateParty(party.id, { openingBalance });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async addLedgerEntry(partyId: string, type: LedgerReferenceType, refId: string, debit: number, credit: number, date: string) {
    await this.ledgerRepo.save(this.ledgerRepo.create({ partyId, referenceType: type, referenceId: refId, debit, credit, balance: 0, date, tenantId: this.getTenantId() ?? undefined }));
  }

  private async recalculatePartyBalance(partyId: string) {
    const party = await this.partyRepo.findOne({ where: this.tenantWhere({ id: partyId }) });
    if (!party) return;

    if (party.type !== 'Farm') {
      const ledgerEntries = await this.ledgerRepo.find({ where: this.tenantWhere({ partyId }), order: { date: 'ASC', createdAt: 'ASC' } });

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
    const parties = await this.partyRepo.find({ where: this.tenantWhere({}) });
    const payments = await this.paymentRepo.find({ where: this.tenantWhere({ status: 'Completed' }) as any });
    const sales = await this.mainSaleRepo.find({ where: this.tenantWhere({}) });

    return {
      totalParties: parties.length,
      totalSales: sales.reduce((s, x) => s + Number(x.totalAmount || x.netAmount || 0), 0),
      pendingPayments: parties.reduce((s, p) => s + Math.max(0, Number(p.currentBalance)), 0),
      totalLedgers: parties.length,
    };
  }

  async getCompanyReport(fromDate?: string, toDate?: string) {
    try {
      const salesQuery = this.mainSaleRepo.createQueryBuilder('sale')
        .leftJoinAndSelect('sale.retailer', 'retailer');
      this.applyTenant(salesQuery, 'sale');

      if (fromDate && toDate) {
        salesQuery.andWhere('sale.saleDate BETWEEN :fromDate AND :toDate', { fromDate, toDate });
      }
      const sales = await salesQuery.getMany();

      const purchasesQuery = this.purchaseRepo.createQueryBuilder('po');
      this.applyTenant(purchasesQuery, 'po');
      if (fromDate && toDate) {
        purchasesQuery.andWhere('po.orderDate BETWEEN :fromDate AND :toDate', { fromDate, toDate });
      }
      const purchases = await purchasesQuery.getMany();

      const expensesQuery = this.expenseRepo.createQueryBuilder('exp');
      this.applyTenant(expensesQuery, 'exp');
      if (fromDate && toDate) {
        expensesQuery.andWhere('exp.expenseDate BETWEEN :fromDate AND :toDate', { fromDate, toDate });
      }
      const expenses = await expensesQuery.getMany();

      const inventory = await this.inventoryRepo.find({ where: this.tenantWhere({}) });

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
