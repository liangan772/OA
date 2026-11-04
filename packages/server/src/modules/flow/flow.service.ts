import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { FlowEngineService } from './engine/engine.service';
import { AssigneeResolver } from './engine/assignee.resolver';
import { TaskInput } from './engine/types';

@Injectable()
export class FlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: FlowEngineService,
    private readonly resolver: AssigneeResolver,
  ) {}

  // ---------------- 模板 ----------------

  async definitions(type?: string) {
    return this.prisma.flowDefinition.findMany({
      where: type ? { type } : {},
      include: {
        nodes: { orderBy: { sort: 'asc' } },
        contentTemplate: true,
      },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async definition(id: string) {
    const def = await this.prisma.flowDefinition.findUnique({
      where: { id },
      include: { nodes: { orderBy: { sort: 'asc' } }, contentTemplate: true },
    });
    if (!def) throw new NotFoundException('流程模板不存在');
    return def;
  }

  async nodeDefinitions() {
    return this.prisma.nodeDefinition.findMany({ orderBy: { type: 'asc' } });
  }

  async contentTemplates() {
    return this.prisma.contentTemplate.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } });
  }

  async saveDefinition(dto: any) {
    if (!dto.code || !dto.name) throw new BadRequestException('模板编码与名称必填');
    const existing = await this.prisma.flowDefinition.findUnique({ where: { code: dto.code } });

    const payload = {
      name: dto.name,
      type: dto.type,
      description: dto.description ?? null,
      contentTemplateId: dto.contentTemplateId ?? null,
      startRule: dto.startRule ?? {},
      status: dto.status ?? 'PUBLISHED',
    };

    let def;
    if (existing) {
      def = await this.prisma.flowDefinition.update({
        where: { code: dto.code },
        data: { ...payload, version: { increment: 1 } },
      });
      await this.prisma.flowDefNode.deleteMany({ where: { definitionId: def.id } });
    } else {
      def = await this.prisma.flowDefinition.create({ data: { code: dto.code, ...payload } });
    }

    if (Array.isArray(dto.nodes)) {
      await this.prisma.flowDefNode.createMany({
        data: dto.nodes.map((n: any, i: number) => ({
          definitionId: def.id,
          nodeKey: n.nodeKey,
          nodeType: n.nodeType,
          name: n.name,
          config: n.config ?? {},
          nextNodeKey: n.nextNodeKey ?? null,
          sort: n.sort ?? i + 1,
        })),
      });
    }

    return this.definition(def.id);
  }

  async saveContentTemplate(dto: any) {
    if (!dto.code || !dto.name) throw new BadRequestException('模板编码与名称必填');
    return this.prisma.contentTemplate.upsert({
      where: { code: dto.code },
      create: {
        code: dto.code,
        name: dto.name,
        category: dto.category ?? null,
        schema: dto.schema ?? { fields: [] },
        layout: dto.layout ?? {},
      },
      update: {
        name: dto.name,
        category: dto.category ?? null,
        schema: dto.schema ?? { fields: [] },
        layout: dto.layout ?? {},
        version: { increment: 1 },
      },
    });
  }

  // ---------------- 发起与办理 ----------------

  async start(userId: string, dto: { definitionCode: string; formData?: any; title?: string; orgId?: string }) {
    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        posts: { where: { endAt: null }, include: { position: { include: { org: true } } } },
      },
    });
    if (!profile) throw new NotFoundException('用户不存在');
    if (!profile.posts.length) throw new BadRequestException('你尚未在编制中任职，无法发起流程');

    const primary = profile.posts.find((p) => p.isPrimary) || profile.posts[0];
    const orgId = dto.orgId || primary.position.orgId;

    const def = await this.prisma.flowDefinition.findUnique({ where: { code: dto.definitionCode } });
    if (!def) throw new NotFoundException('流程模板不存在');
    if (def.status !== 'PUBLISHED') throw new BadRequestException('该流程模板尚未发布');

    return this.engine.startInstance({
      definitionCode: dto.definitionCode,
      initiatorId: userId,
      orgId,
      formData: dto.formData ?? {},
      title: dto.title,
    });
  }

  async complete(taskId: string, userId: string, input: TaskInput) {
    return this.engine.completeTask(taskId, userId, input);
  }

  // ---------------- 查询 ----------------

  async todo(userId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { assigneeId: userId, status: 'PENDING' },
      include: {
        nodeInstance: true,
        instance: { include: { definition: { include: { nodes: true } }, initiator: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return tasks
      .filter((t) => !['APPROVED', 'REJECTED', 'VETOED', 'TERMINATED'].includes(t.instance.status))
      .map((t) => ({
        taskId: t.id,
        instanceId: t.instanceId,
        title: t.instance.title,
        flowName: t.instance.definition.name,
        flowType: t.instance.definition.type,
        nodeName:
          t.instance.definition.nodes.find((n) => n.nodeKey === t.nodeInstance.nodeKey)?.name ||
          t.nodeInstance.nodeKey,
        nodeType: t.nodeInstance.nodeType,
        initiatorName: t.instance.initiator.name,
        instanceStatus: t.instance.status,
        deadline: t.deadline,
        createdAt: t.createdAt,
        round: t.instance.round,
      }));
  }

  async done(userId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { assigneeId: userId, status: { in: ['DONE', 'CANCELLED', 'TIMEOUT'] } },
      include: { instance: { include: { definition: true } } },
      orderBy: { finishedAt: 'desc' },
      take: 100,
    });
    return tasks.map((t) => ({
      taskId: t.id,
      instanceId: t.instanceId,
      title: t.instance.title,
      flowName: t.instance.definition.name,
      action: t.action,
      opinion: t.opinion,
      finishedAt: t.finishedAt,
      instanceStatus: t.instance.status,
    }));
  }

  async myInstances(userId: string) {
    const list = await this.prisma.flowInstance.findMany({
      where: { initiatorId: userId },
      include: { definition: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return list.map((i) => ({
      id: i.id,
      title: i.title,
      flowName: i.definition.name,
      flowType: i.definition.type,
      status: i.status,
      round: i.round,
      createdAt: i.createdAt,
      closedAt: i.closedAt,
    }));
  }

  async detail(instanceId: string, userId: string) {
    const inst = await this.prisma.flowInstance.findUnique({
      where: { id: instanceId },
      include: {
        definition: { include: { nodes: { orderBy: { sort: 'asc' } }, contentTemplate: true } },
        initiator: true,
        nodeInstances: {
          orderBy: { startedAt: 'asc' },
          include: { tasks: { orderBy: { createdAt: 'asc' } } },
        },
        logs: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!inst) throw new NotFoundException('流程不存在');

    const nodeNameMap = new Map(inst.definition.nodes.map((n) => [n.nodeKey, n.name]));

    const userIds = new Set<string>();
    inst.nodeInstances.forEach((ni) => ni.tasks.forEach((t) => userIds.add(t.assigneeId)));
    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, account: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const orgIds = new Set<string>([inst.orgId]);
    inst.nodeInstances.forEach((ni) => ni.tasks.forEach((t) => orgIds.add(t.assigneeOrgId)));
    const orgs = await this.prisma.org.findMany({
      where: { id: { in: Array.from(orgIds) } },
      select: { id: true, name: true },
    });
    const orgMap = new Map(orgs.map((o) => [o.id, o.name]));

    const children = await this.prisma.flowInstance.findMany({
      where: { parentInstanceId: inst.id },
      include: { definition: true },
      orderBy: { createdAt: 'desc' },
    });

    const parent = inst.parentInstanceId
      ? await this.prisma.flowInstance.findUnique({
          where: { id: inst.parentInstanceId },
          include: { definition: true },
        })
      : null;

    const myTasks = inst.nodeInstances.flatMap((ni) =>
      ni.tasks
        .filter((t) => t.assigneeId === userId && t.status === 'PENDING')
        .map((t) => ({ taskId: t.id, nodeKey: ni.nodeKey, nodeType: ni.nodeType, round: ni.round })),
    );

    return {
      instance: {
        id: inst.id,
        title: inst.title,
        status: inst.status,
        outcome: inst.outcome,
        round: inst.round,
        formData: inst.formData,
        orgId: inst.orgId,
        orgName: orgMap.get(inst.orgId) || '',
        initiatorId: inst.initiatorId,
        initiatorName: inst.initiator.name,
        createdAt: inst.createdAt,
        closedAt: inst.closedAt,
        parentInstanceId: inst.parentInstanceId,
        rootInstanceId: inst.rootInstanceId,
      },
      definition: {
        id: inst.definition.id,
        code: inst.definition.code,
        name: inst.definition.name,
        type: inst.definition.type,
        contentTemplate: inst.definition.contentTemplate,
        nodes: inst.definition.nodes.map((n) => ({
          nodeKey: n.nodeKey,
          nodeType: n.nodeType,
          name: n.name,
          nextNodeKey: n.nextNodeKey,
        })),
      },
      nodeInstances: inst.nodeInstances.map((ni) => ({
        id: ni.id,
        nodeKey: ni.nodeKey,
        nodeType: ni.nodeType,
        nodeName: nodeNameMap.get(ni.nodeKey) || ni.nodeKey,
        status: ni.status,
        round: ni.round,
        result: ni.result,
        startedAt: ni.startedAt,
        finishedAt: ni.finishedAt,
        tasks: ni.tasks.map((t) => ({
          id: t.id,
          assigneeId: t.assigneeId,
          assigneeName: userMap.get(t.assigneeId) || '',
          assigneeOrgName: orgMap.get(t.assigneeOrgId) || '',
          status: t.status,
          action: t.action,
          opinion: t.opinion,
          isVeto: t.isVeto,
          deadline: t.deadline,
          finishedAt: t.finishedAt,
          mine: t.assigneeId === userId,
        })),
      })),
      children: children.map((c) => ({
        id: c.id,
        title: c.title,
        flowName: c.definition.name,
        status: c.status,
        createdAt: c.createdAt,
      })),
      parent: parent ? { id: parent.id, title: parent.title, flowName: parent.definition.name, status: parent.status } : null,
      logs: inst.logs.map((l) => ({
        id: l.id,
        action: l.action,
        actorName: l.actorName,
        nodeKey: l.nodeKey,
        detail: l.detail,
        createdAt: l.createdAt,
      })),
      myTasks,
    };
  }

  /** 节点详情里展示「谁有一票否决权」 */
  async vetoInfo(instanceId: string) {
    const inst = await this.prisma.flowInstance.findUnique({ where: { id: instanceId } });
    if (!inst) return [];
    return this.resolver.resolve('DEPT_LEADER', {}, inst.orgId);
  }
}
