import { BadRequestException } from '@nestjs/common';
import { HandlerContext, NodeHandler, StepOutcome, TaskInput, hoursLater } from '../types';

/**
 * 执行节点：执行人必须确认并填写执行说明意见，可上传佐证材料。
 */
export class ExecuteHandler implements NodeHandler {
  type = 'EXECUTE';

  async enter(ctx: HandlerContext): Promise<StepOutcome> {
    const { prisma, resolver, instance, config, nodeInstance } = ctx;

    const assignees = await resolver.resolve(config.assigneeRule || 'DEPT_LEADER', config, instance.orgId);
    if (!assignees.length) {
      throw new BadRequestException(`【${ctx.node.name}】未解析到执行人`);
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

    return {
      status: 'ACTIVE',
      data: { requireConfirm: config.requireConfirm !== false, requireOpinion: config.requireOpinion !== false },
    };
  }

  async onTask(ctx: HandlerContext, task: any, input: TaskInput): Promise<StepOutcome> {
    const { prisma, config, nodeInstance } = ctx;

    if (config.requireConfirm !== false && input.action !== 'CONFIRM') {
      throw new BadRequestException('本节点需要确认执行，请勾选确认');
    }
    if (config.requireOpinion !== false && !input.opinion?.trim()) {
      throw new BadRequestException('请填写执行说明意见');
    }

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'DONE',
        action: 'CONFIRM',
        opinion: input.opinion ?? null,
        attachments: input.attachments ? JSON.stringify(input.attachments) : null,
        finishedAt: new Date(),
        version: { increment: 1 },
      },
    });

    await prisma.task.updateMany({
      where: { nodeInstanceId: nodeInstance.id, status: 'PENDING' },
      data: { status: 'DONE', action: 'CONFIRM', finishedAt: new Date() },
    });

    return { status: 'DONE', outcome: 'PASS', data: { opinion: input.opinion ?? '', confirmed: true } };
  }
}
