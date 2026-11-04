import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * 后台管理守卫：必须已通过 JwtAuthGuard，且角色为 ADMIN。
 * 后台路由不出现在前台任何菜单里，只能通过 /admin 直接进入。
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('仅管理员可访问后台');
    }
    return true;
  }
}
