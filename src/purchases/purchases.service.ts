import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { PurchaseOrderPayment } from './entities/purchase-order-payment.entity';
import { CagesService } from '../cages/cages.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(PurchaseOrderPayment)
    private readonly purchaseOrderPaymentRepository: Repository<PurchaseOrderPayment>,
    private readonly cagesService: CagesService,
  ) { }

  private calcAmounts(dto: { totalWeight?: string; ratePerKg?: string; transportCharges?: string; otherCharges?: string }) {
    const totalWeight = parseFloat(dto.totalWeight || '0');
    const ratePerKg = parseFloat(dto.ratePerKg || '0');
    const totalAmount = totalWeight * ratePerKg;
    const transportCharges = parseFloat(dto.transportCharges || '0');
    const otherCharges = parseFloat(dto.otherCharges || '0');
    const grossAmount = totalAmount + transportCharges + otherCharges;
    const netAmount = grossAmount;
    return { totalWeight, ratePerKg, totalAmount, transportCharges, otherCharges, grossAmount, netAmount };
  }

  private async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `PO-${year}-${month}-`;

    // Find the last order number with this prefix
    const lastOrder = await this.purchaseOrderRepository
      .createQueryBuilder('po')
      .where('po.orderNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('po.id', 'DESC')
      .limit(1)
      .getOne();

    if (lastOrder && lastOrder.orderNumber) {
      const lastNumber = parseInt(lastOrder.orderNumber.split('-').pop() || '0');
      return `${prefix}${String(lastNumber + 1).padStart(4, '0')}`;
    }

    return `${prefix}0001`;
  }

  async create(dto: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    // Auto-generate order number if not provided
    const orderNumber = dto.orderNumber || await this.generateOrderNumber();

    const existing = await this.purchaseOrderRepository.findOne({ where: { orderNumber } });
    if (existing) throw new BadRequestException(`Purchase order ${orderNumber} already exists`);

    let totalWeight = 0;
    if (dto.cages && dto.cages.length > 0) {
      totalWeight = dto.cages.reduce((sum, c) => sum + c.cageWeight, 0);
    } else {
      totalWeight = parseFloat(dto.totalWeight || '0');
    }

    const amounts = this.calcAmounts({ ...dto, totalWeight: String(totalWeight) });
    const totalPaymentMade = (dto.payments || []).reduce((s, p) => s + parseFloat(p.amount || '0'), 0);
    const balanceAmount = amounts.netAmount - totalPaymentMade;

    const order = this.purchaseOrderRepository.create({
      orderNumber,
      supplierName: dto.supplierName,
      orderDate: dto.orderDate,
      dueDate: dto.dueDate,
      status: dto.status || 'pending',
      branch: dto.branch,
      farmerId: dto.farmerId,
      farmerMobile: dto.farmerMobile,
      farmLocation: dto.farmLocation,
      vehicleId: dto.vehicleId,
      ...amounts,
      purchasePaymentStatus: dto.purchasePaymentStatus || 'pending',
      totalPaymentMade,
      balanceAmount,
      notes: dto.notes,
      invoiceAttachment: dto.invoiceAttachment,
    });

    const saved = await this.purchaseOrderRepository.save(order);
    const savedId: string = (saved as any).id ?? (saved as any)[0]?.id;

    if (dto.items && dto.items.length > 0) {
      const items = dto.items.map(item =>
        this.purchaseOrderItemRepository.create({
          description: item.description,
          quantity: parseFloat(item.quantity),
          unit: item.unit,
          unitCost: parseFloat(item.unitCost),
          lineTotal: parseFloat(item.quantity) * parseFloat(item.unitCost),
          purchaseOrderId: savedId,
        })
      );
      await this.purchaseOrderItemRepository.save(items);
    }

    if (dto.cages && dto.cages.length > 0) {
      await this.cagesService.createFromPurchase(savedId, dto.cages.map(c => ({
        cageId: c.cageId,
        numberOfBirds: c.numberOfBirds,
        purchaseWeight: c.cageWeight,
      })));
    }

    if (dto.payments && dto.payments.length > 0) {
      const payments = dto.payments.map(p =>
        this.purchaseOrderPaymentRepository.create({
          paymentMode: p.paymentMode as any,
          amount: parseFloat(p.amount),
          isAdvance: p.isAdvance ?? false,
          purchaseOrderId: savedId,
        })
      );
      await this.purchaseOrderPaymentRepository.save(payments);
    }

    return this.findOne(savedId);
  }

  async findAll(
    startDate?: string,
    endDate?: string,
    supplier?: string,
    status?: string,
    page?: number,
    limit?: number
  ): Promise<any> {
    const query = this.purchaseOrderRepository.createQueryBuilder('po')
      .leftJoinAndSelect('po.items', 'items')
      .leftJoinAndSelect('po.payments', 'payments')
      .leftJoinAndSelect('po.cages', 'cages')
      .orderBy('po.orderDate', 'DESC');

    if (startDate && endDate) query.andWhere('po.orderDate BETWEEN :startDate AND :endDate', { startDate, endDate });
    if (supplier) query.andWhere('po.supplierName ILIKE :supplier', { supplier: `%${supplier}%` });
    if (status) {
      if (status === 'pending_or_partial') {
        query.andWhere('po.purchasePaymentStatus IN (:...statuses)', { statuses: ['pending', 'partial'] });
      } else {
        query.andWhere('po.purchasePaymentStatus = :status', { status });
      }
    }

    if (page && limit) {
      const skip = (page - 1) * limit;
      const [data, total] = await query.skip(skip).take(limit).getManyAndCount();

      // Summary statistics for the filtered dataset
      const summaryQuery = await this.purchaseOrderRepository.createQueryBuilder('po')
        .select([
          'SUM(po.totalWeight) as "totalWeight"',
          'SUM(po.netAmount) as "totalAmount"',
          'SUM(po.totalPaymentMade) as "totalPaid"',
          'SUM(po.balanceAmount) as "totalBalance"',
          'COUNT(po.id) as count'
        ]);

      if (startDate && endDate) summaryQuery.andWhere('po.orderDate BETWEEN :startDate AND :endDate', { startDate, endDate });
      if (supplier) summaryQuery.andWhere('po.supplierName ILIKE :supplier', { supplier: `%${supplier}%` });
      if (status) {
        if (status === 'pending_or_partial') {
          summaryQuery.andWhere('po.purchasePaymentStatus IN (:...statuses)', { statuses: ['pending', 'partial'] });
        } else {
          summaryQuery.andWhere('po.purchasePaymentStatus = :status', { status });
        }
      }

      const summary = await summaryQuery.getRawOne();

      return {
        data,
        total,
        page,
        limit,
        summary: {
          totalWeight: parseFloat(summary.totalWeight || 0),
          totalAmount: parseFloat(summary.totalAmount || 0),
          totalPaid: parseFloat(summary.totalPaid || 0),
          totalBalance: parseFloat(summary.totalBalance || 0),
          count: parseInt(summary.count || 0),
        }
      };
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<PurchaseOrder> {
    const order = await this.purchaseOrderRepository.findOne({
      where: { id },
      relations: ['items', 'payments', 'cages'],
    });
    if (!order) throw new NotFoundException(`Purchase order ${id} not found`);
    return order;
  }

  async update(id: string, dto: UpdatePurchaseOrderDto): Promise<PurchaseOrder> {
    const order = await this.findOne(id);

    if (dto.orderNumber && dto.orderNumber !== order.orderNumber) {
      const existing = await this.purchaseOrderRepository.findOne({ where: { orderNumber: dto.orderNumber } });
      if (existing) throw new BadRequestException(`Purchase order ${dto.orderNumber} already exists`);
    }

    let totalWeight = typeof order.totalWeight === 'string' ? parseFloat(order.totalWeight) : order.totalWeight;

    if (dto.cages !== undefined) {
      await this.cagesService.replaceForPurchaseOrder(id, dto.cages.map(c => ({
        cageId: c.cageId,
        numberOfBirds: c.numberOfBirds,
        purchaseWeight: c.cageWeight,
      })));
      totalWeight = dto.cages.reduce((s, c) => s + c.cageWeight, 0);
    }

    if (dto.items !== undefined) {
      await this.purchaseOrderItemRepository.delete({ purchaseOrderId: id });
      if (dto.items.length > 0) {
        const items = dto.items.map(item =>
          this.purchaseOrderItemRepository.create({
            description: item.description, quantity: parseFloat(item.quantity),
            unit: item.unit, unitCost: parseFloat(item.unitCost),
            lineTotal: parseFloat(item.quantity) * parseFloat(item.unitCost),
            purchaseOrderId: id,
          })
        );
        await this.purchaseOrderItemRepository.save(items);
      }
    }

    if (dto.payments !== undefined) {
      await this.purchaseOrderPaymentRepository.delete({ purchaseOrderId: id });
      if (dto.payments.length > 0) {
        const payments = dto.payments.map(p =>
          this.purchaseOrderPaymentRepository.create({ paymentMode: p.paymentMode as any, amount: parseFloat(p.amount), isAdvance: p.isAdvance ?? false, purchaseOrderId: id })
        );
        await this.purchaseOrderPaymentRepository.save(payments);
      }
    }

    const ratePerKg = dto.ratePerKg !== undefined ? parseFloat(dto.ratePerKg) : (typeof order.ratePerKg === 'string' ? parseFloat(order.ratePerKg) : order.ratePerKg);
    const totalAmount = totalWeight * ratePerKg;
    const transportCharges = dto.transportCharges !== undefined ? parseFloat(dto.transportCharges) : (typeof order.transportCharges === 'string' ? parseFloat(order.transportCharges) : order.transportCharges);
    const otherCharges = dto.otherCharges !== undefined ? parseFloat(dto.otherCharges) : (typeof order.otherCharges === 'string' ? parseFloat(order.otherCharges) : order.otherCharges);
    const grossAmount = totalAmount + transportCharges + otherCharges;
    const netAmount = grossAmount;

    // Recalculate total payment from payments table
    const allPayments = dto.payments !== undefined ? dto.payments : (order.payments || []).map(p => ({ amount: String(p.amount) }));
    const totalPaymentMade = allPayments.reduce((s, p) => s + parseFloat((p as any).amount || '0'), 0);
    const balanceAmount = netAmount - totalPaymentMade;

    Object.assign(order, {
      orderNumber: dto.orderNumber ?? order.orderNumber,
      supplierName: dto.supplierName ?? order.supplierName,
      orderDate: dto.orderDate ?? order.orderDate,
      dueDate: dto.dueDate ?? order.dueDate,
      status: dto.status ?? order.status,
      branch: dto.branch ?? order.branch,
      farmerId: dto.farmerId ?? order.farmerId,
      farmerMobile: dto.farmerMobile ?? order.farmerMobile,
      farmLocation: dto.farmLocation ?? order.farmLocation,
      vehicleId: dto.vehicleId ?? order.vehicleId,
      totalWeight, ratePerKg, totalAmount, transportCharges, otherCharges, grossAmount, netAmount,
      purchasePaymentStatus: dto.purchasePaymentStatus ?? order.purchasePaymentStatus,
      totalPaymentMade, balanceAmount,
      notes: dto.notes ?? order.notes,
      updatedAt: new Date(),
    });

    // Use update() instead of save() to avoid cascade issues with payments
    await this.purchaseOrderRepository.update(id, {
      orderNumber: order.orderNumber,
      supplierName: order.supplierName,
      orderDate: order.orderDate,
      dueDate: order.dueDate,
      status: order.status,
      branch: order.branch,
      farmerId: order.farmerId,
      farmerMobile: order.farmerMobile,
      farmLocation: order.farmLocation,
      vehicleId: order.vehicleId,
      totalWeight: order.totalWeight,
      ratePerKg: order.ratePerKg,
      totalAmount: order.totalAmount,
      transportCharges: order.transportCharges,
      otherCharges: order.otherCharges,
      grossAmount: order.grossAmount,
      netAmount: order.netAmount,
      purchasePaymentStatus: order.purchasePaymentStatus,
      totalPaymentMade: order.totalPaymentMade,
      balanceAmount: order.balanceAmount,
      notes: order.notes,
      updatedAt: order.updatedAt,
    });
    return this.findOne(id);
  }

  async updateInvoiceAttachment(id: string, fileUrl: string): Promise<PurchaseOrder> {
    const order = await this.findOne(id);
    order.invoiceAttachment = fileUrl;
    order.updatedAt = new Date();
    await this.purchaseOrderRepository.save(order);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const order = await this.findOne(id);
    await this.purchaseOrderRepository.remove(order);
  }

  async updateStatus(id: string, status: 'pending' | 'received' | 'cancelled'): Promise<PurchaseOrder> {
    const order = await this.findOne(id);
    order.status = status;
    order.updatedAt = new Date();
    await this.purchaseOrderRepository.save(order);
    return order;
  }

  async getInvoiceList(): Promise<Array<{ id: string; orderNumber: string; orderDate: string; supplierName: string }>> {
    const orders = await this.purchaseOrderRepository
      .createQueryBuilder('po')
      .select(['po.id', 'po.orderNumber', 'po.orderDate', 'po.supplierName'])
      .orderBy('po.orderDate', 'DESC')
      .getMany();
    return orders.map(o => ({ id: o.id, orderNumber: o.orderNumber, orderDate: o.orderDate, supplierName: o.supplierName }));
  }

  // Get cages for a purchase order — delegates to CagesService
  async getCagesByOrderNumber(orderNumber: string, status?: string): Promise<any[]> {
    return this.cagesService.getByPurchaseOrderNumber(orderNumber, status as any);
  }

  // Mark cages sold — delegates to CagesService
  async markCagesSold(cageIds: string[], saleWeight?: number): Promise<void> {
    return this.cagesService.markSold(cageIds, '', saleWeight);
  }

  // Mark cages in godown — delegates to CagesService
  async markCagesInGodown(cageIds: string[], godownInwardWeight?: number): Promise<void> {
    return this.cagesService.markInGodown(cageIds, '', godownInwardWeight);
  }

  // Get cage journey — delegates to CagesService
  async getCageJourney(orderNumber: string): Promise<any[]> {
    return this.cagesService.getCageJourney(orderNumber);
  }
}
