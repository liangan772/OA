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

  /** 个人资料修改：只允许改姓名、手机号、职务；账号与角色不可自改 */
  async updateProfile(userId: string, dto: { name?: string; phone?: string; title?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('用户不存在');

    const data: Record<string, any> = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('姓名不能为空');
      if (name.length > 32) throw new BadRequestException('姓名过长');
      data.name = name;
    }
    if (dto.phone !== undefined) {
      const phone = dto.phone.trim();
      if (phone && !/^[0-9+\-\s()]{5,20}$/.test(phone)) {
        throw new BadRequestException('手机号格式不正确');
      }
      data.phone = phone || null;
    }
    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (title.length > 32) throw new BadRequestException('职务过长');
      data.title = title || null;
    }

    if (!Object.keys(data).length) throw new BadRequestException('没有需要更新的内容');

    await this.prisma.user.update({ where: { id: userId }, data });
    return this.profile(userId);
  }
}
