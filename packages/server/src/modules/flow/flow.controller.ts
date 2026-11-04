import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { FlowService } from './flow.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('flow')
@UseGuards(JwtAuthGuard)
export class FlowController {
  constructor(private readonly flow: FlowService) {}

  @Get('definitions')
  definitions(@Query('type') type?: string) {
    return this.flow.definitions(type);
  }

  @Get('nodes')
  nodes() {
    return this.flow.nodeDefinitions();
  }

  @Get('templates')
  templates() {
    return this.flow.contentTemplates();
  }

  @Post('templates')
  saveTemplate(@Body() dto: any) {
    return this.flow.saveContentTemplate(dto);
  }

  @Get('definitions/:id')
  definition(@Param('id') id: string) {
    return this.flow.definition(id);
  }

  @Post('definitions')
  saveDefinition(@Body() dto: any) {
    return this.flow.saveDefinition(dto);
  }

  @Post('start')
  start(@CurrentUser('id') userId: string, @Body() dto: any) {
    return this.flow.start(userId, dto);
  }

  @Get('todo')
  todo(@CurrentUser('id') userId: string) {
    return this.flow.todo(userId);
  }

  @Get('done')
  done(@CurrentUser('id') userId: string) {
    return this.flow.done(userId);
  }

  @Get('mine')
  mine(@CurrentUser('id') userId: string) {
    return this.flow.myInstances(userId);
  }

  @Get('instances/:id')
  detail(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.flow.detail(id, userId);
  }

  @Post('tasks/:id/complete')
  complete(@Param('id') taskId: string, @CurrentUser('id') userId: string, @Body() input: any) {
    return this.flow.complete(taskId, userId, input);
  }
}
