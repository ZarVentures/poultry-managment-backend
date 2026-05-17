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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, FileFilterCallback } from 'multer';
import { extname, join } from 'path';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) { }

  @Get('next-order-number')
  async getNextOrderNumber() {
    const nextOrderNumber = await this.purchasesService.generateNextOrderNumber();
    return { nextOrderNumber };
  }

  @Post()
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
  markCagesInGodown(@Body('cageIds') cageIds: string[], @Body('godownInwardWeight') godownInwardWeight?: number) {
    return this.purchasesService.markCagesInGodown(cageIds, godownInwardWeight);
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
        destination: join(process.cwd(), 'uploads', 'invoices'),
        filename: (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `invoice-${unique}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: FileFilterCallback) => {
        const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
        if (allowed.includes(extname(file.originalname).toLowerCase())) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only PDF, JPG, PNG files are allowed'));
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadInvoice(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const fileUrl = `/uploads/invoices/${file.filename}`;
    return this.purchasesService.updateInvoiceAttachment(id, fileUrl);
  }
}