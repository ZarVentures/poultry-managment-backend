import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as jwt from 'jsonwebtoken';
import { AccountingLogger } from './accounting.logger';

@Injectable()
export class AccountingClient {
  private client: AxiosInstance;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AccountingLogger,
  ) {
    const baseURL = this.configService.get<string>('ACCOUNTING_API_URL') || 'http://localhost:3000/api/v1';
    const timeout = Number(this.configService.get<number>('ACCOUNTING_TIMEOUT') || 10000);

    this.client = axios.create({
      baseURL,
      timeout,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request Interceptor: Inject JWT and API Key
    this.client.interceptors.request.use(
      (config) => {
        const apiKey = this.configService.get<string>('ACCOUNTING_API_KEY');
        if (apiKey) {
          config.headers['x-api-key'] = apiKey;
        }

        // Generate a Service-to-Service JWT
        // Accounting microservice expects JWT signed with shared JWT_SECRET
        const jwtSecret = this.configService.get<string>('ACCOUNTING_JWT_SECRET') || 
                          this.configService.get<string>('JWT_SECRET') || 
                          'staging-jwt-secret-change-this';
        
        // Sign token as a SUPER_ADMIN system user to satisfy microservice's role validation
        const token = jwt.sign(
          {
            userId: 'poultry_erp_system',
            email: 'system@poultry-erp.com',
            role: 'SUPER_ADMIN',
          },
          jwtSecret,
          { expiresIn: '15m' } // Short-lived token
        );

        config.headers['Authorization'] = `Bearer ${token}`;

        this.logger.logApiRequest(config.method?.toUpperCase() || 'POST', config.url || '', config.data);
        return config;
      },
      (error) => {
        this.logger.error(`API Request Interceptor Error: ${error.message}`);
        return Promise.reject(error);
      }
    );

    // Response Interceptor: Log responses
    this.client.interceptors.response.use(
      (response) => {
        this.logger.logApiResponse(
          response.config.method?.toUpperCase() || 'POST',
          response.config.url || '',
          response.status,
          response.data
        );
        return response;
      },
      (error) => {
        const status = error.response ? error.response.status : 'NETWORK_ERROR';
        const data = error.response ? error.response.data : error.message;
        
        this.logger.error(
          `[API Response Error] ${error.config?.method?.toUpperCase() || 'POST'} ${error.config?.url || ''} | Status: ${status} | Error: ${JSON.stringify(data)}`
        );
        return Promise.reject(error);
      }
    );
  }

  getAxiosInstance(): AxiosInstance {
    return this.client;
  }
}
