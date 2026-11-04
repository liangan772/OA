import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('grants')
  grants() {
    return this.admin.grants();
  }

  @Post('grants')
  createGrant(@CurrentUser('id') userId: string, @Body() dto: any) {
    return this.admin.createGrant({ ...dto, grantedBy: userId });
  }

  @Post('grants/:id/revoke')
  revokeGrant(@Param('id') id: string) {
    return this.admin.revokeGrant(id);
  }

  @Delete('grants/:id')
  deleteGrant(@Param('id') id: string) {
    return this.admin.deleteGrant(id);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string) {
    return this.admin.deleteTemplate(id);
  }

  @Get('users')
  users() {
    return this.admin.users();
  }

  @Patch('users/:id/role')
  setRole(@Param('id') id: string, @Body('role') role: string) {
    return this.admin.setRole(id, role);
  }
}
