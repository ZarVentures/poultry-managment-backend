import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { VehicleBirdReturnsService } from './vehicle-bird-returns.service';
import { CreateVehicleBirdReturnDto } from './dto/create-vehicle-bird-return.dto';
import { UpdateVehicleBirdReturnDto } from './dto/update-vehicle-bird-return.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('vehicle-bird-returns')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VehicleBirdReturnsController {
  constructor(private readonly vehicleBirdReturnsService: VehicleBirdReturnsService) {}

  @Post()
  @Permissions('sales', 'create')
  create(@Body() createDto: CreateVehicleBirdReturnDto, @Request() req: any) {
    const createdBy = req.user?.name || req.user?.email;
    return this.vehicleBirdReturnsService.create(createDto, createdBy);
  }

  @Get()
  @Permissions('sales', 'read')
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('saleId') saleId?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.vehicleBirdReturnsService.findAll(
      startDate,
      endDate,
      saleId,
      status,
      customerId,
      page,
      limit,
    );
  }

  @Get('stats')
  @Permissions('sales', 'read')
  getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.vehicleBirdReturnsService.getReturnStats(startDate, endDate);
  }

  @Get('by-sale/:saleId')
  @Permissions('sales', 'read')
  findBySaleId(@Param('saleId') saleId: string) {
    return this.vehicleBirdReturnsService.findBySaleId(saleId);
  }

  @Get(':id')
  @Permissions('sales', 'read')
  findOne(@Param('id') id: string) {
    return this.vehicleBirdReturnsService.findOne(id);
  }

  @Patch(':id')
  @Permissions('sales', 'update')
  update(@Param('id') id: string, @Body() updateDto: UpdateVehicleBirdReturnDto) {
    return this.vehicleBirdReturnsService.update(id, updateDto);
  }

  @Patch(':id/approve')
  @Permissions('sales', 'update')
  approve(@Param('id') id: string, @Request() req: any) {
    const approvedBy = req.user?.name || req.user?.email;
    return this.vehicleBirdReturnsService.approveReturn(id, approvedBy);
  }

  @Patch(':id/reject')
  @Permissions('sales', 'update')
  reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    const approvedBy = req.user?.name || req.user?.email;
    return this.vehicleBirdReturnsService.rejectReturn(id, approvedBy, reason);
  }

  @Patch(':id/process')
  @Permissions('sales', 'update')
  process(@Param('id') id: string, @Request() req: any) {
    const processedBy = req.user?.name || req.user?.email;
    return this.vehicleBirdReturnsService.processReturn(id, processedBy);
  }

  @Delete(':id')
  @Permissions('sales', 'delete')
  remove(@Param('id') id: string) {
    return this.vehicleBirdReturnsService.remove(id);
  }
}
