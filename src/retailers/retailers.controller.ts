import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { RetailersService } from './retailers.service';
import { CreateRetailerDto } from './dto/create-retailer.dto';
import { UpdateRetailerDto } from './dto/update-retailer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('retailers')
@UseGuards(JwtAuthGuard)
export class RetailersController {
  constructor(private readonly retailersService: RetailersService) { }

  @Post()
  create(@Body() createRetailerDto: CreateRetailerDto) {
    return this.retailersService.create(createRetailerDto);
  }

  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.retailersService.findAll(page, limit, search);
  }

  @Get('active/list')
  findActive() {
    return this.retailersService.findActive();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.retailersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRetailerDto: UpdateRetailerDto) {
    return this.retailersService.update(id, updateRetailerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.retailersService.remove(id);
  }
}