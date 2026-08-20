import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { TenantsService, CreateTenantData } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Request() req: any, @Body() body: CreateTenantData) {
    return this.tenantsService.create(req.user.userId, body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyTenant(@Request() req: any) {
    return this.tenantsService.findByUserId(req.user.userId);
  }
}