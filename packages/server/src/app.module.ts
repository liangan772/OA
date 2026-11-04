import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrgModule } from './modules/org/org.module';
import { FlowModule } from './modules/flow/flow.module';
import { BizModule } from './modules/biz/biz.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthController } from './modules/health/health.controller';
import { BootstrapSeedService } from './common/bootstrap-seed.service';

@Module({
  imports: [PrismaModule, RedisModule, AuthModule, OrgModule, FlowModule, BizModule, AdminModule],
  controllers: [HealthController],
  providers: [BootstrapSeedService],
})
export class AppModule {}
