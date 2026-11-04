import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.module';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(account: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { account } });
    if (!user) throw new UnauthorizedException('账号或密码错误');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('账号已停用');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('账号或密码错误');

    const token = await this.jwt.signAsync({ sub: user.id, account: user.account });
    return { token, user: await this.profile(user.id) };
  }

  /** 用户档案 + 其全部任职（编制位 → 组织），前端据此决定可见范围与表态身份 */
  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        posts: {
          where: { endAt: null },
          include: { position: { include: { org: true } } },
        },
      },
    });
    if (!user) throw new UnauthorizedException('用户不存在');

    const posts = user.posts.map((p) => ({
      postId: p.id,
      positionId: p.positionId,
      positionCode: p.position.code,
      positionName: p.position.name,
      isLeader: p.position.isLeader,
      isDeputy: p.position.isDeputy,
      isPrimary: p.isPrimary,
      orgId: p.position.orgId,
      orgName: p.position.org.name,
      orgType: p.position.org.type,
      orgPath: p.position.org.path,
      rootUnitId: p.position.org.rootUnitId,
    }));

    const primary = posts.find((p) => p.isPrimary) || posts[0] || null;

    return {
      id: user.id,
      account: user.account,
      name: user.name,
      phone: user.phone,
      title: user.title,
      role: user.role,
      isAdmin: user.role === 'ADMIN',
      posts,
      primaryOrgId: primary?.orgId ?? null,
      primaryOrgName: primary?.orgName ?? null,
      rootUnitId: primary?.rootUnitId ?? null,
      isLeader: posts.some((p) => p.isLeader),
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('新密码至少 6 位');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('原密码不正确');
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    return { success: true };
  }
}
