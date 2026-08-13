import { AccountingTransactionDTO } from './accounting.dto';
import { PAYMENT_METHODS, TransactionType, PaymentMethod, TRANSACTION_TYPES } from './accounting.constants';

export class AccountingMapper {
  private static mapPaymentMethod(method?: string): PaymentMethod {
    if (!method) return 'CASH';
    const m = method.toLowerCase().trim();
    if (m === 'cash') return 'CASH';
    if (m === 'bank_transfer' || m === 'bank') return 'BANK_TRANSFER';
    if (m === 'cheque' || m === 'check') return 'CHEQUE';
    if (m === 'credit_card' || m === 'card') return 'CREDIT_CARD';
    if (m === 'debit_card') return 'DEBIT_CARD';
    if (m === 'upi' || m === 'online' || m === 'gpay' || m === 'phonepe') return 'ONLINE';
    return 'OTHER';
  }

  static mapSaleToAccountingPayload(sale: any): AccountingTransactionDTO {
    const defaultPaymentMethod = sale.payments && sale.payments.length > 0 
      ? this.mapPaymentMethod(sale.payments[0].paymentMode) 
      : 'CASH';

    return {
      transactionId: `SALE-${sale.invoiceNumber || sale.id}`,
      transactionType: 'SALE',
      amount: Number(sale.netAmount || sale.totalAmount || 0),
      partyName: sale.customerName || 'Walk-in Customer',
      paymentMethod: defaultPaymentMethod,
      description: `Poultry Sale Invoice #${sale.invoiceNumber || sale.id} - ${sale.productType || 'eggs/meat'}`,
      notes: sale.notes || '',
      entryDate: sale.saleDate ? new Date(sale.saleDate).toISOString() : new Date().toISOString(),
      externalRef: String(sale.id),
      source: 'POULTRY_ERP',
    };
  }

  static mapPurchaseToAccountingPayload(purchase: any): AccountingTransactionDTO {
    const defaultPaymentMethod = purchase.payments && purchase.payments.length > 0 
      ? this.mapPaymentMethod(purchase.payments[0].paymentMode) 
      : 'CASH';

    return {
      transactionId: `PURCHASE-${purchase.orderNumber || purchase.id}`,
      transactionType: 'PURCHASE',
      amount: Number(purchase.netAmount || purchase.totalAmount || 0),
      partyName: purchase.supplierName || 'Supplier',
      paymentMethod: defaultPaymentMethod,
      description: `Poultry Purchase Order #${purchase.orderNumber || purchase.id}`,
      notes: purchase.notes || '',
      entryDate: purchase.orderDate ? new Date(purchase.orderDate).toISOString() : new Date().toISOString(),
      externalRef: String(purchase.id),
      source: 'POULTRY_ERP',
    };
  }

  static mapExpenseToAccountingPayload(expense: any): AccountingTransactionDTO {
    return {
      transactionId: `EXPENSE-${expense.id}`,
      transactionType: 'EXPENSE',
      amount: Number(expense.amount || 0),
      partyName: expense.expenseOwner || expense.expenseCategory?.name || 'Various Operations',
      paymentMethod: this.mapPaymentMethod(expense.paymentMethod),
      description: `Business Expense: ${expense.description || expense.category || 'General'}`,
      notes: expense.notes || '',
      entryDate: expense.expenseDate ? new Date(expense.expenseDate).toISOString() : new Date().toISOString(),
      externalRef: String(expense.id),
      source: 'POULTRY_ERP',
    };
  }

  static mapPaymentToAccountingPayload(voucher: any): AccountingTransactionDTO {
    return {
      transactionId: `PAYMENT-${voucher.voucherNumber || voucher.id}`,
      transactionType: 'PAYMENT',
      amount: Number(voucher.amount || 0),
      partyName: voucher.payeeName || 'Payee',
      paymentMethod: this.mapPaymentMethod(voucher.paymentMethod),
      description: `Payment Voucher: ${voucher.purpose || 'Vendor Payment'}`,
      notes: voucher.notes || '',
      entryDate: voucher.paidDate || voucher.voucherDate 
        ? new Date(voucher.paidDate || voucher.voucherDate).toISOString() 
        : new Date().toISOString(),
      externalRef: String(voucher.id),
      source: 'POULTRY_ERP',
    };
  }

  static mapReceiptToAccountingPayload(payment: any, customerName?: string): AccountingTransactionDTO {
    return {
      transactionId: `RECEIPT-${payment.id}`,
      transactionType: 'RECEIPT',
      amount: Number(payment.amount || 0),
      partyName: customerName || 'Retail Customer',
      paymentMethod: this.mapPaymentMethod(payment.paymentMode),
      description: `Payment receipt against sale ID: ${payment.saleId || 'N/A'}`,
      notes: `Invoice payment details`,
      entryDate: payment.createdAt ? new Date(payment.createdAt).toISOString() : new Date().toISOString(),
      externalRef: String(payment.id),
      source: 'POULTRY_ERP',
    };
  }
}
