import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards, Query } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { Vehicle } from './vehicle.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) { }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ): Promise<any> {
    return this.vehiclesService.findAll(page, limit, search);
  }

  @Get('active/list')
  async findActive(): Promise<Vehicle[]> {
    return this.vehiclesService.findActive();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Vehicle> {
    return this.vehiclesService.findOne(id);
  }

  @Post()
  async create(@Body() body: CreateVehicleDto): Promise<Vehicle> {
    return this.vehiclesService.create(body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateVehicleDto): Promise<Vehicle> {
    return this.vehiclesService.update(id, body);
  }

  @Put(':id')
  async updatePut(@Param('id') id: string, @Body() body: UpdateVehicleDto): Promise<Vehicle> {
    return this.vehiclesService.update(id, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.vehiclesService.remove(id);
  }
}

