import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../tenants/tenant-context.service';
import { GodownService } from '../godown/godown.service';

type Line = { key: string; label: string; amount: number; note?: string };

@Injectable()
export class BalanceSheetService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly godownService: GodownService,
  ) {}

  private n(value: any): number {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private today(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private tenantFilter(alias: string, params: any[]): string {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) return '';
    params.push(tenantId);
    return ` AND ${alias}.tenant_id = $${params.length}`;
  }

  private async one(sql: string, params: any[]): Promise<Record<string, any>> {
    const rows = await this.dataSource.query(sql, params);
    return rows[0] || {};
  }

  async getInventoryValuation(asOnDate?: string) {
    const asOn =
      asOnDate && /^\d{4}-\d{2}-\d{2}$/.test(asOnDate) ? asOnDate : this.today();

    const [purchases, inward, godownSold, godownDead, transportDead, vehicleSold, ledger] = await Promise.all([
      this.purchasePosition(asOn),
      this.godownInward(asOn),
      this.godownSoldTotals(asOn),
      this.godownMortality(asOn),
      this.transportMortality(asOn),
      this.vehicleSold(asOn),
      this.godownService.getStockLedger({ endDate: asOn }),
    ]);

    const inwardWeight = inward.weight;
    const inwardValue = inward.value;
    const inwardAvgKg = inward.birds > 0 && inwardWeight > 0 ? inwardWeight / inward.birds : 0;
    const godownDeadKg = godownDead.weight + this.n(godownDead.birdsWithoutWeight) * inwardAvgKg;
    const ledgerBirds = Math.max(0, this.n(ledger?.closing?.birds));
    const ledgerWeight = Math.max(0, this.n(ledger?.closing?.weight));
    const formulaBirds = Math.max(0, inward.birds - godownSold.birds - godownDead.birds);
    const formulaWeight = Math.max(0, inwardWeight - godownSold.weight - godownDeadKg);
    const remainingBirds = ledgerBirds > 0 || ledgerWeight > 0 ? ledgerBirds : formulaBirds;
    let remainingWeight = ledgerWeight > 0 ? ledgerWeight : formulaWeight;
    if (remainingWeight <= 0 && remainingBirds > 0 && inward.birds > 0 && inwardWeight > 0) {
      remainingWeight = remainingBirds * (inwardWeight / inward.birds);
    }
    const purchaseRate = this.n(purchases.ratePerKg) > 0
      ? this.n(purchases.ratePerKg)
      : (purchases.weight > 0 ? purchases.net / purchases.weight : 0);
    const godownRate = this.n(inward.ratePerKg) > 0
      ? this.n(inward.ratePerKg)
      : (inwardWeight > 0 && inwardValue > 0 ? inwardValue / inwardWeight : purchaseRate);
    const godownInventory = this.round2(remainingWeight * godownRate);

    const purchaseAvgKg = purchases.birds > 0 && purchases.weight > 0
      ? purchases.weight / purchases.birds
      : 0;
    const transportDeadKg = this.round2(
      transportDead.weight + this.n(transportDead.birdsWithoutWeight) * purchaseAvgKg,
    );
    const vehicleWeight = Math.max(
      0,
      purchases.weight - inward.weight - vehicleSold.weight - transportDeadKg,
    );
    const vehicleBirds = Math.max(
      0,
      purchases.birds - inward.birds - vehicleSold.birds - transportDead.birds,
    );
    const vehicleInventory = this.round2(vehicleWeight * purchaseRate);
    const inventoryValue = this.round2(godownInventory + vehicleInventory);

    return {
      asOn,
      godownInventory,
      vehicleInventory,
      inventoryValue,
      remainingBirds,
      remainingWeight: this.round2(remainingWeight),
      vehicleBirds,
      vehicleWeight: this.round2(vehicleWeight),
      godownRate: this.round2(godownRate),
      purchaseRate: this.round2(purchaseRate),
    };
  }

  async getBalanceSheet(asOnDate?: string, fromDate?: string) {
    const asOn =
      asOnDate && /^\d{4}-\d{2}-\d{2}$/.test(asOnDate) ? asOnDate : this.today();
    const from =
      fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate) ? fromDate : undefined;

    const [
      vehicleSales,
      godownSales,
      purchases,
      expenses,
      retailerOpening,
      farmerOpening,
      inventory,
      vouchers,
    ] = await Promise.all([
      this.salesPosition('sales', 'sale_payments', 'sale_id', 'net_amount', asOn),
      this.salesPosition('godown_sales', 'godown_sale_payments', 'godown_sale_id', 'total_amount', asOn),
      this.purchasePosition(asOn),
      this.expenseTotal(asOn),
      this.openingSplit('retailers', asOn),
      this.openingSplit('farmers', asOn),
      this.getInventoryValuation(asOn),
      this.voucherTotals(asOn),
    ]);

    const tradeReceivable = vehicleSales.receivable + godownSales.receivable;
    const customerAdvances = vehicleSales.advances + godownSales.advances;
    const collections = vehicleSales.received + godownSales.received;
    const revenue = vehicleSales.billed + godownSales.billed;

    const operatingExpenses = expenses;
    const voucherIn = vouchers.in;
    const voucherOut = vouchers.out;

    const cash = this.round2(
      collections + voucherIn - purchases.paid - operatingExpenses - voucherOut,
    );

    const accountsReceivable = this.round2(
      tradeReceivable + retailerOpening.positive + farmerOpening.negative + purchases.prepaid,
    );
    const accountsPayable = this.round2(
      purchases.payable + farmerOpening.positive + retailerOpening.negative,
    );

    const remainingBirds = inventory.remainingBirds;
    const remainingWeight = inventory.remainingWeight;
    const godownInventory = inventory.godownInventory;
    const vehicleBirds = inventory.vehicleBirds;
    const vehicleWeight = inventory.vehicleWeight;
    const vehicleInventory = inventory.vehicleInventory;
    const inventoryValue = inventory.inventoryValue;

    const cashAsset = Math.max(0, cash);
    const bankOverdraft = Math.max(0, -cash);

    const assetsLines: Line[] = [
      {
        key: 'cash',
        label: 'Cash & bank (derived)',
        amount: cashAsset,
        note: 'Collections minus purchase payments, expenses, and standalone payment-out vouchers.',
      },
      {
        key: 'receivables',
        label: 'Accounts receivable',
        amount: accountsReceivable,
        note: 'Unpaid vehicle and godown sales, opening dues, and extra purchase payments.',
      },
      {
        key: 'inventory',
        label: 'Inventory (godown + vehicle)',
        amount: inventoryValue,
        note: `Godown ${remainingBirds} birds / ${this.round2(remainingWeight)} kg. Vehicle ${vehicleBirds} birds / ${this.round2(vehicleWeight)} kg not yet inwarded or sold.`,
      },
    ];
    const totalAssets = this.round2(assetsLines.reduce((s, l) => s + l.amount, 0));

    const liabilityLines: Line[] = [
      {
        key: 'payables',
        label: 'Accounts payable',
        amount: accountsPayable,
        note: 'Unpaid purchases, farmer opening dues, and retailer advances.',
      },
      {
        key: 'customerAdvances',
        label: 'Customer advances',
        amount: this.round2(customerAdvances),
        note: 'Collections above invoice value.',
      },
      {
        key: 'overdraft',
        label: 'Cash overdraft (derived)',
        amount: bankOverdraft,
        note: 'Shown when derived cash is negative (opening cash is not stored).',
      },
    ].filter((line) => line.amount > 0 || line.key === 'payables');

    const totalLiabilities = this.round2(liabilityLines.reduce((s, l) => s + l.amount, 0));
    const retainedEarnings = this.round2(totalAssets - totalLiabilities);
    const equityLines: Line[] = [
      {
        key: 'capital',
        label: "Owner's capital (not tracked)",
        amount: 0,
        note: 'No capital / opening cash account exists yet.',
      },
      {
        key: 'retained',
        label: 'Retained earnings (balancing figure)',
        amount: retainedEarnings,
        note: 'Assets minus liabilities.',
      },
    ];
    const totalEquity = this.round2(equityLines.reduce((s, l) => s + l.amount, 0));
    const liabilitiesAndEquity = this.round2(totalLiabilities + totalEquity);

    const cogs = this.round2(Math.max(0, purchases.net - inventoryValue));
    const grossProfit = this.round2(revenue - cogs);
    const netProfit = this.round2(grossProfit - operatingExpenses);
    const difference = this.round2(totalAssets - liabilitiesAndEquity);

    let periodRevenue = this.round2(revenue);
    let periodCogs = cogs;
    let periodGross = grossProfit;
    let periodExpenses = this.round2(operatingExpenses);
    let periodNet = netProfit;
    let periodCash = {
      vehicleCollections: this.round2(vehicleSales.received),
      godownCollections: this.round2(godownSales.received),
      voucherIn: this.round2(voucherIn),
      purchasePayments: this.round2(purchases.paid),
      expenses: this.round2(operatingExpenses),
      voucherOut: this.round2(voucherOut),
      netCash: cash,
    };

    if (from && from <= asOn) {
      const [pVehicle, pGodown, pPurchases, pExpenses, pVouchers] = await Promise.all([
        this.salesPeriod('sales', 'sale_payments', 'sale_id', 'net_amount', from, asOn),
        this.salesPeriod('godown_sales', 'godown_sale_payments', 'godown_sale_id', 'total_amount', from, asOn),
        this.purchasePeriod(from, asOn),
        this.expensePeriod(from, asOn),
        this.voucherPeriod(from, asOn),
      ]);
      periodRevenue = this.round2(pVehicle.billed + pGodown.billed);
      periodExpenses = this.round2(pExpenses);
      periodCogs = this.round2(pPurchases.net);
      periodGross = this.round2(periodRevenue - periodCogs);
      periodNet = this.round2(periodGross - periodExpenses);
      const pCash = this.round2(
        pVehicle.received + pGodown.received + pVouchers.in - pPurchases.paid - pExpenses - pVouchers.out,
      );
      periodCash = {
        vehicleCollections: this.round2(pVehicle.received),
        godownCollections: this.round2(pGodown.received),
        voucherIn: this.round2(pVouchers.in),
        purchasePayments: this.round2(pPurchases.paid),
        expenses: this.round2(pExpenses),
        voucherOut: this.round2(pVouchers.out),
        netCash: pCash,
      };
    }

    return {
      asOnDate: asOn,
      fromDate: from || undefined,
      toDate: asOn,
      generatedAt: new Date().toISOString(),
      assets: { lines: assetsLines, total: totalAssets },
      liabilities: { lines: liabilityLines, total: totalLiabilities },
      equity: { lines: equityLines, total: totalEquity },
      totals: {
        assets: totalAssets,
        liabilitiesAndEquity,
        difference,
        isBalanced: difference === 0,
      },
      notes: {
        basis: from
          ? `Position as on ${asOn}. P&L and cash movement are for ${from} to ${asOn}. Not a double-entry ledger.`
          : 'SQL totals from purchases, sales, godown stock, expenses, and payments. Not a double-entry ledger.',
        inventory: {
          birds: remainingBirds + vehicleBirds,
          weightKg: this.round2(remainingWeight + vehicleWeight),
          avgRatePerKg: this.round2(
            remainingWeight + vehicleWeight > 0
              ? inventoryValue / (remainingWeight + vehicleWeight)
              : 0,
          ),
          godown: {
            birds: remainingBirds,
            weightKg: this.round2(remainingWeight),
            value: godownInventory,
          },
          vehicle: {
            birds: vehicleBirds,
            weightKg: this.round2(vehicleWeight),
            value: vehicleInventory,
          },
        },
        profitAndLoss: {
          revenue: periodRevenue,
          costOfGoodsSold: periodCogs,
          grossProfit: periodGross,
          operatingExpenses: periodExpenses,
          netProfit: periodNet,
        },
        cashMovements: periodCash,
      },
    };
  }

  private async salesPosition(
    saleTable: 'sales' | 'godown_sales',
    payTable: 'sale_payments' | 'godown_sale_payments',
    fk: 'sale_id' | 'godown_sale_id',
    billedCol: 'net_amount' | 'total_amount',
    asOn: string,
  ) {
    const params: any[] = [asOn];
    const tenant = this.tenantFilter('s', params);
    const weightExpr =
      saleTable === 'sales'
        ? `COALESCE(s.quantity, 0)`
        : `COALESCE(s.total_weight, 0)`;
    const row = await this.one(
      `
      SELECT
        COALESCE(SUM(x.billed), 0) AS billed,
        COALESCE(SUM(x.received), 0) AS received,
        COALESCE(SUM(GREATEST(x.billed - x.received, 0)), 0) AS receivable,
        COALESCE(SUM(GREATEST(x.received - x.billed, 0)), 0) AS advances,
        COALESCE(SUM(x.birds), 0) AS birds,
        COALESCE(SUM(x.weight), 0) AS weight
      FROM (
        SELECT
          s.${billedCol}::numeric AS billed,
          CASE
            WHEN COALESCE(p.pay_cnt, 0) > 0 THEN COALESCE(p.paid, 0)
            ELSE COALESCE(s.amount_received, 0)
          END::numeric AS received,
          COALESCE(s.number_of_birds, 0)::numeric AS birds,
          ${weightExpr}::numeric AS weight
        FROM ${saleTable} s
        LEFT JOIN (
          SELECT ${fk} AS sid, SUM(amount) AS paid, COUNT(*) AS pay_cnt
          FROM ${payTable}
          WHERE created_at::date <= $1
          GROUP BY ${fk}
        ) p ON p.sid = s.id
        WHERE s.sale_date <= $1
        ${tenant}
      ) x
      `,
      params,
    );

    return {
      billed: this.n(row.billed),
      received: this.n(row.received),
      receivable: this.n(row.receivable),
      advances: this.n(row.advances),
      birds: this.n(row.birds),
      weight: this.n(row.weight),
    };
  }

  private async purchasePosition(asOn: string) {
    const params: any[] = [asOn];
    const tenant = this.tenantFilter('po', params);
    const row = await this.one(
      `
      SELECT
        COALESCE(SUM(x.net), 0) AS net,
        COALESCE(SUM(x.paid), 0) AS paid,
        COALESCE(SUM(GREATEST(x.net - x.paid, 0)), 0) AS payable,
        COALESCE(SUM(GREATEST(x.paid - x.net, 0)), 0) AS prepaid,
        COALESCE(SUM(x.weight), 0) AS weight,
        COALESCE(SUM(x.weight * x.rate), 0) AS rate_value,
        COALESCE(SUM(x.birds), 0) AS birds
      FROM (
        SELECT
          po.net_amount::numeric AS net,
          CASE
            WHEN COALESCE(p.pay_cnt, 0) > 0 THEN COALESCE(p.paid, 0)
            ELSE COALESCE(po.total_payment_made, 0)
          END::numeric AS paid,
          COALESCE(po.total_weight, 0)::numeric AS weight,
          COALESCE(po.rate_per_kg, 0)::numeric AS rate,
          COALESCE((
            SELECT SUM(c.number_of_birds) FROM cages c WHERE c.purchase_order_id = po.id
          ), 0)::numeric AS birds
        FROM purchase_orders po
        LEFT JOIN (
          SELECT purchase_order_id AS oid, SUM(amount) AS paid, COUNT(*) AS pay_cnt
          FROM purchase_order_payments
          WHERE created_at::date <= $1
          GROUP BY purchase_order_id
        ) p ON p.oid = po.id
        WHERE po.order_date <= $1
          AND po.status <> 'cancelled'
        ${tenant}
      ) x
      `,
      params,
    );

    return {
      net: this.n(row.net),
      paid: this.n(row.paid),
      payable: this.n(row.payable),
      prepaid: this.n(row.prepaid),
      weight: this.n(row.weight),
      birds: this.n(row.birds),
      ratePerKg: this.n(row.weight) > 0 ? this.n(row.rate_value) / this.n(row.weight) : 0,
    };
  }

  private async expenseTotal(asOn: string) {
    const params: any[] = [asOn];
    const tenant = this.tenantFilter('e', params);
    const row = await this.one(
      `SELECT COALESCE(SUM(e.amount), 0) AS total FROM expenses e WHERE e.expense_date <= $1 ${tenant}`,
      params,
    );
    return this.n(row.total);
  }

  private async openingSplit(table: 'retailers' | 'farmers', _asOn: string) {
    const params: any[] = [];
    const tenant = this.tenantFilter('t', params);
    const row = await this.one(
      `
      SELECT
        COALESCE(SUM(GREATEST(t.opening_balance, 0)), 0) AS positive,
        COALESCE(SUM(GREATEST(-t.opening_balance, 0)), 0) AS negative
      FROM ${table} t
      WHERE 1=1 ${tenant}
      `,
      params,
    );
    return { positive: this.n(row.positive), negative: this.n(row.negative) };
  }

  private async godownInward(asOn: string) {
    const params: any[] = [asOn];
    const tenant = this.tenantFilter('g', params);
    const row = await this.one(
      `
      SELECT
        COALESCE(SUM(g.number_of_birds), 0) AS birds,
        COALESCE(SUM(COALESCE(NULLIF(g.total_weight, 0), g.actual_weight, g.number_of_birds * COALESCE(g.average_weight, 0), 0)), 0) AS weight,
        COALESCE(SUM(
          COALESCE(
            NULLIF(g.total_amount, 0),
            COALESCE(NULLIF(g.total_weight, 0), g.actual_weight, 0) * COALESCE(g.rate_per_kg, 0)
          )
        ), 0) AS value,
        COALESCE(SUM(
          COALESCE(NULLIF(g.total_weight, 0), g.actual_weight, g.number_of_birds * COALESCE(g.average_weight, 0), 0)
          * COALESCE(g.rate_per_kg, 0)
        ), 0) AS rate_value
      FROM godown_inward_entries g
      WHERE g.entry_date <= $1
      ${tenant}
      `,
      params,
    );
    return {
      birds: this.n(row.birds),
      weight: this.n(row.weight),
      value: this.n(row.value),
      ratePerKg: this.n(row.weight) > 0 && this.n(row.rate_value) > 0
        ? this.n(row.rate_value) / this.n(row.weight)
        : (this.n(row.weight) > 0 ? this.n(row.value) / this.n(row.weight) : 0),
    };
  }

  private async godownSoldTotals(asOn: string) {
    const params: any[] = [asOn];
    const tenant = this.tenantFilter('g', params);
    const row = await this.one(
      `
      SELECT
        COALESCE(SUM(g.number_of_birds), 0) AS birds,
        COALESCE(SUM(COALESCE(NULLIF(g.total_weight, 0), g.number_of_birds * COALESCE(g.average_weight, 0), 0)), 0) AS weight
      FROM godown_sales g
      WHERE g.sale_date <= $1
      ${tenant}
      `,
      params,
    );
    return { birds: this.n(row.birds), weight: this.n(row.weight) };
  }

  private async godownMortality(asOn: string) {
    const params: any[] = [asOn];
    const tenant = this.tenantFilter('m', params);
    const row = await this.one(
      `
      SELECT
        COALESCE(SUM(m.number_of_birds_died), 0) AS birds,
        COALESCE(SUM(CASE WHEN COALESCE(m.weight_of_dead_birds, 0) > 0 THEN m.weight_of_dead_birds ELSE 0 END), 0) AS weight,
        COALESCE(SUM(CASE WHEN COALESCE(m.weight_of_dead_birds, 0) <= 0 THEN m.number_of_birds_died ELSE 0 END), 0) AS birds_without_weight
      FROM godown_mortality m
      WHERE m.mortality_date <= $1
      ${tenant}
      `,
      params,
    );
    return {
      birds: this.n(row.birds),
      weight: this.n(row.weight),
      birdsWithoutWeight: this.n(row.birds_without_weight),
    };
  }

  private async transportMortality(asOn: string) {
    const params: any[] = [asOn];
    const tenant = this.tenantFilter('m', params);
    const row = await this.one(
      `
      SELECT
        COALESCE(SUM(m.number_of_birds_died), 0) AS birds,
        COALESCE(SUM(CASE WHEN COALESCE(m.weight_of_dead_birds, 0) > 0 THEN m.weight_of_dead_birds ELSE 0 END), 0) AS weight,
        COALESCE(SUM(CASE WHEN COALESCE(m.weight_of_dead_birds, 0) <= 0 THEN m.number_of_birds_died ELSE 0 END), 0) AS birds_without_weight
      FROM mortalities m
      WHERE COALESCE(m.purchase_date, m.created_at::date) <= $1
        AND COALESCE(m.source, 'travel_sales') = 'travel_sales'
      ${tenant}
      `,
      params,
    );
    return {
      birds: this.n(row.birds),
      weight: this.n(row.weight),
      birdsWithoutWeight: this.n(row.birds_without_weight),
    };
  }

  private async vehicleSold(asOn: string) {
    const params: any[] = [asOn];
    const tenant = this.tenantFilter('s', params);
    const row = await this.one(
      `
      SELECT
        COALESCE(SUM(s.number_of_birds), 0) AS birds,
        COALESCE(SUM(s.quantity), 0) AS weight
      FROM sales s
      WHERE s.sale_date <= $1
        AND (s.sale_mode = 'from_vehicle' OR s.sale_mode IS NULL)
      ${tenant}
      `,
      params,
    );
    return { birds: this.n(row.birds), weight: this.n(row.weight) };
  }

  private async voucherTotals(asOn: string) {
    const params: any[] = [asOn];
    const tenant = this.tenantFilter('v', params);
    const rows = await this.dataSource.query(
      `
      SELECT v.voucher_type AS type, COALESCE(SUM(v.amount), 0) AS total
      FROM payment_vouchers v
      WHERE v.voucher_date <= $1
        AND v.status <> 'cancelled'
        AND (v.reference_type IS NULL OR LOWER(v.reference_type) = 'other')
      ${tenant}
      GROUP BY v.voucher_type
      `,
      params,
    );
    const map: Record<string, number> = {};
    for (const row of rows) map[row.type] = this.n(row.total);
    return { in: map.in || 0, out: map.out || 0 };
  }

  private async salesPeriod(
    saleTable: 'sales' | 'godown_sales',
    payTable: 'sale_payments' | 'godown_sale_payments',
    fk: 'sale_id' | 'godown_sale_id',
    billedCol: 'net_amount' | 'total_amount',
    from: string,
    to: string,
  ) {
    const params: any[] = [from, to];
    const tenant = this.tenantFilter('s', params);
    const row = await this.one(
      `
      SELECT
        COALESCE(SUM(x.billed), 0) AS billed,
        COALESCE(SUM(x.received), 0) AS received
      FROM (
        SELECT
          s.${billedCol}::numeric AS billed,
          CASE
            WHEN COALESCE(p.pay_cnt, 0) > 0 THEN COALESCE(p.paid, 0)
            ELSE COALESCE(s.amount_received, 0)
          END::numeric AS received
        FROM ${saleTable} s
        LEFT JOIN (
          SELECT ${fk} AS sid, SUM(amount) AS paid, COUNT(*) AS pay_cnt
          FROM ${payTable}
          WHERE created_at::date BETWEEN $1 AND $2
          GROUP BY ${fk}
        ) p ON p.sid = s.id
        WHERE s.sale_date BETWEEN $1 AND $2
        ${tenant}
      ) x
      `,
      params,
    );
    return { billed: this.n(row.billed), received: this.n(row.received) };
  }

  private async purchasePeriod(from: string, to: string) {
    const params: any[] = [from, to];
    const tenant = this.tenantFilter('po', params);
    const row = await this.one(
      `
      SELECT
        COALESCE(SUM(x.net), 0) AS net,
        COALESCE(SUM(x.paid), 0) AS paid
      FROM (
        SELECT
          po.net_amount::numeric AS net,
          CASE
            WHEN COALESCE(p.pay_cnt, 0) > 0 THEN COALESCE(p.paid, 0)
            ELSE COALESCE(po.total_payment_made, 0)
          END::numeric AS paid
        FROM purchase_orders po
        LEFT JOIN (
          SELECT purchase_order_id AS oid, SUM(amount) AS paid, COUNT(*) AS pay_cnt
          FROM purchase_order_payments
          WHERE created_at::date BETWEEN $1 AND $2
          GROUP BY purchase_order_id
        ) p ON p.oid = po.id
        WHERE po.order_date BETWEEN $1 AND $2
          AND po.status <> 'cancelled'
        ${tenant}
      ) x
      `,
      params,
    );
    return { net: this.n(row.net), paid: this.n(row.paid) };
  }

  private async expensePeriod(from: string, to: string) {
    const params: any[] = [from, to];
    const tenant = this.tenantFilter('e', params);
    const row = await this.one(
      `SELECT COALESCE(SUM(e.amount), 0) AS total FROM expenses e WHERE e.expense_date BETWEEN $1 AND $2 ${tenant}`,
      params,
    );
    return this.n(row.total);
  }

  private async voucherPeriod(from: string, to: string) {
    const params: any[] = [from, to];
    const tenant = this.tenantFilter('v', params);
    const rows = await this.dataSource.query(
      `
      SELECT v.voucher_type AS type, COALESCE(SUM(v.amount), 0) AS total
      FROM payment_vouchers v
      WHERE v.voucher_date BETWEEN $1 AND $2
        AND v.status <> 'cancelled'
        AND (v.reference_type IS NULL OR LOWER(v.reference_type) = 'other')
      ${tenant}
      GROUP BY v.voucher_type
      `,
      params,
    );
    const map: Record<string, number> = {};
    for (const row of rows) map[row.type] = this.n(row.total);
    return { in: map.in || 0, out: map.out || 0 };
  }
}
