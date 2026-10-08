import { HttpException, Injectable } from '@nestjs/common';

@Injectable()
export class AuthRateLimitService {
  private readonly hits = new Map<string, number[]>();

  hit(key: string, limit: number, windowMs: number): void {
    const now = Date.now();
    const recent = (this.hits.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= limit) {
      throw new HttpException('Too many requests. Please try again later.', 429);
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) {
      const oldest = this.hits.keys().next().value;
      if (oldest) this.hits.delete(oldest);
    }
  }
}
