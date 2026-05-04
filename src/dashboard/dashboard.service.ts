import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from '../sales/sale.entity';
import { Expense } from '../expenses/expense.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { PurchaseOrder } from '../purchases/entities/purchase-order.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseRepository: Repository<PurchaseOrder>,
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
  ) {}

  async getDashboardKPIs(startDate?: string, endDate?: string) {
    // Set default date range to current month if not provided
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const defaultEndDate = now.toISOString().split('T')[0];
    
    const dateFilter = {
      startDate: startDate || defaultStartDate,
      endDate: endDate || defaultEndDate
    };

    // Total Revenue MTD (use netAmount — the actual amount after deductions)
    const revenueQuery = this.saleRepository.createQueryBuilder('sale')
      .select('COALESCE(SUM(sale.netAmount), 0)', 'total')
      .addSelect('COUNT(*)', 'count')
      .where('sale.saleDate >= :startDate AND sale.saleDate <= :endDate', dateFilter);
    
    const revenueResult = await revenueQuery.getRawOne();
    const totalRevenue = parseFloat(revenueResult.total) || 0;

    // Total Expenses MTD
    const expenseQuery = this.expenseRepository.createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.expenseDate >= :startDate AND expense.expenseDate <= :endDate', dateFilter);
    
    const expenseResult = await expenseQuery.getRawOne();
    const totalExpenses = parseFloat(expenseResult.total) || 0;

    // Profit MTD
    const profit = totalRevenue - totalExpenses;

    // Total Active Vehicles
    const totalVehicles = await this.vehicleRepository.count({
      where: { status: 'active' }
    });

    // Total Sales Count MTD — already fetched above
    const totalSales = parseInt(revenueResult.count) || 0;

    return {
      totalRevenue,
      totalExpenses,
      profit,
      totalVehicles,
      totalSales,
      period: {
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate
      }
    };
  }

  async getRevenueByProductType(startDate?: string, endDate?: string) {
    // Set default date range to current month if not provided
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const defaultEndDate = now.toISOString().split('T')[0];
    
    const dateFilter = {
      startDate: startDate || defaultStartDate,
      endDate: endDate || defaultEndDate
    };

    const query = this.saleRepository.createQueryBuilder('sale')
      .select('sale.productType', 'productType')
      .addSelect('COALESCE(SUM(sale.totalAmount), 0)', 'revenue')
      .addSelect('COUNT(*)', 'count')
      .where('sale.saleDate >= :startDate AND sale.saleDate <= :endDate', dateFilter)
      .groupBy('sale.productType');

    return query.getRawMany();
  }

  async getExpensesByCategory(startDate?: string, endDate?: string) {
    // Set default date range to current month if not provided
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const defaultEndDate = now.toISOString().split('T')[0];
    
    const dateFilter = {
      startDate: startDate || defaultStartDate,
      endDate: endDate || defaultEndDate
    };

    const query = this.expenseRepository.createQueryBuilder('expense')
      .select('expense.category', 'category')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'amount')
      .addSelect('COUNT(*)', 'count')
      .where('expense.expenseDate >= :startDate AND expense.expenseDate <= :endDate', dateFilter)
      .groupBy('expense.category');

    return query.getRawMany();
  }

  async getRecentSales(limit: number = 10) {
    return this.saleRepository.find({
      relations: ['retailer'],
      order: { saleDate: 'DESC', createdAt: 'DESC' },
      take: limit,
    });
  }

  async getRecentExpenses(limit: number = 10) {
    return this.expenseRepository.find({
      order: { expenseDate: 'DESC', createdAt: 'DESC' },
      take: limit,
    });
  }

  // Advanced Analytics Methods

  async getMonthlyRevenueVsExpenses(months: number = 6) {
    const monthlyData = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

      // Revenue for the month
      const revenueResult = await this.saleRepository.createQueryBuilder('sale')
        .select('COALESCE(SUM(sale.totalAmount), 0)', 'total')
        .where('sale.saleDate >= :startDate AND sale.saleDate <= :endDate', { startDate, endDate })
        .getRawOne();

      // Expenses for the month
      const expenseResult = await this.expenseRepository.createQueryBuilder('expense')
        .select('COALESCE(SUM(expense.amount), 0)', 'total')
        .where('expense.expenseDate >= :startDate AND expense.expenseDate <= :endDate', { startDate, endDate })
        .getRawOne();

      monthlyData.push({
        month: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
        revenue: parseFloat(revenueResult.total) || 0,
        expenses: parseFloat(expenseResult.total) || 0,
        profit: (parseFloat(revenueResult.total) || 0) - (parseFloat(expenseResult.total) || 0),
      });
    }

    return monthlyData;
  }

  async getMonthlyProfitTrends(months: number = 6) {
    const monthlyData = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

      const revenueResult = await this.saleRepository.createQueryBuilder('sale')
        .select('COALESCE(SUM(sale.totalAmount), 0)', 'total')
        .where('sale.saleDate >= :startDate AND sale.saleDate <= :endDate', { startDate, endDate })
        .getRawOne();

      const expenseResult = await this.expenseRepository.createQueryBuilder('expense')
        .select('COALESCE(SUM(expense.amount), 0)', 'total')
        .where('expense.expenseDate >= :startDate AND expense.expenseDate <= :endDate', { startDate, endDate })
        .getRawOne();

      const revenue = parseFloat(revenueResult.total) || 0;
      const expenses = parseFloat(expenseResult.total) || 0;
      const profit = revenue - expenses;

      monthlyData.push({
        month: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
        profit,
        profitMargin: revenue > 0 ? ((profit / revenue) * 100).toFixed(2) : 0,
      });
    }

    return monthlyData;
  }

  async getFinancialSummary(months: number = 6) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1).toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    // Total Revenue
    const revenueResult = await this.saleRepository.createQueryBuilder('sale')
      .select('COALESCE(SUM(sale.totalAmount), 0)', 'total')
      .where('sale.saleDate >= :startDate AND sale.saleDate <= :endDate', { startDate, endDate })
      .getRawOne();
    const totalRevenue = parseFloat(revenueResult.total) || 0;

    // Total Expenses
    const expenseResult = await this.expenseRepository.createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.expenseDate >= :startDate AND expense.expenseDate <= :endDate', { startDate, endDate })
      .getRawOne();
    const totalExpenses = parseFloat(expenseResult.total) || 0;

    // Total Profit
    const totalProfit = totalRevenue - totalExpenses;

    // Average Monthly Profit
    const avgMonthlyProfit = totalProfit / months;

    // ROI
    const roi = totalExpenses > 0 ? ((totalProfit / totalExpenses) * 100).toFixed(2) : 0;

    // Revenue Per Month
    const revenuePerMonth = totalRevenue / months;

    // Expense Per Month
    const expensePerMonth = totalExpenses / months;

    return {
      totalRevenue,
      totalExpenses,
      totalProfit,
      avgMonthlyProfit,
      roi: parseFloat(roi as string),
      revenuePerMonth,
      expensePerMonth,
      profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0,
      period: {
        startDate,
        endDate,
        months,
      },
    };
  }

  async getSalesPerformanceByProduct(startDate?: string, endDate?: string) {
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
    const defaultEndDate = now.toISOString().split('T')[0];
    
    const dateFilter = {
      startDate: startDate || defaultStartDate,
      endDate: endDate || defaultEndDate
    };

    const query = this.saleRepository.createQueryBuilder('sale')
      .select('sale.productType', 'productType')
      .addSelect('COALESCE(SUM(sale.totalAmount), 0)', 'revenue')
      .addSelect('COALESCE(SUM(sale.quantity), 0)', 'quantity')
      .addSelect('COUNT(*)', 'salesCount')
      .addSelect('COALESCE(AVG(sale.unitPrice), 0)', 'avgPrice')
      .where('sale.saleDate >= :startDate AND sale.saleDate <= :endDate', dateFilter)
      .groupBy('sale.productType')
      .orderBy('revenue', 'DESC');

    const results = await query.getRawMany();
    
    return results.map(r => ({
      productType: r.productType,
      revenue: parseFloat(r.revenue),
      quantity: parseFloat(r.quantity),
      salesCount: parseInt(r.salesCount),
      avgPrice: parseFloat(r.avgPrice),
    }));
  }

  async getTopExpenseCategories(limit: number = 5, startDate?: string, endDate?: string) {
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const defaultEndDate = now.toISOString().split('T')[0];
    
    const dateFilter = {
      startDate: startDate || defaultStartDate,
      endDate: endDate || defaultEndDate
    };

    const query = this.expenseRepository.createQueryBuilder('expense')
      .select('expense.category', 'category')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'amount')
      .addSelect('COUNT(*)', 'count')
      .where('expense.expenseDate >= :startDate AND expense.expenseDate <= :endDate', dateFilter)
      .groupBy('expense.category')
      .orderBy('amount', 'DESC')
      .limit(limit);

    const results = await query.getRawMany();
    
    return results.map(r => ({
      category: r.category,
      amount: parseFloat(r.amount),
      count: parseInt(r.count),
    }));
  }

  async getInventorySummary() {
    // Total items
    const totalItems = await this.inventoryRepository.count();

    // Low stock items
    const lowStockItems = await this.inventoryRepository
      .createQueryBuilder('item')
      .where('item.currentStockLevel <= item.minimumStockLevel')
      .getCount();

    // Total inventory value (sum of current stock levels)
    const valueResult = await this.inventoryRepository
      .createQueryBuilder('item')
      .select('COALESCE(SUM(item.currentStockLevel), 0)', 'total')
      .getRawOne();
    const totalValue = parseFloat(valueResult.total) || 0;

    // Items by type
    const byType = await this.inventoryRepository
      .createQueryBuilder('item')
      .select('item.itemType', 'itemType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('item.itemType')
      .getRawMany();

    return {
      totalItems,
      lowStockItems,
      totalValue,
      byType: byType.map(t => ({
        itemType: t.itemType,
        count: parseInt(t.count),
      })),
    };
  }

  async getPurchaseOrdersSummary(startDate?: string, endDate?: string) {
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const defaultEndDate = now.toISOString().split('T')[0];
    
    const dateFilter = {
      startDate: startDate || defaultStartDate,
      endDate: endDate || defaultEndDate
    };

    // Total orders
    const totalOrders = await this.purchaseRepository
      .createQueryBuilder('po')
      .where('po.orderDate >= :startDate AND po.orderDate <= :endDate', dateFilter)
      .getCount();

    // Pending orders
    const pendingOrders = await this.purchaseRepository
      .createQueryBuilder('po')
      .where('po.orderDate >= :startDate AND po.orderDate <= :endDate', dateFilter)
      .andWhere('po.status = :status', { status: 'pending' })
      .getCount();

    // Total value
    const valueResult = await this.purchaseRepository
      .createQueryBuilder('po')
      .select('COALESCE(SUM(po.totalAmount), 0)', 'total')
      .where('po.orderDate >= :startDate AND po.orderDate <= :endDate', dateFilter)
      .getRawOne();
    const totalValue = parseFloat(valueResult.total) || 0;

    return {
      totalOrders,
      pendingOrders,
      totalValue,
      period: dateFilter,
    };
  }

  async getComprehensiveDashboard(startDate?: string, endDate?: string) {
    const [
      kpis,
      revenueByProduct,
      expensesByCategory,
      monthlyTrends,
      profitTrends,
      financialSummary,
      inventorySummary,
      purchasesSummary,
    ] = await Promise.all([
      this.getDashboardKPIs(startDate, endDate),
      this.getRevenueByProductType(startDate, endDate),
      this.getExpensesByCategory(startDate, endDate),
      this.getMonthlyRevenueVsExpenses(6),
      this.getMonthlyProfitTrends(6),
      this.getFinancialSummary(6),
      this.getInventorySummary(),
      this.getPurchaseOrdersSummary(startDate, endDate),
    ]);

    return {
      kpis,
      revenueByProduct,
      expensesByCategory,
      monthlyTrends,
      profitTrends,
      financialSummary,
      inventorySummary,
      purchasesSummary,
    };
  }
}
