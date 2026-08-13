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
      .setTitle('Aziz Poultry API')
      .setDescription(
        '## Staging Developer Portal\n\n' +
        'Interactive API documentation for the Aziz Poultry Management System.\n\n' +
        '**How to use:**\n' +
        '1. Click `POST /auth/login` → Try it out → Execute with your credentials\n' +
        '2. Copy the `access_token` from the response\n' +
        '3. Click the **Authorize** button (top right) → paste the token\n' +
        '4. All subsequent requests will be authenticated\n\n' +
        '**Base URL:** `https://13.234.140.190.nip.io/staging/api/v1`'
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
      },
      customSiteTitle: 'Aziz Poultry API Docs',
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

