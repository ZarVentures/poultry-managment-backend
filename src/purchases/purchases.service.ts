import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { PurchaseOrderCage } from './entities/purchase-order-cage.entity';
import { PurchaseOrderPayment } from './entities/purchase-order-payment.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(PurchaseOrderCage)
    private readonly purchaseOrderCageRepository: Repository<PurchaseOrderCage>,
    @InjectRepository(PurchaseOrderPayment)
    private readonly purchaseOrderPaymentRepository: Repository<PurchaseOrderPayment>,
  ) {}

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

  async create(dto: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    const existing = await this.purchaseOrderRepository.findOne({ where: { orderNumber: dto.orderNumber } });
    if (existing) throw new BadRequestException(`Purchase order ${dto.orderNumber} already exists`);

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
      orderNumber: dto.orderNumber,
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
      const cages = dto.cages.map(cage =>
        this.purchaseOrderCageRepository.create({
          cageId: cage.cageId,
          numberOfBirds: cage.numberOfBirds,
          cageWeight: cage.cageWeight,
          purchaseOrderId: savedId,
        })
      );
      await this.purchaseOrderCageRepository.save(cages);
    }

    if (dto.payments && dto.payments.length > 0) {
      const payments = dto.payments.map(p =>
        this.purchaseOrderPaymentRepository.create({
          paymentMode: p.paymentMode as any,
          amount: parseFloat(p.amount),
          purchaseOrderId: savedId,
        })
      );
      await this.purchaseOrderPaymentRepository.save(payments);
    }

    return this.findOne(savedId);
  }

  async findAll(startDate?: string, endDate?: string, supplier?: string, status?: string): Promise<PurchaseOrder[]> {
    const query = this.purchaseOrderRepository.createQueryBuilder('po')
      .leftJoinAndSelect('po.items', 'items')
      .leftJoinAndSelect('po.cages', 'cages')
      .leftJoinAndSelect('po.payments', 'payments')
      .orderBy('po.orderDate', 'DESC');

    if (startDate && endDate) query.andWhere('po.orderDate BETWEEN :startDate AND :endDate', { startDate, endDate });
    if (supplier) query.andWhere('po.supplierName ILIKE :supplier', { supplier: `%${supplier}%` });
    if (status) query.andWhere('po.status = :status', { status });

    return query.getMany();
  }

  async findOne(id: string): Promise<PurchaseOrder> {
    const order = await this.purchaseOrderRepository.findOne({
      where: { id },
      relations: ['items', 'cages', 'payments'],
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

    // Recalculate weight from cages if provided
    let totalWeight = typeof order.totalWeight === 'string' ? parseFloat(order.totalWeight) : order.totalWeight;
    if (dto.cages !== undefined) {
      if (dto.cages.length > 0) {
        totalWeight = dto.cages.reduce((s, c) => s + c.cageWeight, 0);
      } else {
        totalWeight = parseFloat(dto.totalWeight || '0');
      }
      await this.purchaseOrderCageRepository.delete({ purchaseOrderId: id });
      if (dto.cages.length > 0) {
        const cages = dto.cages.map(c =>
          this.purchaseOrderCageRepository.create({ cageId: c.cageId, numberOfBirds: c.numberOfBirds, cageWeight: c.cageWeight, purchaseOrderId: id })
        );
        await this.purchaseOrderCageRepository.save(cages);
      }
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
          this.purchaseOrderPaymentRepository.create({ paymentMode: p.paymentMode as any, amount: parseFloat(p.amount), purchaseOrderId: id })
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

    await this.purchaseOrderRepository.save(order);
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

  // Get cages for a purchase order, optionally filtered by status
  async getCagesByOrderNumber(orderNumber: string, status?: string): Promise<PurchaseOrderCage[]> {
    const order = await this.purchaseOrderRepository.findOne({ where: { orderNumber } });
    if (!order) throw new NotFoundException(`Purchase order ${orderNumber} not found`);

    const query = this.purchaseOrderCageRepository.createQueryBuilder('cage')
      .where('cage.purchaseOrderId = :id', { id: order.id });

    if (status) query.andWhere('cage.status = :status', { status });

    return query.orderBy('cage.cageId', 'ASC').getMany();
  }

  // Mark specific cage IDs as sold
  async markCagesSold(cageIds: string[]): Promise<void> {
    if (cageIds.length === 0) return;
    await this.purchaseOrderCageRepository
      .createQueryBuilder()
      .update()
      .set({ status: 'sold' })
      .whereInIds(cageIds)
      .execute();
  }

  // Mark specific cage IDs as in_godown
  async markCagesInGodown(cageIds: string[]): Promise<void> {
    if (cageIds.length === 0) return;
    await this.purchaseOrderCageRepository
      .createQueryBuilder()
      .update()
      .set({ status: 'in_godown' })
      .whereInIds(cageIds)
      .execute();
  }
}
