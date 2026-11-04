import { HandlerContext, NodeHandler, StepOutcome } from '../types';

/**
 * 返回节点：把流程退回下级的上报节点。
 * 节点本身无待办，执行即结束，由引擎在收尾时唤醒父实例。
 */
export class ReturnHandler implements NodeHandler {
  type = 'RETURN';

  async enter(ctx: HandlerContext): Promise<StepOutcome> {
    const { prisma, instance, nodeInstance } = ctx;

    if (!instance.parentInstanceId) {
      throw new Error('返回节点只能用于由上报产生的流程实例');
    }

    const sum = await prisma.nodeInstance.findFirst({
      where: { instanceId: instance.id, nodeType: 'SUMMARIZE', status: 'DONE' },
      orderBy: { startedAt: 'desc' },
    });
    const reason: string = (sum?.result as any)?.summary || '上级审批未通过，请修改后重新上报';

    await prisma.nodeInstance.update({
      where: { id: nodeInstance.id },
      data: { result: { reason, returnedAt: new Date().toISOString() } },
    });

    return { status: 'DONE', outcome: 'RETURNED', data: { reason } };
  }

  async onTask(): Promise<StepOutcome> {
    return { status: 'DONE', outcome: 'RETURNED' };
  }
}
