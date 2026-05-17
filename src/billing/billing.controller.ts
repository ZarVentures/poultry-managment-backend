import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // Summary
  @Get('summary')
  getSummary() { return this.billingService.getSummary(); }

  // Company Report
  @Get('company-report')
  getCompanyReport(
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
  ) { return this.billingService.getCompanyReport(fromDate, toDate); }

  // Parties
  @Get('parties')
  getParties() { return this.billingService.getParties(); }

  @Get('parties/:id')
  getParty(@Param('id') id: string) { return this.billingService.getParty(id); }

  @Post('parties')
  createParty(@Body() body: any) { return this.billingService.createParty(body); }

  @Patch('parties/:id')
  updateParty(@Param('id') id: string, @Body() body: any) { return this.billingService.updateParty(id, body); }

  @Delete('parties/:id')
  deleteParty(@Param('id') id: string) { return this.billingService.deleteParty(id); }

  // Sales
  @Get('sales')
  getSales(@Query('partyId') partyId?: string) { return this.billingService.getSales(partyId); }

  @Post('sales')
  createSale(@Body() body: any) { return this.billingService.createSale(body); }

  @Patch('sales/:id')
  updateSale(@Param('id') id: string, @Body() body: any) { return this.billingService.updateSale(id, body); }

  @Delete('sales/:id')
  deleteSale(@Param('id') id: string) { return this.billingService.deleteSale(id); }

  // Payments
  @Get('payments')
  getPayments(@Query('partyId') partyId?: string) { return this.billingService.getPayments(partyId); }

  @Post('payments')
  createPayment(@Body() body: any) { return this.billingService.createPayment(body); }

  @Patch('payments/:id')
  updatePayment(@Param('id') id: string, @Body() body: any) { return this.billingService.updatePayment(id, body); }

  @Delete('payments/:id')
  deletePayment(@Param('id') id: string) { return this.billingService.deletePayment(id); }

  // Ledger
  @Get('ledger/:partyId')
  getLedger(@Param('partyId') partyId: string) { return this.billingService.getLedger(partyId); }

  @Get('ledger-by-name/:name')
  async getLedgerByName(@Param('name') name: string) {
    const party = await this.billingService.findOrCreatePartyByName(name);
    return this.billingService.getLedger(party.id);
  }
}
