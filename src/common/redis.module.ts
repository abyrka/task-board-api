import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { CacheService } from './cache.service';

const redisFactory = () => {
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  return new Redis(url);
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

