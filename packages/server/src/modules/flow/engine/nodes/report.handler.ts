import { BadRequestException } from '@nestjs/common';
import { HandlerContext, NodeHandler, StepOutcome, TaskInput, hoursLater } from '../types';

/**
 * 上报节点：向上级部门上报。
 * 一次上报会在上级创建一个独立流程实例（审批流程），本节点挂起等待回传。
 * 若该节点曾被上级「返回」，再次进入时先生成补正任务给发起人，补正后重新上报。
 */
export class ReportHandler implements NodeHandler {
  type = 'REPORT';

  async enter(ctx: HandlerContext): Promise<StepOutcome> {
    const { prisma, instance, node } = ctx;

    const returnedBefore = await prisma.nodeInstance.findFirst({
      where: { instanceId: instance.id, nodeKey: node.nodeKey, status: 'RETURNED' },
      orderBy: { startedAt: 'desc' },
    });

    // 曾被打回：先让发起人补正，再重新上报
    if (returnedBefore) {
      const result: any = returnedBefore.result || {};
      await prisma.task.create({
        data: {
          nodeInstanceId: ctx.nodeInstance.id,
          instanceId: instance.id,
          assigneeId: instance.initiatorId,
          assigneeOrgId: instance.orgId,
          deadline: hoursLater(48),
          status: 'PENDING',
        },
      });
      return {
        status: 'ACTIVE',
        data: {
          needSupplement: true,
          returnedReason: result.reason || '',
          returnedAt: result.returnedAt || null,
          round: instance.round,
        },
      };
    }

    return this.doReport(ctx);
  }

  async onTask(ctx: HandlerContext, task: any, input: TaskInput): Promise<StepOutcome> {
    const { prisma } = ctx;
    if (input.action !== 'RESUBMIT') {
      throw new BadRequestException('补正后请提交重新上报');
    }
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'DONE',
        action: 'RESUBMIT',
        opinion: input.opinion ?? null,
        finishedAt: new Date(),
        version: { increment: 1 },
      },
    });
    return this.doReport(ctx);
  }

  private async doReport(ctx: HandlerContext): Promise<StepOutcome> {
    const { prisma, instance, config, nodeInstance, engine } = ctx;

    // 防止重复上报
    const running = await prisma.flowInstance.findFirst({
      where: { parentInstanceId: instance.id, status: { in: ['RUNNING', 'WAITING'] } },
    });
    if (running) {
      return { status: 'WAITING', data: { childInstanceId: running.id } };
    }

    const target = await this.resolveTarget(prisma, config, instance.orgId);
    if (!target) {
      throw new BadRequestException(`【${ctx.node.name}】找不到上报目标部门，请检查组织层级或改用指定部门`);
    }

    const defCode = config.approveDefinitionCode || 'APPROVE-01';
    const definition = await prisma.flowDefinition.findUnique({ where: { code: defCode } });
    if (!definition) {
      throw new BadRequestException(`接报审批流程模板 ${defCode} 不存在`);
    }

    const child = await engine.startInstance({
      definitionCode: defCode,
      initiatorId: instance.initiatorId,
      orgId: target.id,
      formData: config.carryForm === false ? {} : instance.formData,
      title: instance.title,
      parentInstanceId: instance.id,
      originNodeInstanceId: nodeInstance.id,
    });

    return {
      status: 'WAITING',
      data: {
        childInstanceId: child.id,
        targetOrgId: target.id,
        targetOrgName: target.name,
        crossUnit: target.rootUnitId !== instance.rootUnitId,
      },
    };
  }

  /** 上报寻址：直接上级部门 → 上级单位同名部门 → 上级单位办公室 */
  private async resolveTarget(prisma: any, config: any, orgId: string) {
    if (config.targetRule === 'SPECIFIC_ORG' && config.targetOrgId) {
      const org = await prisma.org.findUnique({ where: { id: config.targetOrgId } });
      if (org) await this.assertCrossUnitAllowed(prisma, org, orgId);
      return org;
    }

    const org = await prisma.org.findUnique({ where: { id: orgId } });
    if (!org) return null;

    const ancestorIds = org.path.split('/').filter(Boolean).slice(0, -1).reverse();
    const ancestors = await prisma.org.findMany({ where: { id: { in: ancestorIds } } });
    const ordered = ancestorIds.map((id) => ancestors.find((a) => a.id === id)).filter(Boolean);

    // 情况一：同单位内还有上级部门
    const parentDept = ordered.find((a) => a.type === 'DEPARTMENT');
    if (parentDept && config.targetRule !== 'PARENT_UNIT_OFFICE') {
      await this.assertCrossUnitAllowed(prisma, parentDept, orgId);
      return parentDept;
    }

    // 情况二：跨单位，找上级单位下的对应部门；若已是最顶层单位，则落到本级办公室汇总
    const rootUnit = await prisma.org.findUnique({ where: { id: org.rootUnitId } });
    if (!rootUnit) return null;

    const parentUnitId = rootUnit.parentId ?? rootUnit.id;

    if (config.targetRule === 'SAME_NAME_DEPT' || config.targetRule === 'PARENT_DEPT') {
      const same = await prisma.org.findFirst({
        where: { name: org.name, type: 'DEPARTMENT', rootUnitId: parentUnitId, status: 'ACTIVE' },
      });
      if (same) {
        await this.assertCrossUnitAllowed(prisma, same, orgId);
        return same;
      }
    }

    const office = await prisma.org.findFirst({
      where: {
        rootUnitId: parentUnitId,
        type: 'DEPARTMENT',
        status: 'ACTIVE',
        OR: [{ name: { contains: '办公室' } }, { code: { contains: 'OFFICE' } }],
      },
    });
    if (office) await this.assertCrossUnitAllowed(prisma, office, orgId);
    return office;
  }

  /** 跨单位上报必须有授权，否则链路会在真实场景里被绕过或被堵死 */
  private async assertCrossUnitAllowed(prisma: any, target: any, fromOrgId: string) {
    const from = await prisma.org.findUnique({ where: { id: fromOrgId } });
    if (!from || from.rootUnitId === target.rootUnitId) return;

    const grant = await prisma.crossUnitGrant.findFirst({
      where: {
        status: 'ACTIVE',
        grantorOrgId: from.rootUnitId,
        granteeOrgId: target.rootUnitId,
        OR: [{ expireAt: null }, { expireAt: { gt: new Date() } }],
      },
    });
    if (!grant) {
      throw new BadRequestException(
        `未授权跨单位上报：${from.name} → ${target.name}，请先在「跨单位授权」中添加授权`,
      );
    }
  }
}
