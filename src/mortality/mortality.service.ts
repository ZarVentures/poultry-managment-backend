import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mortality } from './mortality.entity';
import { CreateMortalityDto } from './dto/create-mortality.dto';
import { UpdateMortalityDto } from './dto/update-mortality.dto';
import { PurchaseOrder } from '../purchases/entities/purchase-order.entity';
import { GodownMortality } from '../godown/godown-mortality.entity';

@Injectable()
export class MortalityService {
  constructor(
    @InjectRepository(Mortality)
    private mortalityRepository: Repository<Mortality>,
    @InjectRepository(PurchaseOrder)
    private purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(GodownMortality)
    private godownMortalityRepository: Repository<GodownMortality>,
  ) {}

  async create(createMortalityDto: CreateMortalityDto): Promise<Mortality> {
    // Generate record number
    const count = await this.mortalityRepository.count();
    const recordNumber = `MRT-${Date.now()}-${count + 1}`;

    // Find purchase order by invoice number
    const purchaseOrder = await this.purchaseOrderRepository.findOne({
      where: { orderNumber: createMortalityDto.purchaseInvoiceNo },
      relations: ['cages'],
    });

    const weight = Number(createMortalityDto.weightOfDeadBirds) || 0;
    const rate = Number(createMortalityDto.ratePerKg) || 0;
    const amount =
      createMortalityDto.amount != null
        ? Number(createMortalityDto.amount)
        : weight > 0 && rate > 0
          ? weight * rate
          : undefined;

    const mortality = this.mortalityRepository.create({
      ...createMortalityDto,
      recordNumber,
      purchaseOrderId: purchaseOrder?.id,
      amount,
    });

    return this.mortalityRepository.save(mortality);
  }

  async findAll(): Promise<Mortality[]> {
    return this.mortalityRepository.find({
      relations: ['purchaseOrder'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Mortality> {
    const mortality = await this.mortalityRepository.findOne({
      where: { id },
      relations: ['purchaseOrder'],
    });

    if (!mortality) {
      throw new NotFoundException(`Mortality record with ID ${id} not found`);
    }

    return mortality;
  }

  async update(id: string, updateMortalityDto: UpdateMortalityDto): Promise<Mortality> {
    const mortality = await this.findOne(id);

    // If purchase invoice changed, update the relation
    if (updateMortalityDto.purchaseInvoiceNo && 
        updateMortalityDto.purchaseInvoiceNo !== mortality.purchaseInvoiceNo) {
      const purchaseOrder = await this.purchaseOrderRepository.findOne({
        where: { orderNumber: updateMortalityDto.purchaseInvoiceNo },
      });
      mortality.purchaseOrderId = purchaseOrder?.id;
    }

    Object.assign(mortality, updateMortalityDto);

    const weight = Number(mortality.weightOfDeadBirds) || 0;
    const rate = Number(mortality.ratePerKg) || 0;
    if (weight > 0 && rate > 0) {
      mortality.amount = weight * rate;
    }

    mortality.updatedAt = new Date();

    return this.mortalityRepository.save(mortality);
  }

  async remove(id: string): Promise<void> {
    const mortality = await this.findOne(id);
    await this.mortalityRepository.remove(mortality);
  }

  async getStats(startDate?: string, endDate?: string) {
    const query = this.mortalityRepository.createQueryBuilder('mortality');

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
    const farmDeaths = mortalities.reduce(
      (sum, m) => sum + (Number(m.numberOfBirdsDied) || 0),
      0,
    );
    const totalWeight = mortalities.reduce(
      (sum, m) => sum + (Number(m.weightOfDeadBirds) || 0),
      0,
    );

    // Include godown mortality so dashboard bird count matches all mortality records
    const godownQuery = this.godownMortalityRepository.createQueryBuilder('gm');
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

    const totalBirdsDeath = farmDeaths + godownDeaths;
    const totalValue = totalBirdsDeath * 150;

    return {
      totalBirdsPurchased,
      totalBirdsDeath,
      farmDeaths,
      godownDeaths,
      totalWeight: totalWeight + godownWeight,
      totalValue,
      totalRecords: mortalities.length + godownMortalities.length,
    };
  }
}
