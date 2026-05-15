import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PurchaseOrder } from '../purchases/entities/purchase-order.entity';
import { Sale } from '../sales/sale.entity';
import { Expense } from '../expenses/expense.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseRepository: Repository<PurchaseOrder>,
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
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
}
