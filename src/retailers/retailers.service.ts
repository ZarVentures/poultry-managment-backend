import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Retailer } from './retailer.entity';
import { CreateRetailerDto } from './dto/create-retailer.dto';
import { UpdateRetailerDto } from './dto/update-retailer.dto';

@Injectable()
export class RetailersService {
  constructor(
    @InjectRepository(Retailer)
    private readonly retailerRepository: Repository<Retailer>,
  ) { }

  async create(createRetailerDto: CreateRetailerDto): Promise<Retailer> {
    const retailer = this.retailerRepository.create(createRetailerDto);
    return this.retailerRepository.save(retailer);
  }

  async findAll(page?: number, limit?: number, search?: string) {
    const query = this.retailerRepository.createQueryBuilder('retailer')
      .orderBy('retailer.createdAt', 'DESC');

    if (search) {
      query.andWhere(
        '(retailer.name ILIKE :search OR retailer.phone ILIKE :search OR retailer.shopName ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (page && limit) {
      const skip = (page - 1) * limit;
      const [data, total] = await query.skip(skip).take(limit).getManyAndCount();
      return { data, total, page, limit };
    }

    return query.getMany();
  }

  async findActive(): Promise<Retailer[]> {
    return this.retailerRepository.find({
      where: { status: 'active' },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Retailer> {
    const retailer = await this.retailerRepository.findOne({ where: { id } });
    if (!retailer) {
      throw new NotFoundException(`Retailer with ID ${id} not found`);
    }
    return retailer;
  }

  async update(id: string, updateRetailerDto: UpdateRetailerDto): Promise<Retailer> {
    const retailer = await this.findOne(id);
    Object.assign(retailer, updateRetailerDto);
    retailer.updatedAt = new Date();
    return this.retailerRepository.save(retailer);
  }

  async remove(id: string): Promise<void> {
    const retailer = await this.findOne(id);
    await this.retailerRepository.remove(retailer);
  }
}