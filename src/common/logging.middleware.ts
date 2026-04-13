import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, body, query, headers } = req;
    const start = Date.now();
    const userAgent = headers['user-agent'] || '';
    const ip = req.ip || req.socket?.remoteAddress || '';

    // Log incoming request
    this.logger.log(
      `→ ${method} ${originalUrl} | IP: ${ip} | UA: ${userAgent.substring(0, 60)}`,
    );

    // Log request body for mutating requests (skip auth passwords)
    if (['POST', 'PUT', 'PATCH'].includes(method) && body && Object.keys(body).length > 0) {
      const safeBody = { ...body };
      if (safeBody.password) safeBody.password = '***';
      if (safeBody.currentPassword) safeBody.currentPassword = '***';
      if (safeBody.newPassword) safeBody.newPassword = '***';
      this.logger.log(`  BODY: ${JSON.stringify(safeBody)}`);
    }

    if (query && Object.keys(query).length > 0) {
      this.logger.log(`  QUERY: ${JSON.stringify(query)}`);
    }

    // Capture response
    const originalSend = res.send.bind(res);
    res.send = (responseBody: any) => {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      const statusEmoji = statusCode >= 500 ? '🔴' : statusCode >= 400 ? '🟡' : '🟢';

      this.logger.log(
        `← ${statusEmoji} ${method} ${originalUrl} | ${statusCode} | ${duration}ms`,
      );

      // Log response body for errors or small responses
      if (statusCode >= 400) {
        try {
          const parsed = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody;
          this.logger.warn(`  ERROR RESPONSE: ${JSON.stringify(parsed)}`);
        } catch {
          this.logger.warn(`  ERROR RESPONSE: ${responseBody}`);
        }
      } else if (['POST', 'PUT', 'PATCH'].includes(method) && statusCode < 300) {
        try {
          const parsed = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody;
          // Only log first 500 chars to avoid huge logs
          const preview = JSON.stringify(parsed).substring(0, 500);
          this.logger.log(`  RESPONSE: ${preview}${preview.length >= 500 ? '...' : ''}`);
        } catch {
          // ignore
        }
      }

      return originalSend(responseBody);
    };

    next();
  }
}
