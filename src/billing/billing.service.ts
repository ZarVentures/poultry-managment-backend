import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingParty } from './entities/billing-party.entity';
import { BillingSale } from './entities/billing-sale.entity';
import { BillingPayment } from './entities/billing-payment.entity';
import { BillingLedger } from './entities/billing-ledger.entity';
import { getTodayIST } from '../common/date-utils';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(BillingParty) private partyRepo: Repository<BillingParty>,
    @InjectRepository(BillingSale) private saleRepo: Repository<BillingSale>,
    @InjectRepository(BillingPayment) private paymentRepo: Repository<BillingPayment>,
    @InjectRepository(BillingLedger) private ledgerRepo: Repository<BillingLedger>,
  ) {}

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

  async getLedger(partyId: string): Promise<BillingLedger[]> {
    return this.ledgerRepo.find({ where: { partyId }, order: { date: 'ASC', createdAt: 'ASC' } });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async addLedgerEntry(partyId: string, type: 'Sale' | 'Payment', refId: string, debit: number, credit: number, date: string) {
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
}
