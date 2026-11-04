import { Module } from '@nestjs/common';
import { FlowController } from './flow.controller';
import { FlowService } from './flow.service';
import { FlowEngineService } from './engine/engine.service';
import { AssigneeResolver } from './engine/assignee.resolver';

@Module({
  controllers: [FlowController],
  providers: [FlowService, FlowEngineService, AssigneeResolver],
  exports: [FlowService, FlowEngineService, AssigneeResolver],
})
export class FlowModule {}
