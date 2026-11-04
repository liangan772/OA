import { Module } from '@nestjs/common';
import { BizController } from './biz.controller';
import { BizService } from './biz.service';

@Module({
  controllers: [BizController],
  providers: [BizService],
  exports: [BizService],
})
export class BizModule {}
