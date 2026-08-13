import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mortality } from './mortality.entity';
import { CreateMortalityDto } from './dto/create-mortality.dto';
import { UpdateMortalityDto } from './dto/update-mortality.dto';
import { PurchaseOrder } from '../purchases/entities/purchase-order.entity';

@Injectable()
export class MortalityService {
  constructor(
    @InjectRepository(Mortality)
    private mortalityRepository: Repository<Mortality>,
    @InjectRepository(PurchaseOrder)
    private purchaseOrderRepository: Repository<PurchaseOrder>,
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

    const mortality = this.mortalityRepository.create({
      ...createMortalityDto,
      recordNumber,
      purchaseOrderId: purchaseOrder?.id,
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
    mortality.updatedAt = new Date();

    return this.mortalityRepository.save(mortality);
  }

  async remove(id: string): Promise<void> {
    const mortality = await this.findOne(id);
    await this.mortalityRepository.remove(mortality);
  }

  async getStats() {
    const mortalities = await this.findAll();
    
    const totalBirdsPurchased = mortalities.reduce((sum, m) => sum + m.totalBirdsPurchased, 0);
    const totalBirdsDeath = mortalities.reduce((sum, m) => sum + m.numberOfBirdsDied, 0);
    const totalValue = mortalities.reduce((sum, m) => {
      // Estimate value based on average bird price (you can adjust this)
      const avgPricePerBird = 150; // ₹150 per bird
      return sum + (m.numberOfBirdsDied * avgPricePerBird);
    }, 0);

    return {
      totalBirdsPurchased,
      totalBirdsDeath,
      totalValue,
      totalRecords: mortalities.length,
    };
  }
}
