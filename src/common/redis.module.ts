import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { CacheService } from './cache.service';

const redisFactory = () => {
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on('error', (err) => {
    console.warn('Redis connection error (running without cache):', err.message);
  });

  client.connect().catch(() => {
    console.warn('Redis unavailable - running without cache');
  });

  return client;
};

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: redisFactory,
    },
    CacheService,
  ],
  exports: [REDIS_CLIENT, CacheService],
})
export class RedisModule {}
