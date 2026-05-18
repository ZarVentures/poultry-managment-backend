import { Controller, Get, Patch, Param, Body, Query } from '@nestjs/common';
import { CagesService } from './cages.service';

@Controller('cages')
export class CagesController {
  constructor(private readonly cagesService: CagesService) { }

  // Get cages by purchase order number (for sale/godown forms)
  @Get('by-purchase/:orderNumber')
  getByPurchaseOrderNumber(
    @Param('orderNumber') orderNumber: string,
    @Query('status') status?: string,
  ) {
    return this.cagesService.getByPurchaseOrderNumber(orderNumber, status as any);
  }

  // Get cages by godown inward entry ID (for godown sales)
  @Get('by-inward/:godownInwardId')
  getByGodownInwardId(
    @Param('godownInwardId') godownInwardId: string,
    @Query('status') status?: string,
  ) {
    return this.cagesService.getByGodownInwardId(godownInwardId, status as any);
  }


  // Get cage journey (weight loss tracking)
  @Get('journey/:orderNumber')
  getCageJourney(@Param('orderNumber') orderNumber: string) {
    return this.cagesService.getCageJourney(orderNumber);
  }

  // Get cages currently on a vehicle
  @Get('on-vehicle/:vehicleId')
  getCagesByVehicle(@Param('vehicleId') vehicleId: string) {
    return this.cagesService.getCagesByVehicle(vehicleId);
  }

  // Mark cages as on_vehicle
  @Patch('mark-on-vehicle')
  markOnVehicle(@Body('cageIds') cageIds: string[], @Body('vehicleId') vehicleId: string) {
    return this.cagesService.markOnVehicle(cageIds, vehicleId);
  }

  // Mark cages as sold
  @Patch('mark-sold')
  markSold(
    @Body('cageIds') cageIds: string[],
    @Body('saleId') saleId: string,
    @Body('saleWeight') saleWeight?: number,
  ) {
    return this.cagesService.markSold(cageIds, saleId, saleWeight);
  }

  // Mark cages as in_godown
  @Patch('mark-in-godown')
  markInGodown(
    @Body('cageIds') cageIds: string[],
    @Body('godownInwardId') godownInwardId: string,
    @Body('godownInwardWeight') godownInwardWeight?: number,
  ) {
    return this.cagesService.markInGodown(cageIds, godownInwardId, godownInwardWeight);
  }

  // Mark cages as godown_sold
  @Patch('mark-godown-sold')
  markGodownSold(
    @Body('cageIds') cageIds: string[],
    @Body('godownSaleId') godownSaleId: string,
    @Body('godownSaleWeight') godownSaleWeight?: number,
  ) {
    return this.cagesService.markGodownSold(cageIds, godownSaleId, godownSaleWeight);
  }

  // Get all cages currently in godown
  @Get('in-godown')
  getInGodown() {
    return this.cagesService.getInGodown();
  }

  // Handle partial cage sale
  @Patch('partial-godown-sale')
  partialGodownSale(
    @Body('cageId') cageId: string,
    @Body('godownSaleId') godownSaleId: string,
    @Body('soldBirds') soldBirds: number,
    @Body('soldWeight') soldWeight: number,
  ) {
    return this.cagesService.partialGodownSale(cageId, godownSaleId, soldBirds, soldWeight);
  }
}
