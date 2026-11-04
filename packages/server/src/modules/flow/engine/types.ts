import { PrismaService } from '../../../prisma/prisma.module';
import { AssigneeResolver } from './assignee.resolver';

export type NodeStatus = 'PENDING' | 'ACTIVE' | 'WAITING' | 'DONE' | 'RETURNED' | 'TERMINATED';

export interface TaskInput {
  action: string;
  opinion?: string;
  attachments?: string[];
  data?: any;
}

export interface StepOutcome {
  status: 'ACTIVE' | 'WAITING' | 'DONE';
  outcome?: string;
  data?: any;
}

export interface FlowEnginePort {
  startInstance(params: {
    definitionCode: string;
    initiatorId: string;
    orgId: string;
    formData?: any;
    title?: string;
    parentInstanceId?: string;
    originNodeInstanceId?: string;
  }): Promise<any>;
  advance(instanceId: string): Promise<void>;
  finishInstance(instanceId: string, status: string, outcome: string, reason?: string): Promise<void>;
}

export interface HandlerContext {
  prisma: PrismaService;
  resolver: AssigneeResolver;
  engine: FlowEnginePort;
  instance: any;
  node: any;
  config: any;
  nodeInstance: any;
}

export interface NodeHandler {
  type: string;
  enter(ctx: HandlerContext): Promise<StepOutcome>;
  onTask(ctx: HandlerContext, task: any, input: TaskInput): Promise<StepOutcome>;
}

export const hoursLater = (h: number) => new Date(Date.now() + h * 3600 * 1000);
