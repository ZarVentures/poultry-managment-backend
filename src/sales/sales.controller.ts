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
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('sales')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) { }

  @Get('next-invoice-number')
  @Permissions('sales', 'read')
  async getNextInvoiceNumber() {
    const nextInvoiceNumber = await this.salesService.generateNextInvoiceNumber();
    return { nextInvoiceNumber };
  }

  @Post()
  @Permissions('sales', 'create')
  create(@Body() createSaleDto: CreateSaleDto) {
    return this.salesService.create(createSaleDto);
  }

  @Get()
  @Permissions('sales', 'read')
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('customer') customer?: string,
    @Query('productType') productType?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.salesService.findAll(startDate, endDate, customer, productType, paymentStatus, undefined, page, limit);
  }

  @Get('invoices/list')
  getInvoiceList() {
    return this.salesService.getInvoiceList();
  }

  @Get(':id')
  @Permissions('sales', 'read')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Patch(':id')
  @Permissions('sales', 'update')
  update(@Param('id') id: string, @Body() updateSaleDto: UpdateSaleDto) {
    return this.salesService.update(id, updateSaleDto);
  }

  @Patch(':id/payment')
  updatePaymentStatus(
    @Param('id') id: string,
    @Body('paymentStatus') paymentStatus: 'paid' | 'pending' | 'partial',
    @Body('amountReceived') amountReceived?: number,
  ) {
    return this.salesService.updatePaymentStatus(id, paymentStatus, amountReceived);
  }

  @Delete(':id')
  @Permissions('sales', 'delete')
  remove(@Param('id') id: string) {
    return this.salesService.remove(id);
  }

  @Post(':id/upload-attachment')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'sales'),
        filename: (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `sale-${unique}${extname(file.originalname)}`);
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
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadAttachment(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const fileUrl = `/uploads/sales/${file.filename}`;
    return this.salesService.updateAttachment(id, fileUrl);
  }
}