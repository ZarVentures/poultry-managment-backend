import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Product } from './product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { TenantContextService } from '../tenants/tenant-context.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getTenantId(): string | null {
    return this.tenantContext.getTenantId();
  }

  private tenantWhere(extra: any): any {
    const tenantId = this.getTenantId();
    return tenantId ? { ...extra, tenantId } : extra;
  }

  private applyTenant(query: SelectQueryBuilder<Product>): SelectQueryBuilder<Product> {
    const tenantId = this.getTenantId();
    if (tenantId) query.andWhere('product.tenantId = :tenantId', { tenantId });
    return query;
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    // Check if product with same name already exists
    const existingProduct = await this.productRepository.findOne({
      where: this.tenantWhere({ name: createProductDto.name }),
    });
    if (existingProduct) {
      throw new BadRequestException(`Product with name "${createProductDto.name}" already exists`);
    }

    const product = this.productRepository.create({
      ...createProductDto,
      price: createProductDto.price ? parseFloat(createProductDto.price) : undefined,
      tenantId: this.getTenantId() ?? undefined,
    });

    return this.productRepository.save(product);
  }

  async findAll(
    category?: string,
    productType?: string,
    status?: string,
  ): Promise<Product[]> {
    const query = this.productRepository.createQueryBuilder('product')
      .orderBy('product.name', 'ASC');

    this.applyTenant(query);

    if (category) {
      query.andWhere('product.category = :category', { category });
    }

    if (productType) {
      query.andWhere('product.productType = :productType', { productType });
    }

    if (status) {
      query.andWhere('product.status = :status', { status });
    }

    return query.getMany();
  }

  async findActive(): Promise<Product[]> {
    return this.productRepository.find({
      where: this.tenantWhere({ status: 'active' }),
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: this.tenantWhere({ id }),
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);

    // If name is being updated, check for duplicates
    if (updateProductDto.name && updateProductDto.name !== product.name) {
      const existingProduct = await this.productRepository.findOne({
        where: this.tenantWhere({ name: updateProductDto.name }),
      });
      if (existingProduct) {
        throw new BadRequestException(`Product with name "${updateProductDto.name}" already exists`);
      }
    }

    Object.assign(product, {
      ...updateProductDto,
      price: updateProductDto.price ? parseFloat(updateProductDto.price) : product.price,
    });
    product.updatedAt = new Date();
    return this.productRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productRepository.remove(product);
  }

  async updateStatus(id: string, status: 'active' | 'inactive'): Promise<Product> {
    const product = await this.findOne(id);
    product.status = status;
    product.updatedAt = new Date();
    return this.productRepository.save(product);
  }
}
