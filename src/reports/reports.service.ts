import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PurchaseOrder } from '../purchases/entities/purchase-order.entity';
import { Sale } from '../sales/sale.entity';
import { Expense } from '../expenses/expense.entity';

import { Retailer } from '../retailers/retailer.entity';
import { GodownSale } from '../godown/entities/godown-sale.entity';

import { SalePayment } from '../sales/sale-payment.entity';
import { GodownSalePayment } from '../godown/entities/godown-sale-payment.entity';

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
    @InjectRepository(SalePayment)
    private readonly salePaymentRepository: Repository<SalePayment>,
    @InjectRepository(GodownSalePayment)
    private readonly godownSalePaymentRepository: Repository<GodownSalePayment>,
  ) { }

  async getPurchaseReport(startDate?: string, endDate?: string) {
    const whereClause: any = {};

    if (startDate && endDate) {
      whereClause.orderDate = Between(new Date(startDate), new Date(endDate));
    }

    const purchases = await this.purchaseRepository.find({
      where: whereClause,
      order: { orderDate: 'DESC' },
    });

    const summary = {
      totalOrders: purchases.length,
      totalAmount: purchases.reduce((sum, p) => sum + parseFloat(p.totalAmount as any), 0),
      totalNetAmount: purchases.reduce((sum, p) => sum + parseFloat(p.netAmount as any), 0),
      totalPaid: purchases.filter(p => p.purchasePaymentStatus === 'paid').length,
      totalPending: purchases.filter(p => p.purchasePaymentStatus === 'pending').length,
      totalPartial: purchases.filter(p => p.purchasePaymentStatus === 'partial').length,
    };

    return {
      summary,
      purchases,
      dateRange: { startDate, endDate },
    };
  }

  async getSalesReport(startDate?: string, endDate?: string) {
    const whereClause: any = {};

    if (startDate && endDate) {
      whereClause.saleDate = Between(new Date(startDate), new Date(endDate));
    }

    const sales = await this.saleRepository.find({
      where: whereClause,
      order: { saleDate: 'DESC' },
    });

    const summary = {
      totalSales: sales.length,
      totalAmount: sales.reduce((sum, s) => sum + parseFloat(s.totalAmount as any), 0),
      totalNetAmount: sales.reduce((sum, s) => sum + parseFloat(s.netAmount as any), 0),
      totalWeightShortage: sales.reduce((sum, s) => sum + parseFloat((s.weightShortage || 0) as any), 0),
      totalWeightShortageKg: sales.reduce((sum, s) => sum + parseFloat((s.weightShortageKg || s.weightShortage || 0) as any), 0),
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

    if (startDate && endDate) {
      whereClause.orderDate = Between(new Date(startDate), new Date(endDate));
    }

    const purchases = await this.purchaseRepository
      .createQueryBuilder('purchase')
      .where(whereClause)
      .orderBy('purchase.orderDate', 'DESC')
      .getMany();

    const summary = {
      totalOrders: purchases.length,
      totalMortalityDeduction: 0,
      averageMortalityPerOrder: 0,
    };

    return {
      summary,
      purchases: purchases.map(p => ({
        orderNumber: p.orderNumber,
        orderDate: p.orderDate,
        supplierName: p.supplierName,
        totalWeight: p.totalWeight,
        mortalityDeduction: 0,
        netAmount: p.netAmount,
      })),
      dateRange: { startDate, endDate },
    };
  }

  async getProfitLossReport(startDate?: string, endDate?: string) {
    const whereClausePurchase: any = {};
    const whereClauseSale: any = {};
    const whereClauseExpense: any = {};

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      whereClausePurchase.orderDate = Between(start, end);
      whereClauseSale.saleDate = Between(start, end);
      whereClauseExpense.expenseDate = Between(start, end);
    }

    const purchases = await this.purchaseRepository.find({ where: whereClausePurchase });
    const sales = await this.saleRepository.find({ where: whereClauseSale });
    const expenses = await this.expenseRepository.find({
      where: whereClauseExpense,
      relations: ['expenseCategory']
    });

    const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.netAmount as any), 0);
    const totalCost = purchases.reduce((sum, p) => sum + parseFloat(p.netAmount as any), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount as any), 0);

    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      summary: {
        totalRevenue,
        totalCost,
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
          count: sales.length,
          total: totalRevenue,
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

    if (startDate && endDate) {
      whereClause.saleDate = Between(new Date(startDate), new Date(endDate));
    }

    const sales = await this.godownSaleRepository.find({
      where: whereClause,
      order: { saleDate: 'DESC' },
      relations: ['payments'],
    });

    const summary = {
      totalSales: sales.length,
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

  async getGrossProfitReport(startDate?: string, endDate?: string) {
    const whereClausePurchase: any = {};
    const whereClauseSale: any = {};

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      whereClausePurchase.orderDate = Between(start, end);
      whereClauseSale.saleDate = Between(start, end);
    }

    const purchases = await this.purchaseRepository.find({ where: whereClausePurchase });
    const sales = await this.saleRepository.find({ where: whereClauseSale });

    const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.netAmount as any), 0);
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

    if (startDate && endDate) {
      whereClause.expenseDate = Between(new Date(startDate), new Date(endDate));
    }

    const expenses = await this.expenseRepository.find({
      where: whereClause,
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
      },
      breakdown,
      dateRange: { startDate, endDate },
    };
  }

  async getBatchWiseProfit(startDate?: string, endDate?: string) {
    const whereClause: any = {};

    if (startDate && endDate) {
      whereClause.orderDate = Between(new Date(startDate), new Date(endDate));
    }

    const purchases = await this.purchaseRepository.find({
      where: whereClause,
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

    if (startDate && endDate) {
      whereClause.orderDate = Between(new Date(startDate), new Date(endDate));
    }

    const purchases = await this.purchaseRepository.find({ where: whereClause });

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

    if (startDate && endDate) {
      whereClause.saleDate = Between(new Date(startDate), new Date(endDate));
    }

    const sales = await this.saleRepository.find({ where: whereClause });

    // Group by customer
    const customerData: Record<string, any> = {};

    sales.forEach(sale => {
      const customerKey = sale.customerName || 'Unknown';

      if (!customerData[customerKey]) {
        customerData[customerKey] = {
          customerName: sale.customerName,
          totalSales: 0,
          totalRevenue: 0,
          totalQuantity: 0,
        };
      }

      customerData[customerKey].totalSales += 1;
      customerData[customerKey].totalRevenue += parseFloat(sale.netAmount as any);
      customerData[customerKey].totalQuantity += parseFloat(sale.quantity as any || '0');
    });

    const customerWiseData = Object.values(customerData).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);

    return {
      customers: customerWiseData,
      summary: {
        totalCustomers: customerWiseData.length,
        totalRevenue: customerWiseData.reduce((sum: number, c: any) => sum + c.totalRevenue, 0),
        totalSales: sales.length,
      },
      dateRange: { startDate, endDate },
    };
  }

  async getOutstandingReport(page?: number, limit?: number, sortBy: string = 'outstanding') {
    const offset = page && limit ? (page - 1) * limit : 0;
    const take = limit ? limit : 1000;

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
        GROUP BY retailer_id
      ) s ON s.retailer_id = r.id
      LEFT JOIN (
        SELECT retailer_id, SUM(total_amount) as total_sales, SUM(amount_received) as total_received, COUNT(*) as sales_count
        FROM godown_sales
        GROUP BY retailer_id
      ) gs ON gs.retailer_id = r.id
      ORDER BY ${sortBy === 'name' ? 'r.name ASC' : 'outstanding DESC'}
      OFFSET ${offset} LIMIT ${take}
    `;

    const countQuery = `SELECT COUNT(*) FROM retailers`;

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
          GROUP BY retailer_id
        ) s ON s.retailer_id = r.id
        LEFT JOIN (
          SELECT retailer_id, SUM(total_amount) as total_sales, SUM(amount_received) as total_received
          FROM godown_sales
          GROUP BY retailer_id
        ) gs ON gs.retailer_id = r.id
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

    let whereClause = 'WHERE 1=1';
    if (startDate && endDate) {
      whereClause += ` AND created_at BETWEEN '${startDate} 00:00:00' AND '${endDate} 23:59:59'`;
    }
    if (mode && mode !== 'all') {
      whereClause += ` AND LOWER(payment_mode) = '${mode.toLowerCase()}'`;
    }

    const unionQuery = `
      SELECT 
        id, sale_id, invoice_number, customer_name, payment_mode, amount, created_at, 'Regular' as type
      FROM (
        SELECT p.id, p.sale_id, s.invoice_number, s.customer_name, p.payment_mode, p.amount, p.created_at
        FROM sale_payments p
        JOIN sales s ON s.id = p.sale_id
      ) t1
      UNION ALL
      SELECT 
        id, godown_sale_id as sale_id, invoice_number, customer_name, payment_mode, amount, created_at, 'Godown' as type
      FROM (
        SELECT p.id, p.godown_sale_id, s.invoice_number, s.customer_name, p.payment_mode, p.amount, p.created_at
        FROM godown_sale_payments p
        JOIN godown_sales s ON s.id = p.godown_sale_id
      ) t2
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
}
