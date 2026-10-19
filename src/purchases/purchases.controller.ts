import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, FileFilterCallback } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { AccountingService } from '../modules/accounting/accounting.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('purchases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchasesController {
  constructor(
    private readonly purchasesService: PurchasesService,
    private readonly accountingService: AccountingService,
  ) { }

  @Get('sync-all')
  async syncAll() {
    try {
      const result = await this.purchasesService.findAll();
      const items = Array.isArray(result) ? result : result.data || [];
      const synced: string[] = [];
      const failed: string[] = [];
      for (const item of items) {
        try {
          await this.accountingService.syncPurchase(item);
          synced.push(item.id || item.orderNumber);
        } catch { failed.push(item.id || item.orderNumber); }
      }
      return { synced: synced.length, failed: failed.length, details: { synced, failed } };
    } catch (err: any) {
      return { synced: 0, failed: 0, error: err.message };
    }
  }

  @Get('generate/next-order-number')
  async getNextOrderNumber() {
    const nextOrderNumber = await this.purchasesService.generateNextOrderNumber();
    return { nextOrderNumber };
  }

  @Post()
  @Permissions('purchases', 'create')
  create(@Body() createPurchaseOrderDto: CreatePurchaseOrderDto) {
    return this.purchasesService.create(createPurchaseOrderDto);
  }

  @Get()
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('supplier') supplier?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.purchasesService.findAll(startDate, endDate, supplier, status, page, limit);
  }

  @Get('invoices/list')
  getInvoiceList() {
    return this.purchasesService.getInvoiceList();
  }

  @Get('by-number/:orderNumber/cages')
  getCagesByOrderNumber(
    @Param('orderNumber') orderNumber: string,
    @Query('status') status?: string,
  ) {
    return this.purchasesService.getCagesByOrderNumber(orderNumber, status);
  }

  @Patch('cages/mark-sold')
  markCagesSold(@Body('cageIds') cageIds: string[], @Body('saleWeight') saleWeight?: number) {
    return this.purchasesService.markCagesSold(cageIds, saleWeight);
  }

  @Patch('cages/mark-in-godown')
  markCagesInGodown(
    @Body('cageIds') cageIds: string[],
    @Body('godownInwardId') godownInwardId: string,
    @Body('godownInwardWeight') godownInwardWeight?: number,
  ) {
    return this.purchasesService.markCagesInGodown(cageIds, godownInwardId, godownInwardWeight);
  }

  @Get('cage-journey/:orderNumber')
  getCageJourney(@Param('orderNumber') orderNumber: string) {
    return this.purchasesService.getCageJourney(orderNumber);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchasesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto) {
    return this.purchasesService.update(id, updatePurchaseOrderDto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'pending' | 'received' | 'cancelled',
  ) {
    return this.purchasesService.updateStatus(id, status);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.purchasesService.remove(id);
  }

  @Post(':id/upload-invoice')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'invoices');
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname || '').toLowerCase() || '.bin';
          cb(null, `invoice-${unique}${ext}`);
        },
      }),
      fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: FileFilterCallback) => {
        const allowedExt = ['.pdf', '.jpg', '.jpeg', '.png'];
        const allowedMime = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/pjpeg'];
        const ext = extname(file.originalname || '').toLowerCase();
        const mime = String(file.mimetype || '').toLowerCase();
        if (allowedExt.includes(ext) || allowedMime.includes(mime)) {
          cb(null, true);
        } else {
          cb(null, false);
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadInvoice(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Only PDF, JPG, and PNG files up to 10 MB can be attached');
    const fileUrl = `/uploads/invoices/${file.filename}`;
    return this.purchasesService.updateInvoiceAttachment(id, fileUrl);
  }
}