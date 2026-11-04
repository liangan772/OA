import '../src/common/load-env';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { NODE_DEFINITIONS } from '../src/modules/flow/node-definitions';

const prisma = new PrismaClient();


async function createOrg(code: string, name: string, type: string, parent?: any) {
  const created = await prisma.org.create({
    data: {
      code,
      name,
      type,
      parentId: parent?.id ?? null,
      rootUnitId: '',
      path: '',
      level: parent ? parent.level + 1 : 1,
    },
  });
  return prisma.org.update({
    where: { id: created.id },
    data: {
      rootUnitId: type === 'UNIT' ? created.id : parent.rootUnitId,
      path: parent ? `${parent.path}${created.id}/` : `/${created.id}/`,
    },
  });
}

async function createPosition(
  org: any,
  code: string,
  name: string,
  opts: { isLeader?: boolean; isDeputy?: boolean; headcount?: number } = {},
) {
  return prisma.position.create({
    data: {
      orgId: org.id,
      code,
      name,
      isLeader: opts.isLeader ?? false,
      isDeputy: opts.isDeputy ?? false,
      headcount: opts.headcount ?? 1,
    },
  });
}

async function main() {
  console.log('清理旧数据…');
  await prisma.$transaction([
    prisma.task.deleteMany(),
    prisma.nodeInstance.deleteMany(),
    prisma.flowLog.deleteMany(),
    prisma.flowInstance.deleteMany(),
    prisma.flowDefNode.deleteMany(),
    prisma.flowDefinition.deleteMany(),
    prisma.contentTemplate.deleteMany(),
    prisma.nodeDefinition.deleteMany(),
    prisma.collectResponse.deleteMany(),
    prisma.collectForm.deleteMany(),
    prisma.mailRecipient.deleteMany(),
    prisma.mail.deleteMany(),
    prisma.docVersion.deleteMany(),
    prisma.document.deleteMany(),
    prisma.crossUnitGrant.deleteMany(),
    prisma.post.deleteMany(),
    prisma.position.deleteMany(),
    prisma.org.deleteMany(),
    prisma.orgType.deleteMany(),
    prisma.user.deleteMany(),
    prisma.notification.deleteMany(),
  ]);

  console.log('创建组织类型…');
  await prisma.orgType.createMany({
    data: [
      { code: 'UNIT', name: '单位', isUnit: true, builtin: true, sort: 1 },
      { code: 'DEPARTMENT', name: '部门', isUnit: false, builtin: true, sort: 2 },
      { code: 'SECTION', name: '科室', isUnit: false, builtin: true, sort: 3 },
    ],
  });

  console.log('创建组织…');
  const cityBureau = await createOrg('ORG-ROOT', '市局', 'UNIT');
  const officeRoot = await createOrg('D-ROOT-OFFICE', '办公室', 'DEPARTMENT', cityBureau);
  const supervise = await createOrg('D-ROOT-SUP', '监督处', 'DEPARTMENT', cityBureau);
  const general = await createOrg('D-ROOT-GEN', '综合处', 'DEPARTMENT', cityBureau);

  const districtBureau = await createOrg('ORG-SUB', '区局', 'UNIT', cityBureau);
  const officeSub = await createOrg('D-SUB-OFFICE', '办公室', 'DEPARTMENT', districtBureau);
  const bizSub = await createOrg('D-SUB-BIZ', '业务科', 'DEPARTMENT', districtBureau);

  console.log('创建编制位…');
  const pAdmin = await createPosition(officeRoot, 'P-ROOT-OFFICE-1', '办公室主任', { isLeader: true });
  const pChen = await createPosition(officeRoot, 'P-ROOT-OFFICE-2', '办公室副主任', { isDeputy: true });
  const pOfficeStaff = await createPosition(officeRoot, 'P-ROOT-OFFICE-3', '办公室科员', { headcount: 2 });

  const pZhang = await createPosition(supervise, 'P-ROOT-SUP-1', '监督处处长', { isLeader: true });
  const pLi = await createPosition(supervise, 'P-ROOT-SUP-2', '监督处科员', { headcount: 2 });

  const pSun = await createPosition(general, 'P-ROOT-GEN-1', '综合处处长', { isLeader: true });
  const pGenStaff = await createPosition(general, 'P-ROOT-GEN-2', '综合处科员', { headcount: 2 });

  const pQian = await createPosition(officeSub, 'P-SUB-OFFICE-1', '区局办公室主任', { isLeader: true });
  const pWang = await createPosition(bizSub, 'P-SUB-BIZ-1', '业务科科长', { isLeader: true });
  const pZhao = await createPosition(bizSub, 'P-SUB-BIZ-2', '业务科科员', { headcount: 3 });

  console.log('创建人员…');
  const hash = await bcrypt.hash('123456', 10);
  const mkUser = (account: string, name: string, title: string, role = 'USER') =>
    prisma.user.create({ data: { account, name, title, passwordHash: hash, role } });

  const uAdmin = await mkUser('admin', '系统管理员', '办公室主任', 'ADMIN');
  const uZhang = await mkUser('zhang', '张明', '监督处处长');
  const uLi = await mkUser('li', '李强', '监督处科员');
  const uChen = await mkUser('chen', '陈静', '办公室副主任');
  const uSun = await mkUser('sun', '孙伟', '综合处处长');
  const uQian = await mkUser('qian', '钱芳', '区局办公室主任');
  const uWang = await mkUser('wang', '王涛', '业务科科长');
  const uZhao = await mkUser('zhao', '赵磊', '业务科科员');

  const bind = (userId: string, positionId: string, isPrimary = true) =>
    prisma.post.create({ data: { userId, positionId, isPrimary } });

  await bind(uAdmin.id, pAdmin.id);
  await bind(uChen.id, pChen.id);
  await bind(uZhang.id, pZhang.id);
  await bind(uLi.id, pLi.id);
  await bind(uSun.id, pSun.id);
  await bind(uQian.id, pQian.id);
  await bind(uWang.id, pWang.id);
  await bind(uZhao.id, pZhao.id);

  console.log('创建跨单位授权…');
  await prisma.crossUnitGrant.create({
    data: {
      grantorOrgId: districtBureau.id,
      granteeOrgId: cityBureau.id,
      scope: 'FLOW',
      remark: '区局可向上级市局上报审议事项',
      grantedBy: uAdmin.id,
    },
  });

  console.log('创建节点定义…');
  for (const n of NODE_DEFINITIONS) {
    await prisma.nodeDefinition.create({
      data: {
        type: n.type,
        name: n.name,
        description: n.description,
        defaultConfig: n.defaultConfig as any,
        configSchema: n.configSchema as any,
      },
    });
  }

  console.log('创建内容模板…');
  const tpl = await prisma.contentTemplate.create({
    data: {
      code: 'TPL-MATTER',
      name: '通用事项单',
      category: '通用',
      schema: {
        fields: [
          { key: 'title', label: '事项标题', type: 'input', required: true, span: 24 },
          {
            key: 'category',
            label: '事项类型',
            type: 'select',
            required: true,
            span: 12,
            options: [
              { label: '人事事项', value: 'HR' },
              { label: '财务事项', value: 'FIN' },
              { label: '业务事项', value: 'BIZ' },
              { label: '其他', value: 'OTHER' },
            ],
          },
          { key: 'urgency', label: '紧急程度', type: 'select', span: 12, options: [
            { label: '普通', value: 'NORMAL' },
            { label: '紧急', value: 'URGENT' },
          ] },
          { key: 'reason', label: '事由说明', type: 'textarea', required: true, span: 24 },
          { key: 'basis', label: '政策依据', type: 'textarea', span: 24 },
          { key: 'proposal', label: '拟办意见', type: 'textarea', required: true, span: 24 },
          { key: 'attachment', label: '附件材料', type: 'attachment', span: 24 },
        ],
      },
      layout: { titleField: 'title', printTitle: '事项审议单' },
    },
  });

  console.log('创建流程模板…');
  const deliberate = await prisma.flowDefinition.create({
    data: {
      code: 'DELIBERATE-01',
      name: '事项审议',
      type: 'DELIBERATE',
      description: '由部门自由发起，本部门表态、总结后上报上级审批',
      contentTemplateId: tpl.id,
      status: 'PUBLISHED',
      startRule: { mode: 'MANUAL', allowRole: 'ALL' },
      nodes: {
        create: [
          {
            nodeKey: 'vote_1',
            nodeType: 'VOTE',
            name: '部门表态',
            sort: 1,
            nextNodeKey: 'sum_1',
            config: {
              assigneeRule: 'DEPT_ALL',
              allowVeto: true,
              allowAbstain: true,
              allowOpinion: true,
              deadlineHours: 72,
              timeoutAction: 'ABSTAIN',
            },
          },
          {
            nodeKey: 'sum_1',
            nodeType: 'SUMMARIZE',
            name: '表态总结',
            sort: 2,
            nextNodeKey: 'report_1',
            config: { summarizerRule: 'DEPT_LEADER', decisionRule: 'MAJORITY', passThreshold: 0.5 },
          },
          {
            nodeKey: 'report_1',
            nodeType: 'REPORT',
            name: '上报上级',
            sort: 3,
            nextNodeKey: null,
            config: { targetRule: 'PARENT_DEPT', approveDefinitionCode: 'APPROVE-01', carryForm: true },
          },
        ],
      },
    },
  });

  const approve = await prisma.flowDefinition.create({
    data: {
      code: 'APPROVE-01',
      name: '上级审批',
      type: 'APPROVE',
      description: '由下级审议上报自动发起，上级表态总结后通过或退回',
      contentTemplateId: tpl.id,
      status: 'PUBLISHED',
      startRule: { mode: 'AUTO_ON_REPORT' },
      nodes: {
        create: [
          {
            nodeKey: 'vote_1',
            nodeType: 'VOTE',
            name: '上级表态',
            sort: 1,
            nextNodeKey: 'sum_1',
            config: {
              assigneeRule: 'DEPT_ALL',
              allowVeto: true,
              allowAbstain: true,
              allowOpinion: true,
              deadlineHours: 48,
              timeoutAction: 'ABSTAIN',
            },
          },
          {
            nodeKey: 'sum_1',
            nodeType: 'SUMMARIZE',
            name: '审批结论',
            sort: 2,
            nextNodeKey: 'ret_1',
            config: {
              summarizerRule: 'DEPT_LEADER',
              decisionRule: 'MAJORITY',
              passThreshold: 0.5,
              branches: { PASS: null, REJECT: 'ret_1' },
            },
          },
          {
            nodeKey: 'ret_1',
            nodeType: 'RETURN',
            name: '退回下级',
            sort: 3,
            nextNodeKey: null,
            config: { targetRule: 'ORIGIN_REPORT', maxRound: 3 },
          },
        ],
      },
    },
  });

  const execute = await prisma.flowDefinition.create({
    data: {
      code: 'EXECUTE-01',
      name: '事项执行',
      type: 'EXECUTE',
      description: '把已通过的事项派给承办部门执行并确认结果',
      contentTemplateId: tpl.id,
      status: 'PUBLISHED',
      startRule: { mode: 'MANUAL', allowRole: 'ALL' },
      nodes: {
        create: [
          {
            nodeKey: 'assign_1',
            nodeType: 'ASSIGN',
            name: '任务分配',
            sort: 1,
            nextNodeKey: 'exec_1',
            config: { targetType: 'ORG', allowTransfer: true, deadlineHours: 48 },
          },
          {
            nodeKey: 'exec_1',
            nodeType: 'EXECUTE',
            name: '执行确认',
            sort: 2,
            nextNodeKey: null,
            config: {
              assigneeRule: 'DEPT_LEADER',
              requireConfirm: true,
              requireOpinion: true,
              allowAttachment: true,
              deadlineHours: 72,
            },
          },
        ],
      },
    },
  });

  const publicity = await prisma.flowDefinition.create({
    data: {
      code: 'PUBLICITY-01',
      name: '事项公示',
      type: 'PUBLICITY',
      description: '事项结果按范围公示，公示岗确认后归档',
      contentTemplateId: tpl.id,
      status: 'PUBLISHED',
      startRule: { mode: 'MANUAL', allowRole: 'ALL' },
      nodes: {
        create: [
          {
            nodeKey: 'assign_1',
            nodeType: 'ASSIGN',
            name: '指派公示岗',
            sort: 1,
            nextNodeKey: 'exec_1',
            config: { targetType: 'ORG', targetOrgId: officeRoot.id, allowTransfer: false, deadlineHours: 24 },
          },
          {
            nodeKey: 'exec_1',
            nodeType: 'EXECUTE',
            name: '公示确认',
            sort: 2,
            nextNodeKey: null,
            config: {
              assigneeRule: 'DEPT_LEADER',
              requireConfirm: true,
              requireOpinion: false,
              allowAttachment: true,
              deadlineHours: 24,
            },
          },
        ],
      },
    },
  });

  console.log('创建演示业务数据…');
  await prisma.document.create({
    data: {
      title: '关于加强跨部门协同事项管理的意见（征求意见稿）',
      content:
        '# 关于加强跨部门协同事项管理的意见\n\n为提升协同效率，现就跨部门协同事项的发起、表态、上报与执行流程提出如下意见……\n\n## 一、适用范围\n\n## 二、节点职责\n',
      ownerOrgId: officeRoot.id,
      rootUnitId: cityBureau.id,
      creatorId: uAdmin.id,
      collaborators: JSON.stringify([{ userId: uChen.id, role: 'EDITOR' }]),
    },
  });

  await prisma.mail.create({
    data: {
      subject: '关于报送第四季度重点工作安排的通知',
      body: '请各科室于本周五前报送第四季度重点工作安排，逾期视为无安排。',
      senderId: uAdmin.id,
      senderOrgId: officeRoot.id,
      rootUnitId: cityBureau.id,
      recipients: {
        create: [
          { userId: uZhang.id, type: 'TO' },
          { userId: uSun.id, type: 'TO' },
          { userId: uWang.id, type: 'CC' },
        ],
      },
    },
  });

  await prisma.collectForm.create({
    data: {
      title: '2026 年度部门协同需求收集表',
      description: '请各部门填报本年度需要其他部门配合的事项',
      schema: {
        fields: [
          { key: 'dept', label: '填报部门', type: 'input', required: true },
          { key: 'item', label: '协同事项', type: 'textarea', required: true },
          { key: 'target', label: '希望配合的部门', type: 'input' },
          { key: 'deadline', label: '期望完成时间', type: 'date' },
        ],
      },
      scope: JSON.stringify([supervise.id, general.id, bizSub.id]),
      rootUnitId: cityBureau.id,
      creatorId: uAdmin.id,
      status: 'PUBLISHED',
    },
  });

  console.log('\n种子数据完成');
  console.log('  所有账号密码均为 123456');
  console.log('  admin  系统管理员（市局办公室主任，一票否决）');
  console.log('  zhang  张明（市局监督处处长，一票否决）');
  console.log('  li     李强（市局监督处科员）');
  console.log('  chen   陈静（市局办公室副主任）');
  console.log('  sun    孙伟（市局综合处处长）');
  console.log('  qian   钱芳（区局办公室主任）');
  console.log('  wang   王涛（区局业务科科长，一票否决）');
  console.log('  zhao   赵磊（区局业务科科员）');
  console.log(`  流程模板：${[deliberate, approve, execute, publicity].map((f) => f.code).join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
