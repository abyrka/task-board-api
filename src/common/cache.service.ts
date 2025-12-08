import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

const REDIS_STATUS_READY = 'ready';

@Injectable()
export class CacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  /**
   * Get a cached value by key
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.redisClient.status !== REDIS_STATUS_READY) {
        return null;
      }
      const cached = await this.redisClient.get(key);
      if (cached) {
        console.log(`[Cache HIT] ${key}`);
        return JSON.parse(cached);
      }
      return null;
    } catch (e) {
      console.warn(`[Cache ERROR on GET] ${key}:`, (e as Error).message);
      return null;
    }
  }

  /**
   * Set a cached value with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    try {
      if (this.redisClient.status !== REDIS_STATUS_READY) {
        return;
      }
      await this.redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      console.log(`[Cache SET] ${key} (TTL: ${ttlSeconds}s)`);
    } catch (e) {
      console.warn(`[Cache ERROR on SET] ${key}:`, (e as Error).message);
    }
  }

  /**
   * Delete one or more keys
   */
  async del(...keys: string[]): Promise<void> {
    try {
      if (this.redisClient.status !== REDIS_STATUS_READY) {
        return;
      }
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
        console.log(`[Cache DEL] ${keys.join(', ')}`);
      }
    } catch (e) {
      console.warn(`[Cache ERROR on DEL]:`, (e as Error).message);
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  async flushAll(): Promise<void> {
    try {
      if (this.redisClient.status !== REDIS_STATUS_READY) {
        return;
      }
      await this.redisClient.flushall();
      console.log('[Cache FLUSHALL]');
    } catch (e) {
      console.warn(`[Cache ERROR on FLUSHALL]:`, (e as Error).message);
    }
  }
}
