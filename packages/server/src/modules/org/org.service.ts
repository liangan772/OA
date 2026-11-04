import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.module';

export interface OrgNode {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  rootUnitId: string;
  path: string;
  level: number;
  sort: number;
  positionCount: number;
  memberCount: number;
  leaderName: string | null;
  positions: any[];
  children: OrgNode[];
}

@Injectable()
export class OrgService {
  constructor(private readonly prisma: PrismaService) {}

  /** 完整组织树（含编制位与在任人员），一次查询内存组装 */
  async tree(): Promise<OrgNode[]> {
    const [orgs, positions, posts] = await Promise.all([
      this.prisma.org.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ level: 'asc' }, { sort: 'asc' }] }),
      this.prisma.position.findMany({ where: { status: 'ACTIVE' }, orderBy: { sort: 'asc' } }),
      this.prisma.post.findMany({ where: { endAt: null }, include: { user: true } }),
    ]);

    const postByPosition = new Map<string, any[]>();
    for (const p of posts) {
      const arr = postByPosition.get(p.positionId) || [];
      arr.push({ postId: p.id, userId: p.userId, name: p.user.name, account: p.user.account, isPrimary: p.isPrimary });
      postByPosition.set(p.positionId, arr);
    }

    const posByOrg = new Map<string, any[]>();
    for (const p of positions) {
      const arr = posByOrg.get(p.orgId) || [];
      arr.push({
        id: p.id,
        code: p.code,
        name: p.name,
        duty: p.duty,
        rank: p.rank,
        isLeader: p.isLeader,
        isDeputy: p.isDeputy,
        headcount: p.headcount,
        members: postByPosition.get(p.id) || [],
      });
      posByOrg.set(p.orgId, arr);
    }

    const map = new Map<string, OrgNode>();
    for (const o of orgs) {
      const ps = posByOrg.get(o.id) || [];
      const leader = ps.find((p) => p.isLeader);
      map.set(o.id, {
        id: o.id,
        code: o.code,
        name: o.name,
        type: o.type,
        parentId: o.parentId,
        rootUnitId: o.rootUnitId,
        path: o.path,
        level: o.level,
        sort: o.sort,
        positions: ps,
        positionCount: ps.reduce((s, p) => s + p.headcount, 0),
        memberCount: ps.reduce((s, p) => s + p.members.length, 0),
        leaderName: leader?.members?.[0]?.name ?? null,
        children: [],
      });
    }

    const roots: OrgNode[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  /** 平铺列表，供下拉选择 */
  async list(keyword?: string) {
    return this.prisma.org.findMany({
      where: {
        status: 'ACTIVE',
        ...(keyword ? { name: { contains: keyword } } : {}),
      },
      orderBy: [{ path: 'asc' }],
      select: { id: true, code: true, name: true, type: true, path: true, level: true, rootUnitId: true },
    });
  }

  async create(dto: {
    code: string;
    name: string;
    type: string;
    parentId?: string | null;
    sort?: number;
    remark?: string;
  }) {
    const exists = await this.prisma.org.findUnique({ where: { code: dto.code } });
    if (exists) throw new BadRequestException(`组织编码 ${dto.code} 已存在`);

    const parent = dto.parentId
      ? await this.prisma.org.findUnique({ where: { id: dto.parentId } })
      : null;
    if (dto.parentId && !parent) throw new NotFoundException('上级组织不存在');

    if (dto.type === 'UNIT') {
      if (parent && parent.type !== 'UNIT') {
        throw new BadRequestException('单位的上级只能是单位');
      }
    } else if (!parent) {
      throw new BadRequestException('部门必须挂在某个单位或上级部门下');
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.org.create({
        data: {
          code: dto.code,
          name: dto.name,
          type: dto.type,
          parentId: dto.parentId ?? null,
          rootUnitId: parent ? parent.rootUnitId : '',
          path: '',
          level: parent ? parent.level + 1 : 1,
          sort: dto.sort ?? 0,
        },
      });
      // 单位自身就是 rootUnit；部门则继承所属单位
      const rootUnitId = dto.type === 'UNIT' ? created.id : parent!.rootUnitId;
      const path = parent ? `${parent.path}${created.id}/` : `/${created.id}/`;
      return tx.org.update({ where: { id: created.id }, data: { rootUnitId, path } });
    });
  }

  async update(id: string, dto: { name?: string; sort?: number; status?: string }) {
    const org = await this.prisma.org.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('组织不存在');
    return this.prisma.org.update({ where: { id }, data: dto });
  }

  /** 移动节点：重算自身与全部后代的 path / level / rootUnitId */
  async move(id: string, newParentId: string | null) {
    const org = await this.prisma.org.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('组织不存在');
    if (newParentId === id) throw new BadRequestException('不能移动到自己下面');

    const parent = newParentId
      ? await this.prisma.org.findUnique({ where: { id: newParentId } })
      : null;
    if (newParentId && !parent) throw new NotFoundException('目标上级不存在');
    if (parent && parent.path.startsWith(org.path)) {
      throw new BadRequestException('不能移动到自己的子节点下');
    }
    if (org.type === 'UNIT' && parent && parent.type !== 'UNIT') {
      throw new BadRequestException('单位的上级只能是单位');
    }

    const descendants = await this.prisma.org.findMany({ where: { path: { startsWith: org.path } } });
    const oldPath = org.path;
    const newPath = parent ? `${parent.path}${org.id}/` : `/${org.id}/`;
    const levelDelta = (parent ? parent.level + 1 : 1) - org.level;
    const rootUnitId = org.type === 'UNIT' ? org.id : parent ? parent.rootUnitId : org.rootUnitId;

    await this.prisma.$transaction([
      ...descendants
        .sort((a, b) => a.path.length - b.path.length)
        .map((d) => {
          const tail = d.path.slice(oldPath.length);
          return this.prisma.org.update({
            where: { id: d.id },
            data: {
              path: `${newPath}${tail}`,
              level: d.level + levelDelta,
              rootUnitId: d.id === org.id ? rootUnitId : d.rootUnitId,
              parentId: d.id === org.id ? newParentId ?? null : d.parentId,
            },
          });
        }),
    ]);
    return { success: true };
  }

  async remove(id: string) {
    const org = await this.prisma.org.findUnique({
      where: { id },
      include: { children: true, positions: true },
    });
    if (!org) throw new NotFoundException('组织不存在');
    if (org.children.length > 0) throw new BadRequestException('请先删除下级组织');
    if (org.positions.length > 0) throw new BadRequestException('请先删除该组织下的编制位');
    await this.prisma.org.delete({ where: { id } });
    return { success: true };
  }

  // ---------------- 编制位 ----------------

  async createPosition(dto: {
    orgId: string;
    code: string;
    name: string;
    duty?: string;
    rank?: string;
    isLeader?: boolean;
    isDeputy?: boolean;
    headcount?: number;
    sort?: number;
  }) {
    const org = await this.prisma.org.findUnique({ where: { id: dto.orgId } });
    if (!org) throw new NotFoundException('组织不存在');

    return this.prisma.$transaction(async (tx) => {
      if (dto.isLeader) {
        await tx.position.updateMany({ where: { orgId: dto.orgId, isLeader: true }, data: { isLeader: false } });
      }
      return tx.position.create({
        data: {
          orgId: dto.orgId,
          code: dto.code,
          name: dto.name,
          duty: dto.duty,
          rank: dto.rank,
          isLeader: dto.isLeader ?? false,
          isDeputy: dto.isDeputy ?? false,
          headcount: dto.headcount ?? 1,
          sort: dto.sort ?? 0,
        },
      });
    });
  }

  async updatePosition(id: string, dto: any) {
    const pos = await this.prisma.position.findUnique({ where: { id } });
    if (!pos) throw new NotFoundException('编制位不存在');
    return this.prisma.$transaction(async (tx) => {
      if (dto.isLeader) {
        await tx.position.updateMany({ where: { orgId: pos.orgId, isLeader: true }, data: { isLeader: false } });
      }
      return tx.position.update({
        where: { id },
        data: {
          name: dto.name,
          duty: dto.duty,
          rank: dto.rank,
          isLeader: dto.isLeader,
          isDeputy: dto.isDeputy,
          headcount: dto.headcount,
          sort: dto.sort,
        },
      });
    });
  }

  async removePosition(id: string) {
    const posts = await this.prisma.post.count({ where: { positionId: id, endAt: null } });
    if (posts > 0) throw new BadRequestException('该编制位仍有人在任，请先免职');
    await this.prisma.position.delete({ where: { id } });
    return { success: true };
  }

  // ---------------- 任职 ----------------

  async assignPost(userId: string, positionId: string, isPrimary = true) {
    const [user, position] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.position.findUnique({
        where: { id: positionId },
        include: { posts: { where: { endAt: null } } },
      }),
    ]);
    if (!user) throw new NotFoundException('人员不存在');
    if (!position) throw new NotFoundException('编制位不存在');

    const existing = await this.prisma.post.findFirst({
      where: { userId, positionId, endAt: null },
    });
    if (existing) throw new BadRequestException('该人员已在此编制位任职');

    const occupied = position.posts.length;
    const overStaffed = occupied >= position.headcount;

    if (isPrimary) {
      // 主岗唯一：解除该用户其他主岗
      await this.prisma.post.updateMany({ where: { userId, isPrimary: true }, data: { isPrimary: false } });
    }

    const post = await this.prisma.post.create({ data: { userId, positionId, isPrimary } });
    return {
      post,
      warning: overStaffed ? `该编制位定编 ${position.headcount} 人，当前已配 ${occupied} 人，本次任职后超编` : null,
    };
  }

  async removePost(id: string) {
    await this.prisma.post.update({ where: { id }, data: { endAt: new Date() } });
    return { success: true };
  }

  /** 编制台账：定编 / 实配 / 空缺 */
  async ledger(rootUnitId?: string) {
    const orgs = await this.prisma.org.findMany({
      where: { status: 'ACTIVE', ...(rootUnitId ? { rootUnitId } : {}) },
      orderBy: { path: 'asc' },
    });
    const positions = await this.prisma.position.findMany({
      where: { status: 'ACTIVE', orgId: { in: orgs.map((o) => o.id) } },
      include: { posts: { where: { endAt: null } } },
    });

    const byOrg = new Map<string, { headcount: number; actual: number }>();
    for (const p of positions) {
      const cur = byOrg.get(p.orgId) || { headcount: 0, actual: 0 };
      cur.headcount += p.headcount;
      cur.actual += p.posts.length;
      byOrg.set(p.orgId, cur);
    }

    return orgs.map((o) => {
      const s = byOrg.get(o.id) || { headcount: 0, actual: 0 };
      return {
        orgId: o.id,
        orgName: o.name,
        orgType: o.type,
        level: o.level,
        headcount: s.headcount,
        actual: s.actual,
        vacancy: s.headcount - s.actual,
        over: s.actual > s.headcount,
      };
    });
  }

  // ---------------- 人员 ----------------

  async users(keyword?: string) {
    return this.prisma.user.findMany({
      where: keyword
        ? { OR: [{ name: { contains: keyword } }, { account: { contains: keyword } }] }
        : {},
      select: { id: true, account: true, name: true, phone: true, title: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createUser(dto: {
    account: string;
    name: string;
    password?: string;
    phone?: string;
    title?: string;
  }) {
    const exists = await this.prisma.user.findUnique({ where: { account: dto.account } });
    if (exists) throw new BadRequestException(`账号 ${dto.account} 已存在`);
    const user = await this.prisma.user.create({
      data: {
        account: dto.account,
        name: dto.name,
        phone: dto.phone,
        title: dto.title,
        passwordHash: await bcrypt.hash(dto.password || '123456', 10),
      },
      select: { id: true, account: true, name: true, phone: true, title: true, status: true },
    });
    return user;
  }

  async updateUser(id: string, dto: { name?: string; phone?: string; title?: string; status?: string; password?: string }) {
    const data: any = {
      name: dto.name,
      phone: dto.phone,
      title: dto.title,
      status: dto.status,
    };
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, account: true, name: true, phone: true, title: true, status: true },
    });
  }
}
