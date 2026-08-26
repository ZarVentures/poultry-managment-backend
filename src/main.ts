import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('API_PREFIX', 'api');
  const port = config.get<number>('PORT', 3001);
  const nodeEnv = config.get<string>('NODE_ENV', 'development');

  app.setGlobalPrefix(apiPrefix);

  app.enableCors({
    origin: true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
  });

  // Fallback: ensure CORS headers are present even for error paths or upstream responses
  app.use((req: { headers: { origin: string; }; method: string; }, res: { setHeader: (arg0: string, arg1: string) => void; statusCode: number; end: () => any; }, next: () => any) => {
    const origin = req.headers.origin || '*';
    try {
      res.setHeader('Access-Control-Allow-Origin', origin as string);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    } catch (err) {
      // ignore header set errors
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }
    return next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Serve uploaded files statically
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // Swagger — staging only
  if (nodeEnv === 'staging' || nodeEnv === 'development') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Aziz Poultry Management API')
      .setDescription(
        '## Poultry Business Management System — REST API\n\n' +
        'Multi-tenant API for managing poultry trading operations: sales, purchases, ' +
        'godown inventory, expenses, billing, mortality, farmer/retailer management, ' +
        'reports, and accounting integration.\n\n' +
        '---\n\n' +
        '### Authentication\n' +
        '1. `POST /auth/register/send-otp` → send OTP to phone\n' +
        '2. `POST /auth/register/verify-otp` → verify OTP & create account\n' +
        '3. `POST /auth/login/send-otp` → send OTP for login\n' +
        '4. `POST /auth/login/verify-otp` → verify OTP & receive JWT\n' +
        '5. Click **Authorize** (top right) → paste the `accessToken`\n\n' +
        '### Multi-Tenancy\n' +
        'Every request is scoped to the authenticated user\'s tenant (business/shop). ' +
        'Cross-tenant access returns `404`. Child records (payments, items) inherit the parent\'s tenant automatically.\n\n' +
        '### Roles\n' +
        '`admin` · `manager` · `staff` — permissions are per-resource, per-tenant via `role_permissions`.\n\n' +
        '---\n\n' +
        '**Local:** `http://localhost:3001/api/v1`  \n' +
        '**Staging:** `https://13.234.140.190.nip.io/api/v1`'
      )
      .setVersion('2.0.0')
      .setContact('Aziz Poultry', '', 'dev@poultrysathi.com')
      .setLicense('Proprietary', '')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Paste the accessToken from login response' },
        'jwt-auth',
      )
      .addTag('Auth', 'Registration, login (OTP-based), profile, 2FA')
      .addTag('Tenants', 'Business/shop creation and management')
      .addTag('Dashboard', 'Aggregated KPIs, stats, and charts')
      .addTag('Sales', 'Sale records, invoices, and payments')
      .addTag('Bird Returns', 'Bird return tracking and processing')
      .addTag('Vehicle Bird Returns', 'Vehicle bird return tracking and processing')
      .addTag('Purchases', 'Purchase orders, items, and payments')
      .addTag('Godown', 'Godown inward entries, sales, mortality, and expenses')
      .addTag('Expenses', 'Expense tracking and categorisation')
      .addTag('Expense Categories', 'Manage expense categories (tenant-scoped)')
      .addTag('Farmers', 'Farmer (supplier) directory')
      .addTag('Retailers', 'Retailer (customer) directory')
      .addTag('Vehicles', 'Vehicle fleet management')
      .addTag('Products', 'Product catalogue')
      .addTag('Cages', 'Cage inventory and tracking')
      .addTag('Inventory', 'Inventory items and stock management')
      .addTag('Mortality', 'Mortality / death record tracking')
      .addTag('Billing', 'Party-wise billing ledger and transactions')
      .addTag('Payment Vouchers', 'Payment voucher creation and tracking')
      .addTag('Reports', 'Sales, purchase, profit-loss, and breakdown reports')
      .addTag('Settings', 'Per-tenant application settings')
      .addTag('Users', 'User management (admin)')
      .addTag('Permissions', 'Role-based permission management')
      .addTag('Accounting', 'External accounting integration and failed job retry')
      .addTag('Notifications', 'Email and SMS notification logs')
      .addTag('Audit', 'Audit trail and activity logs')
      .addTag('Health', 'Server health check')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      operationIdFactory: (_controllerKey, methodKey) => methodKey,
    });
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customSiteTitle: 'Aziz Poultry API Docs',
      customfavIcon: 'https://nestjs.com/img/logo_text.svg',
      customCss: '.swagger-ui .topbar { display: none } .swagger-ui .info .title { font-size: 1.5em }',
    });

    console.log(`Swagger docs available at http://localhost:${port}/${apiPrefix}/docs`);
  }

  await app.listen(port);
  console.log(`Poultry backend is running on http://localhost:${port}/${apiPrefix}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start NestJS application', err);
  process.exit(1);
});

