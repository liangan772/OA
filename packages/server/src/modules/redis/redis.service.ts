import { ConflictException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

/**
 * Redis 承担三件事：
 *  1. 流程推进互斥锁 —— 防止并发重复推进同一实例
 *  2. 登录失败计数 —— 防爆破
 *  3. 待办计数缓存 —— 工作台角标
 * Redis 不可用时全部降级为「无缓存直通」，不阻断主流程。
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Redis');
  private client: Redis | null = null;
  private available = false;

  get isAvailable() {
    return this.available;
  }

  async onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.warn('未配置 REDIS_URL，缓存与分布式锁降级为直通模式');
      return;
    }

    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 2000)),
    });

    this.client.on('error', () => {
      if (this.available) this.logger.warn('Redis 连接中断，已降级');
      this.available = false;
    });
    this.client.on('ready', () => {
      this.available = true;
      this.logger.log('Redis 已连接');
    });

    try {
      await this.client.connect();
      await this.client.ping();
      this.available = true;
    } catch {
      this.available = false;
      this.logger.warn('Redis 不可用，已降级为直通模式');
    }
  }

  async onModuleDestroy() {
    try {
      await this.client?.quit();
    } catch {
      /* ignore */
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.available) return null;
    try {
      return await this.client!.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (!this.available) return;
    try {
      if (ttlSeconds) await this.client!.set(key, value, 'EX', ttlSeconds);
      else await this.client!.set(key, value);
    } catch {
      /* ignore */
    }
  }

  async del(key: string) {
    if (!this.available) return;
    try {
      await this.client!.del(key);
    } catch {
      /* ignore */
    }
  }

  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    if (!this.available) return 0;
    try {
      const n = await this.client!.incr(key);
      if (n === 1) await this.client!.expire(key, ttlSeconds);
      return n;
    } catch {
      return 0;
    }
  }

  /** 分布式锁：拿不到锁说明另一个请求正在推进同一实例 */
  async withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    if (!this.available) return fn();

    const token = randomUUID();
    let acquired = false;
    try {
      const res = await this.client!.set(key, token, 'PX', ttlMs, 'NX');
      acquired = res === 'OK';
    } catch {
      return fn();
    }
    if (!acquired) {
      throw new ConflictException('该流程正在处理中，请稍后刷新重试');
    }

    try {
      return await fn();
    } finally {
      try {
        const script =
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
        await this.client!.eval(script, 1, key, token);
      } catch {
        /* 锁过期自动释放 */
      }
    }
  }

  async health(): Promise<{ ok: boolean; latencyMs?: number }> {
    if (!this.available) return { ok: false };
    const start = Date.now();
    try {
      await this.client!.ping();
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false };
    }
  }
}
