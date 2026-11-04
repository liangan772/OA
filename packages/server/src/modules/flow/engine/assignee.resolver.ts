import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.module';

export interface Assignee {
  userId: string;
  orgId: string;
  positionId: string;
  isLeader: boolean;
  name?: string;
}

/**
 * 编制规则解析器：把「谁该表态/谁该执行」从配置翻译成具体人员。
 * 所有节点共用，是「统一编制底座」落到流程上的唯一入口。
 */
@Injectable()
export class AssigneeResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(rule: string, config: any, orgId: string): Promise<Assignee[]> {
    switch (rule) {
      case 'DEPT_MEMBERS':
        return this.ofOrgTree(orgId, false);
      case 'DEPT_LEADER':
        return this.leadersOf(orgId);
      case 'SUPERIOR_LEADER': {
        const parentId = await this.parentOrgId(orgId);
        return parentId ? this.leadersOf(parentId) : [];
      }
      case 'POSITION':
        return this.byPositions(config?.positionIds || []);
      case 'USER':
        return this.byUsers(config?.userIds || []);
      case 'CROSS_UNIT':
        return this.byOrgs(config?.orgIds || []);
      case 'DEPT_ALL':
      default:
        return this.ofOrgTree(orgId, true);
    }
  }

  /** 指定组织及其所有下级组织的在编人员 */
  private async ofOrgTree(orgId: string, includeLeader: boolean): Promise<Assignee[]> {
    const org = await this.prisma.org.findUnique({ where: { id: orgId } });
    if (!org) return [];

    const orgs = await this.prisma.org.findMany({
      where: { path: { startsWith: org.path }, status: 'ACTIVE' },
      select: { id: true },
    });

    const positions = await this.prisma.position.findMany({
      where: {
        orgId: { in: orgs.map((o) => o.id) },
        status: 'ACTIVE',
        ...(includeLeader ? {} : { isLeader: false }),
      },
      include: { posts: { where: { endAt: null }, include: { user: true } } },
    });

    return this.flatten(positions);
  }

  private async leadersOf(orgId: string): Promise<Assignee[]> {
    const positions = await this.prisma.position.findMany({
      where: { orgId, isLeader: true, status: 'ACTIVE' },
      include: { posts: { where: { endAt: null }, include: { user: true } } },
    });
    return this.flatten(positions);
  }

  private async byPositions(ids: string[]): Promise<Assignee[]> {
    if (!ids.length) return [];
    const positions = await this.prisma.position.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      include: { posts: { where: { endAt: null }, include: { user: true } } },
    });
    return this.flatten(positions);
  }

  private async byOrgs(orgIds: string[]): Promise<Assignee[]> {
    if (!orgIds.length) return [];
    const positions = await this.prisma.position.findMany({
      where: { orgId: { in: orgIds }, status: 'ACTIVE' },
      include: { posts: { where: { endAt: null }, include: { user: true } } },
    });
    return this.flatten(positions);
  }

  private async byUsers(userIds: string[]): Promise<Assignee[]> {
    if (!userIds.length) return [];
    const posts = await this.prisma.post.findMany({
      where: { userId: { in: userIds }, endAt: null },
      include: { user: true, position: true },
      orderBy: { isPrimary: 'desc' },
    });
    const seen = new Set<string>();
    const out: Assignee[] = [];
    for (const p of posts) {
      if (seen.has(p.userId)) continue;
      seen.add(p.userId);
      out.push({
        userId: p.userId,
        orgId: p.position.orgId,
        positionId: p.positionId,
        isLeader: p.position.isLeader,
        name: p.user.name,
      });
    }
    return out;
  }

  private flatten(positions: any[]): Assignee[] {
    const seen = new Set<string>();
    const out: Assignee[] = [];
    for (const pos of positions) {
      for (const post of pos.posts) {
        if (seen.has(post.userId)) continue;
        seen.add(post.userId);
        out.push({
          userId: post.userId,
          orgId: pos.orgId,
          positionId: pos.id,
          isLeader: pos.isLeader,
          name: post.user.name,
        });
      }
    }
    return out;
  }

  private async parentOrgId(orgId: string): Promise<string | null> {
    const org = await this.prisma.org.findUnique({ where: { id: orgId } });
    return org?.parentId ?? null;
  }

  /** 判断某人是否为指定组织的正职负责人（一票否决资格） */
  async isLeaderOf(orgId: string, userId: string): Promise<boolean> {
    if (!orgId) return false;
    const count = await this.prisma.post.count({
      where: {
        userId,
        endAt: null,
        position: { orgId, isLeader: true, status: 'ACTIVE' },
      },
    });
    return count > 0;
  }
}
