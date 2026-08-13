import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { MortalityService } from './mortality.service';
import { CreateMortalityDto } from './dto/create-mortality.dto';
import { UpdateMortalityDto } from './dto/update-mortality.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('mortality')
@UseGuards(JwtAuthGuard)
export class MortalityController {
  constructor(private readonly mortalityService: MortalityService) {}

  @Post()
  create(@Body() createMortalityDto: CreateMortalityDto) {
    return this.mortalityService.create(createMortalityDto);
  }

  @Get()
  findAll() {
    return this.mortalityService.findAll();
  }

  @Get('stats')
  getStats() {
    return this.mortalityService.getStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mortalityService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMortalityDto: UpdateMortalityDto) {
    return this.mortalityService.update(id, updateMortalityDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mortalityService.remove(id);
  }
}
