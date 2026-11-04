import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';

/** 按服务器本地时区取日期键，避免 toISOString 的 UTC 偏移导致日期错一天 */
const localDay = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** 后台概览：规模、待办、近 7 天发起趋势 */
  async overview() {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const [
      users,
      orgs,
      positions,
      definitions,
      templates,
      instances,
      pendingTasks,
      documents,
      mails,
      collects,
      byStatus,
      recentInstances,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.org.count({ where: { status: 'ACTIVE' } }),
      this.prisma.position.count({ where: { status: 'ACTIVE' } }),
      this.prisma.flowDefinition.count(),
      this.prisma.contentTemplate.count(),
      this.prisma.flowInstance.count(),
      this.prisma.task.count({ where: { status: 'PENDING' } }),
      this.prisma.document.count(),
      this.prisma.mail.count(),
      this.prisma.collectForm.count(),
      this.prisma.flowInstance.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.flowInstance.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
    ]);

    const buckets = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      buckets.set(localDay(d), 0);
    }
    recentInstances.forEach((it) => {
      const key = localDay(it.createdAt);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
    });

    return {
      counts: { users, orgs, positions, definitions, templates, instances, pendingTasks, documents, mails, collects },
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      trend: Array.from(buckets.entries()).map(([date, count]) => ({ date, count })),
    };
  }

  // ---------------- 跨单位授权 ----------------

  async grants() {
    const list = await this.prisma.crossUnitGrant.findMany({ orderBy: { createdAt: 'desc' } });
    const orgIds = Array.from(new Set(list.flatMap((g) => [g.grantorOrgId, g.granteeOrgId])));
    const orgs = await this.prisma.org.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true },
    });
    const map = new Map(orgs.map((o) => [o.id, o.name]));
    return list.map((g) => ({
      ...g,
      grantorName: map.get(g.grantorOrgId) || '',
      granteeName: map.get(g.granteeOrgId) || '',
    }));
  }

  async createGrant(dto: {
    grantorOrgId: string;
    granteeOrgId: string;
    scope?: string;
    remark?: string;
    expireAt?: string;
    grantedBy?: string;
  }) {
    if (!dto.grantorOrgId || !dto.granteeOrgId) throw new BadRequestException('授权方与受权方必填');
    if (dto.grantorOrgId === dto.granteeOrgId) throw new BadRequestException('不能给自己授权');

    const exists = await this.prisma.crossUnitGrant.findFirst({
      where: { grantorOrgId: dto.grantorOrgId, granteeOrgId: dto.granteeOrgId, status: 'ACTIVE' },
    });
    if (exists) throw new BadRequestException('该方向已存在有效授权');

    return this.prisma.crossUnitGrant.create({
      data: {
        grantorOrgId: dto.grantorOrgId,
        granteeOrgId: dto.granteeOrgId,
        scope: dto.scope || 'FLOW',
        remark: dto.remark,
        expireAt: dto.expireAt ? new Date(dto.expireAt) : null,
        grantedBy: dto.grantedBy,
      },
    });
  }

  async revokeGrant(id: string) {
    const g = await this.prisma.crossUnitGrant.findUnique({ where: { id } });
    if (!g) throw new NotFoundException('授权不存在');
    await this.prisma.crossUnitGrant.update({ where: { id }, data: { status: 'REVOKED' } });
    return { success: true };
  }

  async deleteGrant(id: string) {
    await this.prisma.crossUnitGrant.delete({ where: { id } });
    return { success: true };
  }

  // ---------------- 内容模板 ----------------

  async deleteTemplate(id: string) {
    const used = await this.prisma.flowDefinition.count({ where: { contentTemplateId: id } });
    if (used > 0) throw new BadRequestException(`该模板已被 ${used} 个流程引用，无法删除`);
    await this.prisma.contentTemplate.delete({ where: { id } });
    return { success: true };
  }

  // ---------------- 人员与角色 ----------------

  async users() {
    const list = await this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    const posts = await this.prisma.post.findMany({
      where: { endAt: null },
      include: { position: { include: { org: true } } },
    });
    const byUser = new Map<string, string[]>();
    posts.forEach((p) => {
      const arr = byUser.get(p.userId) || [];
      arr.push(`${p.position.org.name} · ${p.position.name}`);
      byUser.set(p.userId, arr);
    });

    return list.map((u) => ({
      id: u.id,
      account: u.account,
      name: u.name,
      phone: u.phone,
      title: u.title,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      posts: byUser.get(u.id) || [],
    }));
  }

  async setRole(id: string, role: string) {
    if (!['USER', 'ADMIN'].includes(role)) throw new BadRequestException('角色只能是 USER 或 ADMIN');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    const admins = await this.prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
    if (user.role === 'ADMIN' && role !== 'ADMIN' && admins <= 1) {
      throw new BadRequestException('至少保留一名管理员');
    }
    return this.prisma.user.update({ where: { id }, data: { role }, select: { id: true, role: true } });
  }
}
