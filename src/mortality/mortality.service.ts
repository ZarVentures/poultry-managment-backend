import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Mortality } from './mortality.entity';
import { CreateMortalityDto } from './dto/create-mortality.dto';
import { UpdateMortalityDto } from './dto/update-mortality.dto';
import { PurchaseOrder } from '../purchases/entities/purchase-order.entity';
import { GodownMortality } from '../godown/godown-mortality.entity';
import { GodownService } from '../godown/godown.service';
import { CagesService } from '../cages/cages.service';
import { TenantContextService } from '../tenants/tenant-context.service';

@Injectable()
export class MortalityService {
  constructor(
    @InjectRepository(Mortality)
    private mortalityRepository: Repository<Mortality>,
    @InjectRepository(PurchaseOrder)
    private purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(GodownMortality)
    private godownMortalityRepository: Repository<GodownMortality>,
    private readonly godownService: GodownService,
    private readonly cagesService: CagesService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getTenantId(): string | null {
    return this.tenantContext.getTenantId();
  }

  private tenantWhere(extra: any): any {
    const tenantId = this.getTenantId();
    return tenantId ? { ...extra, tenantId } : extra;
  }

  private applyTenantMortality(query: SelectQueryBuilder<Mortality>): SelectQueryBuilder<Mortality> {
    const tenantId = this.getTenantId();
    if (tenantId) query.andWhere('mortality.tenantId = :tenantId', { tenantId });
    return query;
  }

  private applyTenantGodown(query: SelectQueryBuilder<GodownMortality>): SelectQueryBuilder<GodownMortality> {
    const tenantId = this.getTenantId();
    if (tenantId) query.andWhere('gm.tenantId = :tenantId', { tenantId });
    return query;
  }

  async create(createMortalityDto: CreateMortalityDto): Promise<Mortality> {
    // Generate record number
    const count = await this.mortalityRepository.count();
    const recordNumber = `MRT-${Date.now()}-${count + 1}`;

    const invoiceNo = (createMortalityDto.purchaseInvoiceNo || '').trim();
    // Find purchase order by invoice number (optional)
    const purchaseOrder = invoiceNo && invoiceNo !== 'N/A'
      ? await this.purchaseOrderRepository.findOne({
          where: this.tenantWhere({ orderNumber: invoiceNo }),
          relations: ['cages'],
        })
      : null;

    const weight = Number(createMortalityDto.weightOfDeadBirds) || 0;
    const rate = Number(createMortalityDto.ratePerKg) || 0;
    const amount =
      createMortalityDto.amount != null
        ? Number(createMortalityDto.amount)
        : weight > 0 && rate > 0
          ? weight * rate
          : undefined;

    const source = createMortalityDto.source === 'godown' ? 'godown' : 'travel_sales';
    const died = Number(createMortalityDto.numberOfBirdsDied) || 0;
    if (source === 'godown') {
      await this.assertGodownBirdsAvailable(died);
    }
    if (source === 'travel_sales') {
      await this.assertTravelSalesCage(createMortalityDto, died);
    }

    const mortality = this.mortalityRepository.create({
      ...createMortalityDto,
      source,
      purchaseInvoiceNo: invoiceNo || 'N/A',
      farmerName: createMortalityDto.farmerName || 'N/A',
      cause: createMortalityDto.cause || '',
      cageIdNumber: createMortalityDto.cageIdNumber || undefined,
      recordNumber,
      purchaseOrderId: purchaseOrder?.id,
      amount,
      tenantId: this.getTenantId() ?? undefined,
    });

    const saved = await this.mortalityRepository.save(mortality);
    if (source === 'godown') {
      await this.syncGodownMortality(saved);
    }
    if (source === 'travel_sales') {
      await this.cagesService.deductTravelMortalityBirds(
        saved.purchaseOrderId!,
        saved.cageIdNumber!,
        died,
      );
    }
    return this.findOne(saved.id);
  }

  async findAll(): Promise<Mortality[]> {
    const where: any = {};
    const tenantId = this.getTenantId();
    if (tenantId) where.tenantId = tenantId;
    return this.mortalityRepository.find({
      where,
      relations: ['purchaseOrder'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Mortality> {
    const mortality = await this.mortalityRepository.findOne({
      where: this.tenantWhere({ id }),
      relations: ['purchaseOrder'],
    });

    if (!mortality) {
      throw new NotFoundException(`Mortality record with ID ${id} not found`);
    }

    return mortality;
  }

  async update(id: string, updateMortalityDto: UpdateMortalityDto): Promise<Mortality> {
    const mortality = await this.findOne(id);
    const previousSource = mortality.source;
    const previousBirds = Number(mortality.numberOfBirdsDied) || 0;
    const previousCage = mortality.cageIdNumber;
    const previousPurchaseOrderId = mortality.purchaseOrderId;

    // If purchase invoice changed, update the relation
    if (updateMortalityDto.purchaseInvoiceNo && 
        updateMortalityDto.purchaseInvoiceNo !== mortality.purchaseInvoiceNo) {
      const purchaseOrder = await this.purchaseOrderRepository.findOne({
        where: this.tenantWhere({ orderNumber: updateMortalityDto.purchaseInvoiceNo }),
      });
      mortality.purchaseOrderId = purchaseOrder?.id;
    }

    Object.assign(mortality, updateMortalityDto);
    if (updateMortalityDto.source) {
      mortality.source = updateMortalityDto.source === 'godown' ? 'godown' : 'travel_sales';
    }
    if (mortality.source === 'travel_sales' && !mortality.purchaseOrderId && mortality.purchaseInvoiceNo) {
      const purchaseOrder = await this.purchaseOrderRepository.findOne({
        where: this.tenantWhere({ orderNumber: mortality.purchaseInvoiceNo }),
      });
      mortality.purchaseOrderId = purchaseOrder?.id;
    }

    const weight = Number(mortality.weightOfDeadBirds) || 0;
    const rate = Number(mortality.ratePerKg) || 0;
    if (weight > 0 && rate > 0) {
      mortality.amount = weight * rate;
    }

    if (mortality.source === 'godown') {
      const creditBack = previousSource === 'godown' ? previousBirds : 0;
      await this.assertGodownBirdsAvailable(Number(mortality.numberOfBirdsDied) || 0, creditBack);
    }
    if (mortality.source === 'travel_sales') {
      const sameCage =
        previousSource === 'travel_sales' &&
        previousPurchaseOrderId === mortality.purchaseOrderId &&
        (previousCage || '').trim().toLowerCase() === (mortality.cageIdNumber || '').trim().toLowerCase();
      await this.assertTravelSalesCage(mortality, Number(mortality.numberOfBirdsDied) || 0, sameCage ? previousBirds : 0);
    }

    mortality.updatedAt = new Date();

    const saved = await this.mortalityRepository.save(mortality);
    if (saved.source === 'godown') {
      await this.syncGodownMortality(saved);
    } else {
      await this.removeLinkedGodownMortality(saved);
    }
    if (previousSource === 'travel_sales' && previousPurchaseOrderId && previousCage) {
      await this.cagesService.restoreTravelMortalityBirds(previousPurchaseOrderId, previousCage, previousBirds);
    }
    if (saved.source === 'travel_sales' && saved.purchaseOrderId && saved.cageIdNumber) {
      await this.cagesService.deductTravelMortalityBirds(
        saved.purchaseOrderId,
        saved.cageIdNumber,
        Number(saved.numberOfBirdsDied) || 0,
      );
    }
    return this.findOne(saved.id);
  }

  async remove(id: string): Promise<void> {
    const mortality = await this.findOne(id);
    await this.removeLinkedGodownMortality(mortality);
    if (mortality.source === 'travel_sales' && mortality.purchaseOrderId && mortality.cageIdNumber) {
      await this.cagesService.restoreTravelMortalityBirds(
        mortality.purchaseOrderId,
        mortality.cageIdNumber,
        Number(mortality.numberOfBirdsDied) || 0,
      );
    }
    await this.mortalityRepository.remove(mortality);
  }

  async getStats(startDate?: string, endDate?: string) {
    const query = this.mortalityRepository.createQueryBuilder('mortality');

    this.applyTenantMortality(query);

    // Filter by purchaseDate (same field used on mortality page date filter)
    if (startDate) {
      query.andWhere('mortality.purchaseDate >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('mortality.purchaseDate <= :endDate', { endDate });
    }

    const mortalities = await query.getMany();

    const totalBirdsPurchased = mortalities.reduce(
      (sum, m) => sum + (Number(m.totalBirdsPurchased) || 0),
      0,
    );
    const farmDeaths = mortalities
      .filter((m) => m.source !== 'godown')
      .reduce((sum, m) => sum + (Number(m.numberOfBirdsDied) || 0), 0);
    const totalWeight = mortalities
      .filter((m) => m.source !== 'godown')
      .reduce((sum, m) => sum + (Number(m.weightOfDeadBirds) || 0), 0);

    // Include godown mortality so dashboard bird count matches all mortality records
    const godownQuery = this.godownMortalityRepository.createQueryBuilder('gm');
    this.applyTenantGodown(godownQuery);
    if (startDate) {
      godownQuery.andWhere('gm.mortalityDate >= :startDate', { startDate });
    }
    if (endDate) {
      godownQuery.andWhere('gm.mortalityDate <= :endDate', { endDate });
    }
    const godownMortalities = await godownQuery.getMany();
    const godownDeaths = godownMortalities.reduce(
      (sum, m) => sum + (Number(m.numberOfBirdsDied) || 0),
      0,
    );
    const godownWeight = godownMortalities.reduce(
      (sum, m) => sum + (Number(m.weightOfDeadBirds) || 0),
      0,
    );

    const linkedGodownIds = new Set(
      mortalities.filter((m) => m.godownMortalityId).map((m) => String(m.godownMortalityId)),
    );
    const orphanGodownRecords = godownMortalities.filter((g) => !linkedGodownIds.has(String(g.id))).length;

    const totalBirdsDeath = farmDeaths + godownDeaths;
    const totalValue = totalBirdsDeath * 150;

    return {
      totalBirdsPurchased,
      totalBirdsDeath,
      farmDeaths,
      godownDeaths,
      totalWeight: totalWeight + godownWeight,
      totalValue,
      totalRecords: mortalities.length + orphanGodownRecords,
    };
  }

  private async assertTravelSalesCage(
    data: { purchaseInvoiceNo?: string; cageIdNumber?: string; purchaseOrderId?: string },
    requestedBirds: number,
    creditBack = 0,
  ) {
    const invoiceNo = (data.purchaseInvoiceNo || '').trim();
    const cageLabel = (data.cageIdNumber || '').trim();
    if (!invoiceNo || invoiceNo === 'N/A') {
      throw new BadRequestException('Please select Purchase Bill No for travel sales mortality');
    }
    if (!cageLabel) {
      throw new BadRequestException('Please select Cage No for travel sales mortality');
    }

    const purchaseOrder = data.purchaseOrderId
      ? await this.purchaseOrderRepository.findOne({ where: this.tenantWhere({ id: data.purchaseOrderId }) })
      : await this.purchaseOrderRepository.findOne({ where: this.tenantWhere({ orderNumber: invoiceNo }) });
    if (!purchaseOrder) {
      throw new BadRequestException(`Purchase bill ${invoiceNo} not found`);
    }

    const cage = await this.cagesService.findTravelMortalityCage(purchaseOrder.id, cageLabel);
    if (!cage) {
      throw new BadRequestException(`Cage ${cageLabel} not found on this purchase bill for travel sales`);
    }
    if (cage.status !== 'pending' && cage.status !== 'on_vehicle') {
      throw new BadRequestException(
        `Cage ${cageLabel} is ${String(cage.status).replace('_', ' ')} and cannot be used for travel sales mortality`,
      );
    }

    const requested = Math.floor(Number(requestedBirds) || 0);
    if (requested <= 0) {
      throw new BadRequestException('Number of birds died must be greater than 0');
    }
    const available = Math.max(0, (Number(cage.numberOfBirds) || 0) + (Number(creditBack) || 0));
    if (available <= 0) {
      throw new BadRequestException(`Cage ${cageLabel} has 0 birds. Cannot record travel sales mortality.`);
    }
    if (requested > available) {
      throw new BadRequestException(
        `Cannot record ${requested} birds died. Cage ${cageLabel} has only ${available} birds.`,
      );
    }
  }

  private async assertGodownBirdsAvailable(requestedBirds: number, creditBack = 0) {
    const requested = Math.floor(Number(requestedBirds) || 0);
    if (requested <= 0) {
      throw new BadRequestException('Number of birds died must be greater than 0');
    }

    const summary = await this.godownService.getSummary();
    const available = Math.max(0, (Number(summary.currentStock) || 0) + (Number(creditBack) || 0));

    if (available <= 0) {
      throw new BadRequestException('Cannot record godown mortality. Godown has 0 birds in stock.');
    }
    if (requested > available) {
      throw new BadRequestException(
        `Cannot record ${requested} birds died. Only ${available} birds available in godown.`,
      );
    }
  }

  private async syncGodownMortality(mortality: Mortality) {
    const payload = {
      mortalityDate: mortality.purchaseDate,
      numberOfBirdsDied: Number(mortality.numberOfBirdsDied) || 0,
      weightOfDeadBirds: mortality.weightOfDeadBirds != null ? Number(mortality.weightOfDeadBirds) : undefined,
      reason: mortality.cause || undefined,
      notes: mortality.notes || undefined,
      tenantId: this.getTenantId() ?? undefined,
    };

    if (mortality.godownMortalityId) {
      const existing = await this.godownMortalityRepository.findOne({
        where: this.tenantWhere({ id: mortality.godownMortalityId }),
      });
      if (existing) {
        Object.assign(existing, payload);
        existing.updatedAt = new Date();
        await this.godownMortalityRepository.save(existing);
        return;
      }
    }

    const created = await this.godownMortalityRepository.save(
      this.godownMortalityRepository.create(payload),
    );
    mortality.godownMortalityId = created.id;
    await this.mortalityRepository.update(mortality.id, { godownMortalityId: created.id });
  }

  private async removeLinkedGodownMortality(mortality: Mortality) {
    if (!mortality.godownMortalityId) return;
    await this.godownMortalityRepository.delete({ id: mortality.godownMortalityId });
    mortality.godownMortalityId = undefined;
    if (mortality.id) {
      await this.mortalityRepository.update(mortality.id, { godownMortalityId: null as any });
    }
  }
}
