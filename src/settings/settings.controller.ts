import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { Settings } from './settings.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async findAll(): Promise<Settings[]> {
    return this.settingsService.findAll();
  }

  @Get('app')
  async getAppSettings(): Promise<{
    currency: string;
    theme: string;
    companyName: string;
    companyEmail: string;
    companyPhone: string;
    companyAddress: string;
  }> {
    return this.settingsService.getAppSettings();
  }

  @Put('app')
  async updateAppSettings(
    @Body() body: {
      currency?: string;
      theme?: string;
      companyName?: string;
      companyEmail?: string;
      companyPhone?: string;
      companyAddress?: string;
    }
  ): Promise<{ message: string }> {
    await this.settingsService.updateAppSettings(body);
    return { message: 'Settings updated successfully' };
  }

  @Get('category/:category')
  async findByCategory(@Param('category') category: string): Promise<Settings[]> {
    return this.settingsService.findByCategory(category);
  }

  @Get('key/:key')
  async findByKey(@Param('key') key: string): Promise<Settings | null> {
    return this.settingsService.findByKey(key);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Settings> {
    return this.settingsService.findOne(id);
  }

  @Post()
  async create(@Body() body: CreateSettingDto): Promise<Settings> {
    return this.settingsService.create(body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateSettingDto): Promise<Settings> {
    return this.settingsService.update(id, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    await this.settingsService.delete(id);
    return { message: 'Setting deleted successfully' };
  }
}
