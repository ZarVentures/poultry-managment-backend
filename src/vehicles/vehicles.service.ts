import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { TenantContextService } from '../tenants/tenant-context.service';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
    private readonly tenantContext: TenantContextService,
  ) { }

  private getTenantId(): string | null {
    return this.tenantContext.getTenantId();
  }

  private tenantWhere(extra: any): any {
    const tenantId = this.getTenantId();
    return tenantId ? { ...extra, tenantId } : extra;
  }

  private applyTenant(query: SelectQueryBuilder<Vehicle>): SelectQueryBuilder<Vehicle> {
    const tenantId = this.getTenantId();
    if (tenantId) query.andWhere('vehicle.tenantId = :tenantId', { tenantId });
    return query;
  }

  async findAll(page?: number, limit?: number, search?: string) {
    const query = this.vehiclesRepository.createQueryBuilder('vehicle')
      .orderBy('vehicle.vehicleNumber', 'ASC');

    this.applyTenant(query);

    if (search) {
      query.andWhere(
        '(vehicle.vehicleNumber ILIKE :search OR vehicle.driverName ILIKE :search OR vehicle.ownerName ILIKE :search)',
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

  async findActive(): Promise<Vehicle[]> {
    return this.vehiclesRepository.find({
      where: this.tenantWhere({ status: 'active' }),
      order: { vehicleNumber: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Vehicle> {
    const vehicle = await this.vehiclesRepository.findOne({ where: this.tenantWhere({ id }) });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle with id ${id} not found`);
    }
    return vehicle;
  }

  async create(data: CreateVehicleDto): Promise<Vehicle> {
    const toNum = (v: any) => (v === '' || v === undefined || v === null) ? null : Number(v);
    const entity = this.vehiclesRepository.create({
      vehicleNumber: data.vehicleNumber,
      vehicleType: data.vehicleType,
      driverName: data.driverName,
      phone: data.phone,
      ownerName: data.ownerName,
      address: data.address,
      totalCapacity: toNum(data.totalCapacity),
      petrolTankCapacity: data.petrolTankCapacity === '' ? null : (data.petrolTankCapacity ?? null),
      mileage: data.mileage === '' ? null : (data.mileage ?? null),
      joinDate: data.joinDate,
      status: data.status ?? 'active',
      note: data.note,
      tenantId: this.getTenantId() ?? undefined,
    });
    return this.vehiclesRepository.save(entity);
  }

  async update(id: string, data: UpdateVehicleDto): Promise<Vehicle> {
    const existing = await this.findOne(id);

    const toNum = (v: any) => (v === '' || v === undefined || v === null) ? null : Number(v);

    Object.assign(existing, {
      ...data,
      totalCapacity: data.totalCapacity !== undefined ? toNum(data.totalCapacity) : existing.totalCapacity,
      petrolTankCapacity: data.petrolTankCapacity !== undefined ? (data.petrolTankCapacity === '' ? null : data.petrolTankCapacity) : existing.petrolTankCapacity,
      mileage: data.mileage !== undefined ? (data.mileage === '' ? null : data.mileage) : existing.mileage,
    });

    return this.vehiclesRepository.save(existing);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findOne(id);
    await this.vehiclesRepository.remove(existing);
  }
}

