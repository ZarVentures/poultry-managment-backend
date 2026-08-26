import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GodownService } from './godown.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('godowns')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GodownsController {
  constructor(private readonly godownService: GodownService) { }

  @Get()
  @Permissions('godowns', 'read')
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.godownService.findAllGodowns(page, limit, search, status);
  }

  @Get('active/list')
  @Permissions('godowns', 'read')
  findActive() {
    return this.godownService.findActiveGodowns();
  }

  @Get(':id')
  @Permissions('godowns', 'read')
  findOne(@Param('id') id: string) {
    return this.godownService.findOneGodown(id);
  }

  @Post()
  @Permissions('godowns', 'create')
  create(@Body() data: any) {
    return this.godownService.createGodown(data);
  }

  @Patch(':id')
  @Permissions('godowns', 'update')
  update(@Param('id') id: string, @Body() data: any) {
    return this.godownService.updateGodown(id, data);
  }

  @Delete(':id')
  @Permissions('godowns', 'delete')
  remove(@Param('id') id: string) {
    return this.godownService.removeGodown(id);
  }
}
