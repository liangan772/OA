import { BadRequestException } from '@nestjs/common';
import { HandlerContext, NodeHandler, StepOutcome, TaskInput, hoursLater } from '../types';

/**
 * 总结节点：读上游表态结果，按规则给出建议结论，由总结人确认后分流。
 */
export class SummarizeHandler implements NodeHandler {
  type = 'SUMMARIZE';

  async enter(ctx: HandlerContext): Promise<StepOutcome> {
    const { prisma, resolver, instance, config, nodeInstance } = ctx;

    const voteNi = await prisma.nodeInstance.findFirst({
      where: { instanceId: instance.id, nodeType: 'VOTE', status: 'DONE' },
      orderBy: { startedAt: 'desc' },
      include: { tasks: true },
    });

    const tasks = voteNi?.tasks ?? [];
    const stats = {
      agree: tasks.filter((t) => t.action === 'AGREE').length,
      disagree: tasks.filter((t) => t.action === 'DISAGREE').length,
      abstain: tasks.filter((t) => t.action === 'ABSTAIN').length,
      total: tasks.length,
      veto: tasks.some((t) => t.isVeto),
    };

    // 上游出现一票否决时，建议结论直接为不通过
    const suggested = stats.veto ? 'REJECT' : this.decide(config, stats);
    const assignees = await resolver.resolve(config.summarizerRule, config, instance.orgId);
    if (!assignees.length) {
      throw new BadRequestException(`【${ctx.node.name}】未解析到总结人，请检查编制任职`);
    }

    const deadline = hoursLater(48);
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

    return { status: 'ACTIVE', data: { stats, suggested, vetoed: stats.veto } };
  }

  async onTask(ctx: HandlerContext, task: any, input: TaskInput): Promise<StepOutcome> {
    const { prisma, nodeInstance } = ctx;
    const action = input.action;

    if (!['PASS', 'REJECT'].includes(action)) {
      throw new BadRequestException('总结结论只能是 PASS 或 REJECT');
    }

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'DONE',
        action,
        opinion: input.opinion ?? null,
        finishedAt: new Date(),
        version: { increment: 1 },
      },
    });

    await prisma.task.updateMany({
      where: { nodeInstanceId: nodeInstance.id, status: 'PENDING' },
      data: { status: 'DONE', action, finishedAt: new Date() },
    });

    return {
      status: 'DONE',
      outcome: action,
      data: { conclusion: action, summary: input.opinion ?? '' },
    };
  }

  private decide(config: any, stats: { agree: number; disagree: number; abstain: number; total: number }) {
    const rule = config.decisionRule || 'MAJORITY';
    if (stats.total === 0) return 'PASS';
    if (rule === 'ALL_AGREE') return stats.disagree === 0 ? 'PASS' : 'REJECT';
    if (rule === 'MAJORITY') {
      const threshold = typeof config.passThreshold === 'number' ? config.passThreshold : 0.5;
      return stats.agree / stats.total >= threshold ? 'PASS' : 'REJECT';
    }
    // LEADER_DECIDE / MANUAL 由总结人裁定
    return stats.disagree > 0 ? 'REJECT' : 'PASS';
  }
}
