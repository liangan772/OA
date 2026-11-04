import { BadRequestException } from '@nestjs/common';
import { HandlerContext, NodeHandler, StepOutcome, TaskInput, hoursLater } from '../types';

/**
 * 分配节点：把流程派给一个部门或个人。
 * 部门级分配落到负责人（接单后可内部转派），个人分配直接落到本人。
 */
export class AssignHandler implements NodeHandler {
  type = 'ASSIGN';

  async enter(ctx: HandlerContext): Promise<StepOutcome> {
    const { prisma, resolver, instance, config, nodeInstance } = ctx;

    let assignees: any[] = [];
    const targetType = config.targetType || 'ORG';

    if (targetType === 'ORG') {
      const orgId = config.targetOrgId || instance.orgId;
      assignees = await resolver.resolve('DEPT_LEADER', {}, orgId);
      if (!assignees.length) {
        throw new BadRequestException(`目标部门未配置负责人编制位，无法接单`);
      }
    } else if (targetType === 'USER') {
      assignees = await resolver.resolve('USER', { userIds: config.targetUserId ? [config.targetUserId] : [] }, instance.orgId);
    } else if (targetType === 'POSITION') {
      assignees = await resolver.resolve('POSITION', { positionIds: config.targetPositionId ? [config.targetPositionId] : [] }, instance.orgId);
    }

    if (!assignees.length) {
      throw new BadRequestException(`【${ctx.node.name}】未解析到分配对象`);
    }

    const deadline = config.deadlineHours ? hoursLater(config.deadlineHours) : null;
    await prisma.task.createMany({
      data: assignees.map((a) => ({
        nodeInstanceId: nodeInstance.id,
        instanceId: instance.id,
        assigneeId: a.userId,
        assigneeOrgId: a.orgId,
        deadline,
        status: 'PENDING',
      })),
    });

    return { status: 'ACTIVE', data: { assigneeCount: assignees.length, targetType } };
  }

  async onTask(ctx: HandlerContext, task: any, input: TaskInput): Promise<StepOutcome> {
    const { prisma, config, instance, nodeInstance } = ctx;

    // 转派：当前接单人把事项转给同部门其他人
    if (input.action === 'TRANSFER') {
      if (config.allowTransfer === false) throw new BadRequestException('本节点不允许转派');
      const targetUserId = input.data?.targetUserId;
      if (!targetUserId) throw new BadRequestException('请选择转派对象');

      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'DONE',
          action: 'TRANSFER',
          opinion: input.opinion ?? null,
          finishedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await prisma.task.create({
        data: {
          nodeInstanceId: nodeInstance.id,
          instanceId: instance.id,
          assigneeId: targetUserId,
          assigneeOrgId: task.assigneeOrgId,
          deadline: task.deadline,
          status: 'PENDING',
        },
      });
      return { status: 'ACTIVE', data: { transferredTo: targetUserId } };
    }

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'DONE',
        action: input.action || 'ACCEPT',
        opinion: input.opinion ?? null,
        finishedAt: new Date(),
        version: { increment: 1 },
      },
    });

    await prisma.task.updateMany({
      where: { nodeInstanceId: nodeInstance.id, status: 'PENDING' },
      data: { status: 'DONE', action: 'ACCEPT', finishedAt: new Date() },
    });

    return { status: 'DONE', outcome: 'PASS', data: { acceptedBy: task.assigneeId } };
  }
}
