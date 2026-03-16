import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { PurchaseOrderCage } from './entities/purchase-order-cage.entity';
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
  ) {}

  async create(createPurchaseOrderDto: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    // Check if order number already exists
    const existingOrder = await this.purchaseOrderRepository.findOne({
      where: { orderNumber: createPurchaseOrderDto.orderNumber },
    });
    if (existingOrder) {
      throw new BadRequestException(`Purchase order with number ${createPurchaseOrderDto.orderNumber} already exists`);
    }

    // Calculate total weight and amount from cages if provided
    let totalWeight = 0;
    let totalAmount = 0;
    
    if (createPurchaseOrderDto.cages && createPurchaseOrderDto.cages.length > 0) {
      totalWeight = createPurchaseOrderDto.cages.reduce((sum, cage) => sum + cage.cageWeight, 0);
      const ratePerKg = parseFloat(createPurchaseOrderDto.ratePerKg || '0');
      totalAmount = totalWeight * ratePerKg;
    } else if (createPurchaseOrderDto.items && createPurchaseOrderDto.items.length > 0) {
      // Calculate from items if no cages
      totalAmount = createPurchaseOrderDto.items.reduce((sum, item) => {
        return sum + (parseFloat(item.quantity) * parseFloat(item.unitCost));
      }, 0);
    }

    // Calculate charges
    const transportCharges = parseFloat(createPurchaseOrderDto.transportCharges || '0');
    const loadingCharges = parseFloat(createPurchaseOrderDto.loadingCharges || '0');
    const commission = parseFloat(createPurchaseOrderDto.commission || '0');
    const otherCharges = parseFloat(createPurchaseOrderDto.otherCharges || '0');

    // Calculate deductions
    const weightShortage = parseFloat(createPurchaseOrderDto.weightShortage || '0');
    const mortalityDeduction = parseFloat(createPurchaseOrderDto.mortalityDeduction || '0');
    const otherDeduction = parseFloat(createPurchaseOrderDto.otherDeduction || '0');

    // Calculate gross and net amounts
    const grossAmount = totalAmount + transportCharges + loadingCharges + commission + otherCharges;
    const netAmount = grossAmount - weightShortage - mortalityDeduction - otherDeduction;

    // Calculate payment amounts
    const advancePaid = parseFloat(createPurchaseOrderDto.advancePaid || '0');
    const totalPaymentMade = parseFloat(createPurchaseOrderDto.totalPaymentMade || '0');
    const outstandingPayment = netAmount - advancePaid;
    const balanceAmount = netAmount - totalPaymentMade;

    const purchaseOrder = this.purchaseOrderRepository.create({
      orderNumber: createPurchaseOrderDto.orderNumber,
      supplierName: createPurchaseOrderDto.supplierName,
      orderDate: createPurchaseOrderDto.orderDate,
      dueDate: createPurchaseOrderDto.dueDate,
      status: createPurchaseOrderDto.status || 'pending',
      notes: createPurchaseOrderDto.notes,
      // Invoice header fields
      branch: createPurchaseOrderDto.branch,
      unit: createPurchaseOrderDto.unit,
      gstin: createPurchaseOrderDto.gstin,
      liftingTime: createPurchaseOrderDto.liftingTime,
      partyCode: createPurchaseOrderDto.partyCode,
      prNumber: createPurchaseOrderDto.prNumber,
      hsnCode: createPurchaseOrderDto.hsnCode || '0105',
      // Farmer integration
      farmerId: createPurchaseOrderDto.farmerId,
      farmerMobile: createPurchaseOrderDto.farmerMobile,
      farmLocation: createPurchaseOrderDto.farmLocation,
      // Vehicle integration
      vehicleId: createPurchaseOrderDto.vehicleId,
      // Bird details
      birdType: createPurchaseOrderDto.birdType,
      totalWeight,
      ratePerKg: parseFloat(createPurchaseOrderDto.ratePerKg || '0'),
      // Amounts
      totalAmount,
      transportCharges,
      loadingCharges,
      commission,
      otherCharges,
      weightShortage,
      mortalityDeduction,
      otherDeduction,
      grossAmount,
      netAmount,
      // Payment tracking
      purchasePaymentStatus: createPurchaseOrderDto.purchasePaymentStatus || 'pending',
      advancePaid,
      outstandingPayment,
      paymentMode: createPurchaseOrderDto.paymentMode,
      totalPaymentMade,
      balanceAmount,
    });

    const savedOrder = await this.purchaseOrderRepository.save(purchaseOrder);

    // Create items if provided
    if (createPurchaseOrderDto.items && createPurchaseOrderDto.items.length > 0) {
      const items = createPurchaseOrderDto.items.map(item => 
        this.purchaseOrderItemRepository.create({
          description: item.description,
          quantity: parseFloat(item.quantity),
          unit: item.unit,
          unitCost: parseFloat(item.unitCost),
          lineTotal: parseFloat(item.quantity) * parseFloat(item.unitCost),
          purchaseOrderId: savedOrder.id,
        })
      );

      await this.purchaseOrderItemRepository.save(items);
    }

    // Create cages if provided
    if (createPurchaseOrderDto.cages && createPurchaseOrderDto.cages.length > 0) {
      const cages = createPurchaseOrderDto.cages.map(cage =>
        this.purchaseOrderCageRepository.create({
          cageId: cage.cageId,
          birdType: cage.birdType,
          numberOfBirds: cage.numberOfBirds,
          cageWeight: cage.cageWeight,
          purchaseOrderId: savedOrder.id,
        })
      );

      await this.purchaseOrderCageRepository.save(cages);
    }

    return this.findOne(savedOrder.id);
  }

  async findAll(
    startDate?: string,
    endDate?: string,
    supplier?: string,
    status?: string,
  ): Promise<PurchaseOrder[]> {
    const query = this.purchaseOrderRepository.createQueryBuilder('po')
      .leftJoinAndSelect('po.items', 'items')
      .leftJoinAndSelect('po.cages', 'cages')
      .orderBy('po.orderDate', 'DESC');

    if (startDate && endDate) {
      query.andWhere('po.orderDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    if (supplier) {
      query.andWhere('po.supplierName ILIKE :supplier', {
        supplier: `%${supplier}%`,
      });
    }

    if (status) {
      query.andWhere('po.status = :status', { status });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.purchaseOrderRepository.findOne({
      where: { id },
      relations: ['items', 'cages'],
    });
    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }
    return purchaseOrder;
  }

  async update(id: string, updatePurchaseOrderDto: UpdatePurchaseOrderDto): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(id);

    // If order number is being updated, check for duplicates
    if (updatePurchaseOrderDto.orderNumber && updatePurchaseOrderDto.orderNumber !== purchaseOrder.orderNumber) {
      const existingOrder = await this.purchaseOrderRepository.findOne({
        where: { orderNumber: updatePurchaseOrderDto.orderNumber },
      });
      if (existingOrder) {
        throw new BadRequestException(`Purchase order with number ${updatePurchaseOrderDto.orderNumber} already exists`);
      }
    }

    // If items are being updated, recalculate total
    let totalAmount = typeof purchaseOrder.totalAmount === 'string' 
      ? parseFloat(purchaseOrder.totalAmount) 
      : purchaseOrder.totalAmount;
    if (updatePurchaseOrderDto.items && updatePurchaseOrderDto.items.length > 0) {
      totalAmount = updatePurchaseOrderDto.items.reduce((sum, item) => {
        return sum + (parseFloat(item.quantity) * parseFloat(item.unitCost));
      }, 0);

      // Delete existing items
      await this.purchaseOrderItemRepository.delete({ purchaseOrderId: id });

      // Create new items
      const items = updatePurchaseOrderDto.items.map(item => 
        this.purchaseOrderItemRepository.create({
          description: item.description,
          quantity: parseFloat(item.quantity),
          unit: item.unit,
          unitCost: parseFloat(item.unitCost),
          lineTotal: parseFloat(item.quantity) * parseFloat(item.unitCost),
          purchaseOrderId: id,
        })
      );

      await this.purchaseOrderItemRepository.save(items);
    }

    // Handle cages if provided
    if (updatePurchaseOrderDto.cages !== undefined) {
      // Delete existing cages
      await this.purchaseOrderCageRepository.delete({ purchaseOrderId: id });

      // Create new cages if array is not empty
      if (updatePurchaseOrderDto.cages.length > 0) {
        const cages = updatePurchaseOrderDto.cages.map(cage =>
          this.purchaseOrderCageRepository.create({
            cageId: cage.cageId,
            birdType: cage.birdType,
            numberOfBirds: cage.numberOfBirds,
            cageWeight: cage.cageWeight,
            purchaseOrderId: id,
          })
        );

        await this.purchaseOrderCageRepository.save(cages);
      }
    }

    // Calculate charges (use existing values if not provided, handle string types)
    const transportCharges = updatePurchaseOrderDto.transportCharges !== undefined
      ? parseFloat(updatePurchaseOrderDto.transportCharges) 
      : (typeof purchaseOrder.transportCharges === 'string' ? parseFloat(purchaseOrder.transportCharges) : purchaseOrder.transportCharges);
    const loadingCharges = updatePurchaseOrderDto.loadingCharges !== undefined
      ? parseFloat(updatePurchaseOrderDto.loadingCharges) 
      : (typeof purchaseOrder.loadingCharges === 'string' ? parseFloat(purchaseOrder.loadingCharges) : purchaseOrder.loadingCharges);
    const commission = updatePurchaseOrderDto.commission !== undefined
      ? parseFloat(updatePurchaseOrderDto.commission) 
      : (typeof purchaseOrder.commission === 'string' ? parseFloat(purchaseOrder.commission) : purchaseOrder.commission);
    const otherCharges = updatePurchaseOrderDto.otherCharges !== undefined
      ? parseFloat(updatePurchaseOrderDto.otherCharges) 
      : (typeof purchaseOrder.otherCharges === 'string' ? parseFloat(purchaseOrder.otherCharges) : purchaseOrder.otherCharges);

    // Calculate deductions (use existing values if not provided, handle string types)
    const weightShortage = updatePurchaseOrderDto.weightShortage !== undefined
      ? parseFloat(updatePurchaseOrderDto.weightShortage) 
      : (typeof purchaseOrder.weightShortage === 'string' ? parseFloat(purchaseOrder.weightShortage) : purchaseOrder.weightShortage);
    const mortalityDeduction = updatePurchaseOrderDto.mortalityDeduction !== undefined
      ? parseFloat(updatePurchaseOrderDto.mortalityDeduction) 
      : (typeof purchaseOrder.mortalityDeduction === 'string' ? parseFloat(purchaseOrder.mortalityDeduction) : purchaseOrder.mortalityDeduction);
    const otherDeduction = updatePurchaseOrderDto.otherDeduction !== undefined
      ? parseFloat(updatePurchaseOrderDto.otherDeduction) 
      : (typeof purchaseOrder.otherDeduction === 'string' ? parseFloat(purchaseOrder.otherDeduction) : purchaseOrder.otherDeduction);

    // Calculate gross and net amounts
    const grossAmount = totalAmount + transportCharges + loadingCharges + commission + otherCharges;
    const netAmount = grossAmount - weightShortage - mortalityDeduction - otherDeduction;

    // Update the purchase order
    Object.assign(purchaseOrder, updatePurchaseOrderDto);
    
    // Set calculated values
    purchaseOrder.totalAmount = totalAmount;
    purchaseOrder.transportCharges = transportCharges;
    purchaseOrder.loadingCharges = loadingCharges;
    purchaseOrder.commission = commission;
    purchaseOrder.otherCharges = otherCharges;
    purchaseOrder.weightShortage = weightShortage;
    purchaseOrder.mortalityDeduction = mortalityDeduction;
    purchaseOrder.otherDeduction = otherDeduction;
    purchaseOrder.grossAmount = grossAmount;
    purchaseOrder.netAmount = netAmount;
    purchaseOrder.updatedAt = new Date();

    // Convert string values to numbers for numeric fields
    if (updatePurchaseOrderDto.totalWeight) {
      purchaseOrder.totalWeight = parseFloat(updatePurchaseOrderDto.totalWeight);
    }
    if (updatePurchaseOrderDto.ratePerKg) {
      purchaseOrder.ratePerKg = parseFloat(updatePurchaseOrderDto.ratePerKg);
    }
    if (updatePurchaseOrderDto.advancePaid) {
      purchaseOrder.advancePaid = parseFloat(updatePurchaseOrderDto.advancePaid);
    }
    if (updatePurchaseOrderDto.totalPaymentMade) {
      purchaseOrder.totalPaymentMade = parseFloat(updatePurchaseOrderDto.totalPaymentMade);
    }

    // Ensure numeric values for calculations (handle both string and number types)
    const totalPaymentMade = typeof purchaseOrder.totalPaymentMade === 'string' 
      ? parseFloat(purchaseOrder.totalPaymentMade) 
      : purchaseOrder.totalPaymentMade;
    const advancePaid = typeof purchaseOrder.advancePaid === 'string'
      ? parseFloat(purchaseOrder.advancePaid)
      : purchaseOrder.advancePaid;

    // Calculate balance amount
    purchaseOrder.balanceAmount = netAmount - totalPaymentMade;
    purchaseOrder.outstandingPayment = netAmount - advancePaid;

    await this.purchaseOrderRepository.save(purchaseOrder);

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const purchaseOrder = await this.findOne(id);
    await this.purchaseOrderRepository.remove(purchaseOrder);
  }

  async updateStatus(id: string, status: 'pending' | 'received' | 'cancelled'): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(id);
    purchaseOrder.status = status;
    purchaseOrder.updatedAt = new Date();
    await this.purchaseOrderRepository.save(purchaseOrder);
    return purchaseOrder;
  }

  async getInvoiceList(): Promise<Array<{ id: string; orderNumber: string; orderDate: string; supplierName: string }>> {
    const orders = await this.purchaseOrderRepository
      .createQueryBuilder('po')
      .select(['po.id', 'po.orderNumber', 'po.orderDate', 'po.supplierName'])
      .orderBy('po.orderDate', 'DESC')
      .getMany();

    return orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      supplierName: order.supplierName,
    }));
  }

}