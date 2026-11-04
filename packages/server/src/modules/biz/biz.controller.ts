import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BizService } from './biz.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('biz')
@UseGuards(JwtAuthGuard)
export class BizController {
  constructor(private readonly biz: BizService) {}

  // 文档
  @Get('docs')
  docs(@CurrentUser('id') userId: string, @Query('keyword') keyword?: string) {
    return this.biz.docs(userId, keyword);
  }

  @Post('docs')
  createDoc(@CurrentUser('id') userId: string, @Body() dto: any) {
    return this.biz.createDoc(userId, dto);
  }

  @Get('docs/:id')
  docDetail(@Param('id') id: string) {
    return this.biz.docDetail(id);
  }

  @Patch('docs/:id')
  updateDoc(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() dto: any) {
    return this.biz.updateDoc(id, userId, dto);
  }

  @Post('docs/:id/flow')
  attachFlow(@Param('id') id: string, @Body('flowInstanceId') flowInstanceId: string) {
    return this.biz.attachFlow(id, flowInstanceId);
  }

  // 邮件
  @Get('mails')
  mails(@CurrentUser('id') userId: string, @Query('box') box?: string) {
    return box === 'sent' ? this.biz.sent(userId) : this.biz.inbox(userId);
  }

  @Post('mails')
  sendMail(@CurrentUser('id') userId: string, @Body() dto: any) {
    return this.biz.sendMail(userId, dto);
  }

  @Post('mails/:id/read')
  readMail(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.biz.readMail(userId, id);
  }

  // 收集表
  @Get('collects')
  collects(@CurrentUser('id') userId: string) {
    return this.biz.collects(userId);
  }

  @Post('collects')
  createCollect(@CurrentUser('id') userId: string, @Body() dto: any) {
    return this.biz.createCollect(userId, dto);
  }

  @Get('collects/:id')
  collectDetail(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.biz.collectDetail(id, userId);
  }

  @Post('collects/:id/response')
  submitResponse(@Param('id') id: string, @CurrentUser('id') userId: string, @Body('data') data: any) {
    return this.biz.submitResponse(id, userId, data);
  }

  @Post('collects/:id/close')
  closeCollect(@Param('id') id: string) {
    return this.biz.closeCollect(id);
  }

  // 人员选择器
  @Get('users')
  users() {
    return this.biz.users();
  }
}
