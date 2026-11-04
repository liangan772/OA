import { BadRequestException } from '@nestjs/common';
import { HandlerContext, NodeHandler, StepOutcome, TaskInput, hoursLater } from '../types';

/**
 * 表态节点：按编制规则生成表态任务。
 * 部门正职负责人投 DISAGREE 且启用否决 → 节点直接判定 VETOED，其余待办关闭。
 */
export class VoteHandler implements NodeHandler {
  type = 'VOTE';

  async enter(ctx: HandlerContext): Promise<StepOutcome> {
    const { prisma, resolver, instance, config, nodeInstance } = ctx;
    const assignees = await resolver.resolve(config.assigneeRule, config, instance.orgId);

    if (!assignees.length) {
      throw new BadRequestException(
        `【${ctx.node.name}】未解析到表态人员，请检查该部门编制位是否有人任职`,
      );
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

    // 生效的否决资格人（供前端提示「谁有一票否决权」）
    const vetoEligible: string[] = [];
    if (config.allowVeto !== false) {
      for (const a of assignees) {
        if (a.isLeader || (await resolver.isLeaderOf(a.orgId, a.userId))) {
          vetoEligible.push(a.userId);
        }
      }
    }

    return {
      status: 'ACTIVE',
      data: { assigneeCount: assignees.length, vetoEligible, assignees: assignees.map((a) => a.userId) },
    };
  }

  async onTask(ctx: HandlerContext, task: any, input: TaskInput): Promise<StepOutcome> {
    const { prisma, resolver, config, nodeInstance } = ctx;

    const fresh = await prisma.nodeInstance.findUnique({ where: { id: nodeInstance.id } });
    if (fresh.status === 'DONE' || fresh.status === 'TERMINATED') {
      throw new BadRequestException('该节点已结束，无法继续表态');
    }

    const action = input.action;
    if (!['AGREE', 'DISAGREE', 'ABSTAIN'].includes(action)) {
      throw new BadRequestException('无效的表态动作');
    }
    if (action === 'ABSTAIN' && config.allowAbstain === false) {
      throw new BadRequestException('本节点不允许弃权');
    }

    const isVeto = action === 'DISAGREE' && config.allowVeto !== false
      ? await resolver.isLeaderOf(task.assigneeOrgId, task.assigneeId)
      : false;

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'DONE',
        action,
        opinion: input.opinion ?? null,
        attachments: input.attachments ? JSON.stringify(input.attachments) : null,
        isVeto,
        finishedAt: new Date(),
        version: { increment: 1 },
      },
    });

    // 一票否决：立即收敛，其余待办作废
    if (isVeto) {
      await prisma.task.updateMany({
        where: { nodeInstanceId: nodeInstance.id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      return {
        status: 'DONE',
        outcome: 'VETOED',
        data: { vetoedBy: task.assigneeId, vetoOpinion: input.opinion ?? '' },
      };
    }

    const remain = await prisma.task.count({
      where: { nodeInstanceId: nodeInstance.id, status: 'PENDING' },
    });
    if (remain > 0) return { status: 'ACTIVE' };

    const all = await prisma.task.findMany({ where: { nodeInstanceId: nodeInstance.id } });
    const agree = all.filter((t) => t.action === 'AGREE').length;
    const disagree = all.filter((t) => t.action === 'DISAGREE').length;
    const abstain = all.filter((t) => t.action === 'ABSTAIN').length;
    const stats = { agree, disagree, abstain, total: all.length };

    return { status: 'DONE', outcome: disagree > 0 ? 'REJECT' : 'PASS', data: stats };
  }
}
