import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    let db = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    const r = await this.redis.health();

    return {
      status: db ? 'ok' : 'degraded',
      db,
      redis: r.ok,
      redisLatencyMs: r.latencyMs ?? null,
      time: new Date().toISOString(),
    };
  }
}
