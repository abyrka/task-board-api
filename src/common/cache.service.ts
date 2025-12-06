import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class CacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  /**
   * Get a cached value by key
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.redisClient.status !== 'ready') {
        return null;
      }
      const cached = await this.redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      // ignore cache errors
      return null;
    }
  }

  /**
   * Set a cached value with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    try {
      if (this.redisClient.status !== 'ready') {
        return;
      }
      await this.redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (e) {
      // ignore cache errors
    }
  }

  /**
   * Delete one or more keys
   */
  async del(...keys: string[]): Promise<void> {
    try {
      if (this.redisClient.status !== 'ready') {
        return;
      }
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
      }
    } catch (e) {
      // ignore cache errors
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  async flushAll(): Promise<void> {
    try {
      if (this.redisClient.status !== 'ready') {
        return;
      }
      await this.redisClient.flushall();
    } catch (e) {
      // ignore cache errors
    }
  }
}
