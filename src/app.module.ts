import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggingMiddleware } from './common/logging.middleware';
import { VehiclesModule } from './vehicles/vehicles.module';
import { Vehicle } from './vehicles/vehicle.entity';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { User } from './users/user.entity';
import { AuthModule } from './auth/auth.module';
import { OtpSession } from './auth/otp.entity';
import { FarmersModule } from './farmers/farmers.module';
import { Farmer } from './farmers/farmer.entity';
import { RetailersModule } from './retailers/retailers.module';
import { Retailer } from './retailers/retailer.entity';
import { PurchasesModule } from './purchases/purchases.module';
import { PurchaseOrder } from './purchases/entities/purchase-order.entity';
import { PurchaseOrderItem } from './purchases/entities/purchase-order-item.entity';
import { SalesModule } from './sales/sales.module';
import { Sale } from './sales/sale.entity';
import { SalePayment } from './sales/sale-payment.entity';
import { BirdReturn } from './sales/entities/bird-return.entity';
import { VehicleBirdReturn } from './sales/entities/vehicle-bird-return.entity';
import { BillingModule } from './billing/billing.module';
import { BillingParty } from './billing/entities/billing-party.entity';
import { BillingSale } from './billing/entities/billing-sale.entity';
import { BillingPayment } from './billing/entities/billing-payment.entity';
import { BillingLedger } from './billing/entities/billing-ledger.entity';
import { CagesModule } from './cages/cages.module';
import { Cage } from './cages/cage.entity';
import { ExpensesModule } from './expenses/expenses.module';
import { Expense } from './expenses/expense.entity';
import { ExpenseCategoriesModule } from './expense-categories/expense-categories.module';
import { ExpenseCategory } from './expense-categories/expense-category.entity';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InventoryModule } from './inventory/inventory.module';
import { InventoryItem } from './inventory/entities/inventory-item.entity';
import { SettingsModule } from './settings/settings.module';
import { Settings } from './settings/settings.entity';
import { AuditModule } from './audit/audit.module';
import { AuditLog } from './audit/audit-log.entity';
import { GodownModule } from './godown/godown.module';
import { GodownMaster } from './godown/godown-master.entity';
import { GodownInwardEntry } from './godown/godown-inward.entity';
import { GodownSale } from './godown/entities/godown-sale.entity';
import { GodownSalePayment } from './godown/entities/godown-sale-payment.entity';
import { GodownMortality } from './godown/godown-mortality.entity';
import { GodownExpense } from './godown/godown-expense.entity';
import { PurchaseOrderPayment } from './purchases/entities/purchase-order-payment.entity';
import { PermissionsModule } from './permissions/permissions.module';
import { RolePermission } from './permissions/entities/role-permission.entity';
import { UserPermission } from './permissions/entities/user-permission.entity';
import { MortalityModule } from './mortality/mortality.module';
import { Mortality } from './mortality/mortality.entity';
import { ProductsModule } from './products/products.module';
import { PaymentVouchersModule } from './payment-vouchers/payment-vouchers.module';
import { PaymentVoucher } from './payment-vouchers/payment-voucher.entity';
import { Product } from './products/product.entity';
import { NotificationsModule } from './notifications/notifications.module';
import { CommunicationLog } from './notifications/communication-log.entity';
import { AccountingModule } from './modules/accounting/accounting.module';
import { FailedAccountingJob } from './modules/accounting/failed-jobs.entity';
import { TenantsModule } from './tenants/tenants.module';
import { Tenant } from './tenants/tenant.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Support DATABASE_URL for Render deployment (single connection string)
        const databaseUrl = config.get<string>('DATABASE_URL');
        
        if (databaseUrl) {
          return {
            type: 'postgres' as const,
            url: databaseUrl,
            ssl: {
              rejectUnauthorized: false
            },
            entities: [User, Vehicle, Farmer, Retailer, PurchaseOrder, PurchaseOrderItem, PurchaseOrderPayment, Sale, SalePayment, BirdReturn, VehicleBirdReturn, Expense, ExpenseCategory, InventoryItem, Settings, AuditLog, GodownMaster, GodownInwardEntry, GodownSale, GodownSalePayment, GodownMortality, GodownExpense, Cage, RolePermission, UserPermission, Mortality, Product, BillingParty, BillingSale, BillingPayment, BillingLedger, PaymentVoucher, CommunicationLog, FailedAccountingJob, OtpSession, Tenant],
            // entities: [User, Vehicle, Farmer, Retailer, PurchaseOrder, PurchaseOrderItem, PurchaseOrderPayment, Sale, SalePayment, Expense, ExpenseCategory, InventoryItem, Settings, AuditLog, GodownInwardEntry, GodownSale, GodownSalePayment, GodownMortality, GodownExpense, Cage, RolePermission, UserPermission, Mortality, Product, BillingParty, BillingSale, BillingPayment, BillingLedger, PaymentVoucher, FailedAccountingJob],
            synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
            logging: config.get<boolean>('DB_LOGGING', false),
            timezone: 'Z', // Use UTC for consistency, handle IST in application layer
          };
        }

        // Fallback to individual environment variables
        return {
          type: config.get<'postgres'>('DB_TYPE', 'postgres'),
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5432),
          username: config.get<string>('DB_USERNAME', 'postgres'),
          password: config.get<string>('DB_PASSWORD', 'postgres'),
          database: config.get<string>('DB_NAME', 'poultry'),
          entities: [User, Vehicle, Farmer, Retailer, PurchaseOrder, PurchaseOrderItem, PurchaseOrderPayment, Sale, SalePayment, BirdReturn, VehicleBirdReturn, Expense, ExpenseCategory, InventoryItem, Settings, AuditLog, GodownMaster, GodownInwardEntry, GodownSale, GodownSalePayment, GodownMortality, GodownExpense, Cage, RolePermission, UserPermission, Mortality, Product, BillingParty, BillingSale, BillingPayment, BillingLedger, PaymentVoucher, CommunicationLog, FailedAccountingJob, OtpSession, Tenant],
          synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
          logging: config.get<boolean>('DB_LOGGING', false),
          timezone: 'Z', // Use UTC for consistency, handle IST in application layer
        };
      },
    }),
    VehiclesModule,
    HealthModule,
    UsersModule,
    AuthModule,
    FarmersModule,
    RetailersModule,
    PurchasesModule,
    SalesModule,
    ExpensesModule,
    ExpenseCategoriesModule,
    ReportsModule,
    DashboardModule,
    InventoryModule,
    SettingsModule,
    AuditModule,
    GodownModule,
    PermissionsModule,
    CagesModule,
    BillingModule,
    MortalityModule,
    ProductsModule,
    PaymentVouchersModule,
    NotificationsModule,
    AccountingModule,
    TenantsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}

