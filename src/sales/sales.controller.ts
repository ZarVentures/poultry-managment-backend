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
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(@Body() createSaleDto: CreateSaleDto) {
    return this.salesService.create(createSaleDto);
  }

  @Get()
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('customer') customer?: string,
    @Query('productType') productType?: string,
    @Query('paymentStatus') paymentStatus?: string,
  ) {
    return this.salesService.findAll(startDate, endDate, customer, productType, paymentStatus);
  }

  @Get('invoices/list')
  getInvoiceList() {
    return this.salesService.getInvoiceList();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Patch(':id')
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