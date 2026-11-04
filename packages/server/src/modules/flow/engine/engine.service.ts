import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.module';
import { RedisService } from '../../redis/redis.service';
import { AssigneeResolver } from './assignee.resolver';
import { FlowEnginePort, HandlerContext, NodeHandler, TaskInput } from './types';
import { VoteHandler } from './nodes/vote.handler';
import { SummarizeHandler } from './nodes/summarize.handler';
import { ReportHandler } from './nodes/report.handler';
import { ReturnHandler } from './nodes/return.handler';
import { AssignHandler } from './nodes/assign.handler';
import { ExecuteHandler } from './nodes/execute.handler';

const FINAL_STATUS: Record<string, string> = {
  VETOED: 'VETOED',
  REJECT: 'REJECTED',
  RETURNED: 'RETURNED',
  TERMINATED: 'TERMINATED',
};

@Injectable()
export class FlowEngineService implements FlowEnginePort {
  private readonly logger = new Logger('FlowEngine');
  private readonly handlers = new Map<string, NodeHandler>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: AssigneeResolver,
    private readonly redis: RedisService,
  ) {
    for (const h of [
      new VoteHandler(),
      new SummarizeHandler(),
      new ReportHandler(),
      new ReturnHandler(),
      new AssignHandler(),
      new ExecuteHandler(),
    ]) {
      this.handlers.set(h.type, h);
    }
  }

  // ------------------------------------------------------------
  // 实例启动
  // ------------------------------------------------------------
  async startInstance(params: {
    definitionCode: string;
    initiatorId: string;
    orgId: string;
    formData?: any;
    title?: string;
    parentInstanceId?: string;
    originNodeInstanceId?: string;
  }) {
    const definition = await this.prisma.flowDefinition.findUnique({
      where: { code: params.definitionCode },
      include: { nodes: { orderBy: { sort: 'asc' } } },
    });
    if (!definition) throw new NotFoundException(`流程模板 ${params.definitionCode} 不存在`);
    if (!definition.nodes.length) throw new BadRequestException('流程模板尚未配置节点');

    const org = await this.prisma.org.findUnique({ where: { id: params.orgId } });
    if (!org) throw new NotFoundException('发起组织不存在');

    const firstNode = definition.nodes[0];

    const instance = await this.prisma.flowInstance.create({
      data: {
        definitionId: definition.id,
        definitionVersion: definition.version,
        title: params.title || `${definition.name}-${new Date().toISOString().slice(0, 10)}`,
        status: 'RUNNING',
        formData: params.formData ?? {},
        orgId: org.id,
        rootUnitId: org.rootUnitId,
        initiatorId: params.initiatorId,
        parentInstanceId: params.parentInstanceId ?? null,
        originNodeInstanceId: params.originNodeInstanceId ?? null,
        currentNodeKey: firstNode.nodeKey,
        round: 1,
      },
    });

    let rootInstanceId = instance.id;
    if (params.parentInstanceId) {
      const parent = await this.prisma.flowInstance.findUnique({ where: { id: params.parentInstanceId } });
      rootInstanceId = parent?.rootInstanceId || parent?.id || instance.id;
    }
    await this.prisma.flowInstance.update({ where: { id: instance.id }, data: { rootInstanceId } });

    await this.log(instance.id, null, params.initiatorId, null, 'START', {
      definitionCode: definition.code,
      orgName: org.name,
    });

    await this.advance(instance.id);
    return this.prisma.flowInstance.findUnique({ where: { id: instance.id } });
  }

  // ------------------------------------------------------------
  // 主循环：进入节点 → 若自动完成则继续往后走
  // ------------------------------------------------------------
  async advance(instanceId: string): Promise<void> {
    // 同一实例的推进串行化，避免并发重复创建节点实例或重复上报
    return this.redis.withLock(`lock:flow:${instanceId}`, 15000, () => this.advanceInternal(instanceId));
  }

  private async advanceInternal(instanceId: string): Promise<void> {
    for (let guard = 0; guard < 50; guard++) {
      const inst: any = await this.prisma.flowInstance.findUnique({
        where: { id: instanceId },
        include: { definition: { include: { nodes: true } } },
      });
      if (!inst) return;
      if (inst.status !== 'RUNNING') return;

      if (!inst.currentNodeKey) {
        await this.finishInstance(inst.id, 'APPROVED', 'PASS');
        return;
      }

      const node = inst.definition.nodes.find((n: any) => n.nodeKey === inst.currentNodeKey);
      if (!node) {
        await this.finishInstance(inst.id, 'TERMINATED', 'TERMINATED', '节点配置缺失');
        return;
      }

      const handler = this.handlers.get(node.nodeType);
      if (!handler) {
        await this.finishInstance(inst.id, 'TERMINATED', 'TERMINATED', `未知节点类型 ${node.nodeType}`);
        return;
      }

      let ni: any = await this.prisma.nodeInstance.findFirst({
        where: {
          instanceId: inst.id,
          nodeKey: node.nodeKey,
          status: { in: ['PENDING', 'ACTIVE', 'WAITING'] },
        },
        orderBy: { startedAt: 'desc' },
      });

      // 已在等待任务或子流程，不重复进入
      if (ni && ni.status !== 'PENDING') return;

      if (!ni) {
        ni = await this.prisma.nodeInstance.create({
          data: {
            instanceId: inst.id,
            nodeKey: node.nodeKey,
            nodeType: node.nodeType,
            configSnapshot: node.config ?? {},
            status: 'PENDING',
            round: inst.round,
          },
        });
        await this.log(inst.id, ni.id, null, node.nodeKey, 'NODE_ENTER', { nodeName: node.name });
      }

      const ctx: HandlerContext = {
        prisma: this.prisma,
        resolver: this.resolver,
        engine: this,
        instance: inst,
        node,
        config: (node.config as any) ?? {},
        nodeInstance: ni,
      };

      const result = await handler.enter(ctx);

      await this.prisma.nodeInstance.update({
        where: { id: ni.id },
        data: {
          status: result.status,
          result: { ...((ni.result as any) || {}), ...(result.data || {}) },
          finishedAt: result.status === 'DONE' ? new Date() : null,
        },
      });

      if (result.status !== 'DONE') return;

      const nextKey = this.resolveNext(node, result.outcome);

      if (nextKey === undefined) {
        await this.finishInstance(inst.id, FINAL_STATUS[result.outcome] || 'TERMINATED', result.outcome || 'TERMINATED');
        return;
      }
      if (nextKey === null) {
        await this.finishInstance(inst.id, 'APPROVED', 'PASS');
        return;
      }

      await this.prisma.flowInstance.update({
        where: { id: inst.id },
        data: { currentNodeKey: nextKey },
      });
    }

    this.logger.warn(`实例 ${instanceId} 推进次数超限，已停止`);
  }

  // ------------------------------------------------------------
  // 待办完成
  // ------------------------------------------------------------
  async completeTask(taskId: string, userId: string, input: TaskInput) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { nodeInstance: true, instance: { include: { definition: { include: { nodes: true } } } } },
    });
    if (!task) throw new NotFoundException('待办不存在');
    if (task.assigneeId !== userId) throw new BadRequestException('这不是你的待办');
    if (task.status !== 'PENDING') throw new BadRequestException('该待办已处理');

    const inst: any = task.instance;
    if (['APPROVED', 'REJECTED', 'VETOED', 'TERMINATED'].includes(inst.status)) {
      throw new BadRequestException('流程已结束');
    }

    const node = inst.definition.nodes.find((n: any) => n.nodeKey === task.nodeInstance.nodeKey);
    const handler = this.handlers.get(node?.nodeType);
    if (!handler) throw new BadRequestException('节点类型不支持');

    const ctx: HandlerContext = {
      prisma: this.prisma,
      resolver: this.resolver,
      engine: this,
      instance: inst,
      node,
      config: (node.config as any) ?? {},
      nodeInstance: task.nodeInstance,
    };

    const result = await handler.onTask(ctx, task, input);

    const niAgain = await this.prisma.nodeInstance.findUnique({ where: { id: task.nodeInstanceId } });
    await this.prisma.nodeInstance.update({
      where: { id: task.nodeInstanceId },
      data: {
        status: result.status,
        result: { ...((niAgain?.result as any) || {}), ...(result.data || {}) },
        finishedAt: result.status === 'DONE' ? new Date() : null,
      },
    });

    await this.log(inst.id, task.nodeInstanceId, userId, node?.nodeKey, `TASK_${input.action}`, {
      opinion: input.opinion,
    });

    if (result.status === 'DONE') {
      const nextKey = this.resolveNext(node, result.outcome);

      if (nextKey === undefined) {
        await this.finishInstance(inst.id, FINAL_STATUS[result.outcome] || 'TERMINATED', result.outcome || 'TERMINATED');
      } else if (nextKey === null) {
        await this.finishInstance(inst.id, 'APPROVED', 'PASS');
      } else {
        await this.prisma.flowInstance.update({ where: { id: inst.id }, data: { currentNodeKey: nextKey } });
        await this.advance(inst.id);
      }
    }

    return this.prisma.flowInstance.findUnique({ where: { id: inst.id } });
  }

  // ------------------------------------------------------------
  // 实例收尾 + 跨实例回调（上报 / 返回的联动就在这里闭环）
  // ------------------------------------------------------------
  async finishInstance(instanceId: string, status: string, outcome: string, reason?: string) {
    const inst = await this.prisma.flowInstance.findUnique({ where: { id: instanceId } });
    if (!inst) return;
    if (['APPROVED', 'REJECTED', 'VETOED', 'RETURNED', 'TERMINATED'].includes(inst.status)) return;

    await this.prisma.flowInstance.update({
      where: { id: instanceId },
      data: { status, outcome, closedAt: new Date() },
    });
    await this.log(instanceId, null, null, null, 'FINISH', { status, outcome, reason });

    if (!inst.parentInstanceId || !inst.originNodeInstanceId) return;

    const originNi = await this.prisma.nodeInstance.findUnique({ where: { id: inst.originNodeInstanceId } });
    if (!originNi) return;

    const parent = await this.prisma.flowInstance.findUnique({
      where: { id: inst.parentInstanceId },
      include: { definition: { include: { nodes: true } } },
    });
    if (!parent) return;

    if (status === 'APPROVED') {
      // 上级通过 → 上报节点完成，父流程继续往下走
      await this.prisma.nodeInstance.update({
        where: { id: originNi.id },
        data: {
          status: 'DONE',
          result: { ...((originNi.result as any) || {}), childStatus: 'APPROVED', childInstanceId: inst.id },
          finishedAt: new Date(),
        },
      });

      const parentNode = parent.definition.nodes.find((n: any) => n.nodeKey === originNi.nodeKey);
      const nextKey = this.resolveNext(parentNode, 'PASS');
      await this.prisma.flowInstance.update({
        where: { id: parent.id },
        data: { currentNodeKey: nextKey ?? null, status: 'RUNNING' },
      });
      await this.advanceInternal(parent.id);
      return;
    }

    // 退回 / 否决 / 拒绝 → 父实例回到上报节点，round+1，等待发起人补正
    await this.prisma.nodeInstance.update({
      where: { id: originNi.id },
      data: {
        status: 'RETURNED',
        result: {
          ...((originNi.result as any) || {}),
          childStatus: status,
          reason: reason || (originNi.result as any)?.reason || '上级审批未通过',
          returnedAt: new Date().toISOString(),
        },
      },
    });

    await this.prisma.flowInstance.update({
      where: { id: parent.id },
      data: { status: 'RUNNING', round: { increment: 1 } },
    });
    await this.advanceInternal(parent.id);
  }

  // ------------------------------------------------------------
  private resolveNext(node: any, outcome?: string): string | null | undefined {
    const config = (node?.config as any) || {};
    const branches = config.branches;
    if (branches && typeof branches === 'object' && outcome && outcome in branches) {
      return branches[outcome] ?? null;
    }
    if (outcome && FINAL_STATUS[outcome]) return undefined;
    return node?.nextNodeKey ?? null;
  }

  private async log(
    instanceId: string,
    nodeInstanceId: string | null,
    actorId: string | null,
    nodeKey: string | null,
    action: string,
    detail?: any,
  ) {
    let actorName: string | null = null;
    if (actorId) {
      const u = await this.prisma.user.findUnique({ where: { id: actorId } });
      actorName = u?.name ?? null;
    }
    await this.prisma.flowLog.create({
      data: {
        instanceId,
        nodeInstanceId,
        nodeKey,
        actorId,
        actorName,
        action,
        detail: detail ? JSON.stringify(detail) : null,
      },
    });
  }
}
