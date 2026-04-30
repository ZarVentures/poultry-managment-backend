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
import { CagesModule } from './cages/cages.module';
import { Cage } from './cages/cage.entity';
import { ExpensesModule } from './expenses/expenses.module';
import { Expense } from './expenses/expense.entity';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InventoryModule } from './inventory/inventory.module';
import { InventoryItem } from './inventory/entities/inventory-item.entity';
import { SettingsModule } from './settings/settings.module';
import { Settings } from './settings/settings.entity';
import { AuditModule } from './audit/audit.module';
import { AuditLog } from './audit/audit-log.entity';
import { GodownModule } from './godown/godown.module';
import { GodownInwardEntry } from './godown/godown-inward.entity';
import { GodownSale } from './godown/godown-sale.entity';
import { GodownMortality } from './godown/godown-mortality.entity';
import { GodownExpense } from './godown/godown-expense.entity';
import { PurchaseOrderPayment } from './purchases/entities/purchase-order-payment.entity';
import { PermissionsModule } from './permissions/permissions.module';
import { RolePermission } from './permissions/entities/role-permission.entity';
import { UserPermission } from './permissions/entities/user-permission.entity';
import { MortalityModule } from './mortality/mortality.module';
import { Mortality } from './mortality/mortality.entity';
import { ProductsModule } from './products/products.module';
import { Product } from './products/product.entity';

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
            entities: [User, Vehicle, Farmer, Retailer, PurchaseOrder, PurchaseOrderItem, PurchaseOrderPayment, Sale, SalePayment, Expense, InventoryItem, Settings, AuditLog, GodownInwardEntry, GodownSale, GodownMortality, GodownExpense, Cage, RolePermission, UserPermission, Mortality, Product],
            synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
            logging: config.get<boolean>('DB_LOGGING', false),
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
          entities: [User, Vehicle, Farmer, Retailer, PurchaseOrder, PurchaseOrderItem, PurchaseOrderPayment, Sale, SalePayment, Expense, InventoryItem, Settings, AuditLog, GodownInwardEntry, GodownSale, GodownMortality, GodownExpense, Cage, RolePermission, UserPermission, Mortality, Product],
          synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
          logging: config.get<boolean>('DB_LOGGING', false),
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
    ReportsModule,
    DashboardModule,
    InventoryModule,
    SettingsModule,
    AuditModule,
    GodownModule,
    PermissionsModule,
    CagesModule,
    MortalityModule,
    ProductsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}

