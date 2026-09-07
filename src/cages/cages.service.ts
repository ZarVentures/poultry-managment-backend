import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Cage, CageStatus } from './cage.entity';
import { TenantContextService } from '../tenants/tenant-context.service';

@Injectable()
export class CagesService {
  constructor(
    @InjectRepository(Cage)
    private readonly cageRepo: Repository<Cage>,
    private readonly tenantContext: TenantContextService,
  ) { }

  private getTenantId(): string | null {
    return this.tenantContext.getTenantId();
  }

  private tenantWhere(extra: any): any {
    const tenantId = this.getTenantId();
    return tenantId ? { ...extra, tenantId } : extra;
  }

  private applyTenant(query: SelectQueryBuilder<Cage>, alias = 'cage'): SelectQueryBuilder<Cage> {
    const tenantId = this.getTenantId();
    if (tenantId) query.andWhere(`${alias}.tenantId = :tenantId`, { tenantId });
    return query;
  }

  // Create cages from a purchase order
  async createFromPurchase(purchaseOrderId: string, cageData: Array<{
    cageId?: string;
    numberOfBirds: number;
    purchaseWeight: number;
  }>): Promise<Cage[]> {
    const cages = cageData.map(c =>
      this.cageRepo.create({
        purchaseOrderId,
        cageId: c.cageId,
        numberOfBirds: c.numberOfBirds,
        purchaseWeight: c.purchaseWeight,
        status: 'pending',
        tenantId: this.getTenantId() ?? undefined,
      })
    );
    return this.cageRepo.save(cages);
  }

  // Get cages by purchase order number, optionally filtered by status
  async getByPurchaseOrderNumber(orderNumber: string, status?: CageStatus): Promise<Cage[]> {
    const query = this.cageRepo.createQueryBuilder('cage')
      .innerJoin('cage.purchaseOrder', 'po')
      .where('po.orderNumber = :orderNumber', { orderNumber });
    this.applyTenant(query, 'cage');

    if (status) query.andWhere('cage.status = :status', { status });

    return query.orderBy('cage.cageId', 'ASC').getMany();
  }

  // Get cages by godown inward entry ID, optionally filtered by status
  async getByGodownInwardId(godownInwardId: string, status?: CageStatus): Promise<Cage[]> {
    const query = this.cageRepo.createQueryBuilder('cage')
      .leftJoinAndSelect('cage.purchaseOrder', 'po')
      .where('cage.godownInwardId = :godownInwardId', { godownInwardId });
    this.applyTenant(query, 'cage');

    if (status) {
      query.andWhere('cage.status = :status', { status });
    }

    return query.orderBy('cage.cageId', 'ASC').getMany();
  }


  // Get cages by purchase order ID
  async getByPurchaseOrderId(purchaseOrderId: string, status?: CageStatus): Promise<Cage[]> {
    const where: any = this.tenantWhere({ purchaseOrderId });
    if (status) where.status = status;
    return this.cageRepo.find({ where, order: { cageId: 'ASC' } });
  }

  // Mark cages as on_vehicle (loaded for sale)
  async markOnVehicle(cageIds: string[], vehicleId: string): Promise<void> {
    if (!cageIds.length) return;
    await this.cageRepo.createQueryBuilder()
      .update()
      .set({ status: 'on_vehicle', vehicleId, updatedAt: new Date() })
      .whereInIds(cageIds)
      .execute();
  }

  // Mark cages as sold (from vehicle to retailer)
  async markSold(cageIds: string[], saleId: string, saleWeight?: number): Promise<void> {
    if (!cageIds.length) return;
    const updateData: any = { status: 'sold', saleId, updatedAt: new Date() };
    if (saleWeight !== undefined) updateData.saleWeight = saleWeight;
    await this.cageRepo.createQueryBuilder()
      .update()
      .set(updateData)
      .whereInIds(cageIds)
      .execute();
  }

  // Mark cages as in_godown
  async markInGodown(cageIds: string[], godownInwardId: string, godownInwardWeight?: number): Promise<void> {
    if (!cageIds.length) return;
    const updateData: any = { status: 'in_godown', godownInwardId, vehicleId: null, updatedAt: new Date() };
    if (godownInwardWeight !== undefined) updateData.godownInwardWeight = godownInwardWeight;
    await this.cageRepo.createQueryBuilder()
      .update()
      .set(updateData)
      .whereInIds(cageIds)
      .execute();
  }

  // Update per-cage details for an existing godown inward entry (edit flow)
  async updateGodownInwardCages(
    godownInwardId: string,
    cageUpdates: Array<{
      id?: string;
      cageId?: string;
      numberOfBirds?: number;
      godownInwardWeight?: number;
    }>,
  ): Promise<void> {
    if (!cageUpdates?.length) return;

    for (const update of cageUpdates) {
      if (!update.id) continue;

      const patch: Partial<Cage> = {
        godownInwardId,
        status: 'in_godown',
        updatedAt: new Date(),
      };

      if (update.numberOfBirds !== undefined) {
        patch.numberOfBirds = Number(update.numberOfBirds);
      }
      if (update.godownInwardWeight !== undefined && update.godownInwardWeight !== null) {
        patch.godownInwardWeight = Number(update.godownInwardWeight);
      }
      if (update.cageId !== undefined) {
        patch.cageId = update.cageId;
      }

      await this.cageRepo.update({ id: String(update.id) }, patch);
    }
  }

  // Mark cages as godown_sold
  async markGodownSold(cageIds: string[], godownSaleId: string, godownSaleWeight?: number): Promise<void> {
    if (!cageIds.length) return;
    const updateData: any = { status: 'godown_sold', godownSaleId, updatedAt: new Date() };
    if (godownSaleWeight !== undefined) updateData.godownSaleWeight = godownSaleWeight;
    await this.cageRepo.createQueryBuilder()
      .update()
      .set(updateData)
      .whereInIds(cageIds)
      .execute();
  }

  // Handle partial cage sale by splitting the record
  async partialGodownSale(
    cageId: string,
    godownSaleId: string,
    soldBirds: number,
    soldWeight: number,
    weightLoss: number = 0
  ): Promise<void> {
    const cage = await this.cageRepo.findOne({ where: this.tenantWhere({ id: cageId }) });
    if (!cage) throw new NotFoundException(`Cage ${cageId} not found`);

    if (soldBirds >= cage.numberOfBirds) {
      // Full sale
      await this.markGodownSold([cageId], godownSaleId, soldWeight);
      return;
    }

    // Partial sale: Split the record
    const remainingBirds = cage.numberOfBirds - soldBirds;
    const originalInwardWeight = Number(cage.godownInwardWeight || cage.purchaseWeight || 0);

    // The portion we are selling originally weighed (soldWeight + weightLoss)
    const inwardWeightOfSoldPortion = Number(soldWeight) + Number(weightLoss);
    const remainingWeight = Math.max(0, originalInwardWeight - inwardWeightOfSoldPortion);

    // 1. Create a new record for the SOLD portion
    const soldCage = this.cageRepo.create({
      ...cage,
      id: undefined, // Let DB generate new ID
      numberOfBirds: soldBirds,
      godownInwardWeight: inwardWeightOfSoldPortion,
      godownSaleWeight: soldWeight,
      status: 'godown_sold',
      godownSaleId,
      updatedAt: new Date(),
    });

    // 2. Update the existing record with the REMAINING portion
    cage.numberOfBirds = remainingBirds;
    cage.godownInwardWeight = remainingWeight;
    cage.updatedAt = new Date();

    await this.cageRepo.save([soldCage, cage]);
  }

  // Get all cages currently in godown
  async getInGodown(): Promise<Cage[]> {
    return this.cageRepo.find({
      where: this.tenantWhere({ status: 'in_godown' }),
      order: { cageId: 'ASC' },
      relations: ['purchaseOrder'],
    });
  }

  // Get full cage journey for a purchase bill (weight loss tracking)
  async getCageJourney(orderNumber: string): Promise<any[]> {
    const cages = await this.getByPurchaseOrderNumber(orderNumber);

    return cages.map(cage => {
      const pw = Number(cage.purchaseWeight) || 0;
      const sw = cage.saleWeight != null ? Number(cage.saleWeight) : null;
      const giw = cage.godownInwardWeight != null ? Number(cage.godownInwardWeight) : null;
      const gsw = cage.godownSaleWeight != null ? Number(cage.godownSaleWeight) : null;

      const lossPurchaseToSale = sw !== null ? pw - sw : null;
      const lossSaleToGodown = sw !== null && giw !== null ? sw - giw : null;
      const lossGodownToSale = giw !== null && gsw !== null ? giw - gsw : null;
      const totalLoss = gsw !== null ? pw - gsw : sw !== null ? pw - sw : null;

      return {
        id: cage.id,
        cageId: cage.cageId,
        numberOfBirds: cage.numberOfBirds,
        status: cage.status,
        vehicleId: cage.vehicleId,
        purchaseWeight: pw,
        saleWeight: sw,
        godownInwardWeight: giw,
        godownSaleWeight: gsw,
        lossPurchaseToSale,
        lossSaleToGodown,
        lossGodownToSale,
        totalLoss,
      };
    });
  }

  // Get all cages currently on a vehicle
  async getCagesByVehicle(vehicleId: string): Promise<Cage[]> {
    return this.cageRepo.find({
      where: this.tenantWhere({ vehicleId, status: 'on_vehicle' }),
      order: { cageId: 'ASC' },
    });
  }

  // Get cages by godown sale ID
  async getByGodownSaleId(godownSaleId: string): Promise<Cage[]> {
    return this.cageRepo.find({
      where: this.tenantWhere({ godownSaleId }),
      order: { cageId: 'ASC' },
      relations: ['purchaseOrder'],
    });
  }


  // Delete cages for a purchase order (used when purchase is deleted)
  async deleteByPurchaseOrderId(purchaseOrderId: string): Promise<void> {
    await this.cageRepo.delete({ purchaseOrderId });
  }

  // Replace cages for a purchase order (used on update)
  async replaceForPurchaseOrder(purchaseOrderId: string, cageData: Array<{
    cageId?: string;
    numberOfBirds: number;
    purchaseWeight: number;
  }>): Promise<Cage[]> {
    await this.deleteByPurchaseOrderId(purchaseOrderId);
    return this.createFromPurchase(purchaseOrderId, cageData);
  }

  // Revert cages associated with a godown sale
  async revertGodownSaleCages(godownSaleId: string): Promise<void> {
    await this.cageRepo.createQueryBuilder()
      .update()
      .set({
        status: 'in_godown' as any,
        godownSaleId: null as any,
        godownSaleWeight: null as any,
        updatedAt: new Date(),
      })
      .where('godownSaleId = :godownSaleId', { godownSaleId })
      .execute();
  }

  // Handle partial vehicle sale by splitting the record
  async partialVehicleSale(
    cageId: string,
    saleId: string,
    soldBirds: number,
    soldWeight: number,
    weightLoss: number = 0
  ): Promise<void> {
    const cage = await this.cageRepo.findOne({ where: this.tenantWhere({ id: cageId }) });
    if (!cage) throw new NotFoundException(`Cage ${cageId} not found`);

    if (soldBirds >= cage.numberOfBirds) {
      // Full sale
      await this.markSold([cageId], saleId, soldWeight);
      return;
    }

    // Partial sale: Split the record
    const remainingBirds = cage.numberOfBirds - soldBirds;
    const originalWeight = Number(cage.purchaseWeight || 0);

    // The portion we are selling originally weighed (soldWeight + weightLoss)
    const weightOfSoldPortion = Number(soldWeight) + Number(weightLoss);
    const remainingWeight = Math.max(0, originalWeight - weightOfSoldPortion);

    // 1. Create a new record for the SOLD portion
    const soldCage = this.cageRepo.create({
      ...cage,
      id: undefined, // Let DB generate new ID
      numberOfBirds: soldBirds,
      purchaseWeight: weightOfSoldPortion,
      saleWeight: soldWeight,
      status: 'sold',
      saleId,
      updatedAt: new Date(),
    });

    // 2. Update the existing record with the REMAINING portion
    cage.numberOfBirds = remainingBirds;
    cage.purchaseWeight = remainingWeight;
    cage.updatedAt = new Date();

    await this.cageRepo.save([soldCage, cage]);
  }

  // Revert cages associated with a vehicle sale
  async revertVehicleSaleCages(saleId: string): Promise<void> {
    const cages = await this.cageRepo.find({ where: this.tenantWhere({ saleId }) });
    if (!cages.length) return;
    for (const cage of cages) {
      await this.cageRepo.update(cage.id, {
        status: cage.vehicleId ? 'on_vehicle' : 'pending',
        saleId: null as any,
        saleWeight: null as any,
        updatedAt: new Date(),
      });
    }
  }
}
