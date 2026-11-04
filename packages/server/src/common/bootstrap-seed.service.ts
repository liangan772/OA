import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { NODE_DEFINITIONS } from '../modules/flow/node-definitions';

const BUILTIN_ORG_TYPES = [
  { code: 'UNIT', name: '单位', isUnit: true, builtin: true, sort: 1 },
  { code: 'DEPARTMENT', name: '部门', isUnit: false, builtin: true, sort: 2 },
  { code: 'SECTION', name: '科室', isUnit: false, builtin: true, sort: 3 },
];

/**
 * 启动时补齐内置数据，让新部署开箱即用，不依赖手动执行 seed。
 * 只补缺失项，已有数据（含后台改过的名称、颜色）一律不动。
 */
@Injectable()
export class BootstrapSeedService implements OnModuleInit {
  private readonly logger = new Logger('Bootstrap');

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureNodeDefinitions();
      await this.ensureOrgTypes();
    } catch (e: any) {
      // 表还没建好（比如首次启动 db push 未完成）时不阻断启动
      this.logger.warn(`内置数据初始化跳过：${e?.message || e}`);
    }
  }

  /** 六类节点定义：缺失的补上，已存在的不覆盖 */
  async ensureNodeDefinitions() {
    const existing = await this.prisma.nodeDefinition.findMany({ select: { type: true } });
    const have = new Set(existing.map((e) => e.type));
    const missing = NODE_DEFINITIONS.filter((n) => !have.has(n.type));

    if (!missing.length) return;

    await this.prisma.nodeDefinition.createMany({
      data: missing.map((n) => ({
        type: n.type,
        name: n.name,
        description: n.description,
        color: (n as any).color || colorOf(n.type),
        sort: sortOf(n.type),
        enabled: true,
        defaultConfig: n.defaultConfig as any,
        configSchema: n.configSchema as any,
      })),
    });

    this.logger.log(`已补齐 ${missing.length} 个节点定义：${missing.map((m) => m.type).join(', ')}`);
  }

  /** 三种内置组织类型：存在则同步名称与语义，不存在则创建 */
  async ensureOrgTypes() {
    for (const t of BUILTIN_ORG_TYPES) {
      await this.prisma.orgType.upsert({
        where: { code: t.code },
        create: t,
        update: { isUnit: t.isUnit, builtin: true, sort: t.sort },
      });
    }
  }
}

/** 节点标签配色与排序，仅在首次创建时写入，之后以后台配置为准 */
const colorOf = (type: string) =>
  ({ VOTE: 'blue', SUMMARIZE: 'purple', REPORT: 'gold', RETURN: 'red', ASSIGN: 'cyan', EXECUTE: 'green' })[
    type
  ] || 'blue';

const sortOf = (type: string) =>
  ({ VOTE: 1, SUMMARIZE: 2, REPORT: 3, RETURN: 4, ASSIGN: 5, EXECUTE: 6 })[type] || 99;
