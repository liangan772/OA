/**
 * 自由编排 + 控制台发起 验证
 * 覆盖：图完整性校验、乱序编排保存、未发布模板发起、独立发起审批流程触发返回节点
 */
const BASE = process.env.API_BASE || 'http://localhost:3001/api';
let pass = 0;
let fail = 0;
const ok = (c, m, e) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}`, e ?? '')));

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(`${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const login = async (a) => (await call('POST', '/auth/login', null, { account: a, password: '123456' })).token;
const todoOf = async (t, id) => (await call('GET', '/flow/todo', t)).filter((x) => x.instanceId === id);
const act = (t, taskId, action, opinion) =>
  call('POST', `/flow/tasks/${taskId}/complete`, t, { action, opinion });

const CODE = 'TMP-EDGE-TEST';

async function main() {
  const admin = await login('admin');
  const chen = await login('chen');

  const tree = await call('GET', '/org/tree', admin);
  const office = tree[0].children.find((c) => c.name === '办公室');
  ok(!!office, '取得市局办公室');

  console.log('\n[1] 图完整性校验');
  try {
    await call('POST', '/flow/definitions', admin, {
      code: CODE,
      name: '临时校验模板',
      type: 'DELIBERATE',
      status: 'DRAFT',
      nodes: [{ nodeKey: 'a', nodeType: 'VOTE', name: 'A', config: {}, nextNodeKey: 'ghost' }],
    });
    ok(false, '非法后继应被拒绝');
  } catch (e) {
    ok(e.status === 400 && String(e.data?.message).includes('不存在'), '后继指向不存在的节点 → 400', e.status);
  }

  try {
    await call('POST', '/flow/definitions', admin, {
      code: CODE,
      name: '临时校验模板',
      type: 'DELIBERATE',
      status: 'DRAFT',
      nodes: [{ nodeKey: 'a', nodeType: 'VOTE', name: 'A', config: {}, nextNodeKey: 'a' }],
    });
    ok(false, '自环应被拒绝');
  } catch (e) {
    ok(e.status === 400, '节点指向自己 → 400', e.status);
  }

  console.log('\n[2] 任意顺序编排（执行 → 表态 → 分配，非标准流程）');
  const def = await call('POST', '/flow/definitions', admin, {
    code: CODE,
    name: '临时自由编排',
    type: 'PUBLICITY',
    status: 'PUBLISHED',
    nodes: [
      { nodeKey: 'exec_x', nodeType: 'EXECUTE', name: '先执行', config: { assigneeRule: 'DEPT_LEADER', requireConfirm: true, requireOpinion: false }, nextNodeKey: 'vote_x' },
      { nodeKey: 'vote_x', nodeType: 'VOTE', name: '后表态', config: { assigneeRule: 'DEPT_LEADER', allowVeto: false }, nextNodeKey: 'asg_x' },
      { nodeKey: 'asg_x', nodeType: 'ASSIGN', name: '再分配', config: { targetType: 'ORG', targetOrgId: office.id }, nextNodeKey: null },
    ],
  });
  ok(def.nodes.length === 3, '三节点保存成功');
  ok(
    def.nodes.find((n) => n.nodeKey === 'exec_x')?.nextNodeKey === 'vote_x',
    '链路按配置保存（非按类型排序）',
  );

  console.log('\n[3] 控制台直接发起审批流程（未绑定上报）');
  const inst = await call('POST', '/flow/start', admin, {
    definitionCode: 'APPROVE-01',
    title: '控制台直发-审批流程测试',
    orgId: office.id,
    formData: { category: 'OTHER', reason: '验证直发', proposal: '验证直发' },
  });
  ok(inst.status === 'RUNNING', '审批流程可直接发起', inst.status);

  let t1 = await todoOf(admin, inst.id);
  let t2 = await todoOf(chen, inst.id);
  ok(t1.length === 1 && t2.length === 1, '按编制的表态人生成');

  await act(admin, t1[0].taskId, 'AGREE', '同意');
  await act(chen, t2[0].taskId, 'AGREE', '同意');

  console.log('\n[4] 独立发起的审批流程选择「不通过」');
  const sum = (await todoOf(admin, inst.id)).find((t) => t.nodeType === 'SUMMARIZE');
  ok(!!sum, '总结待办已生成');
  await act(admin, sum.taskId, 'REJECT', '不同意');

  const d = await call('GET', `/flow/instances/${inst.id}`, admin);
  ok(d.instance.status === 'RETURNED', '走返回节点后作为流程终点（不再 500）', d.instance.status);
  ok(
    d.nodeInstances.some((n) => n.nodeType === 'RETURN' && n.status === 'DONE'),
    '返回节点正常完成',
  );

  console.log('\n[5] 清理临时模板');
  await call('POST', '/flow/definitions', admin, {
    code: CODE,
    name: '临时自由编排',
    type: 'PUBLICITY',
    status: 'ARCHIVED',
    nodes: def.nodes.map((n) => ({
      nodeKey: n.nodeKey,
      nodeType: n.nodeType,
      name: n.name,
      config: n.config,
      nextNodeKey: n.nextNodeKey,
    })),
  });
  ok(true, '临时模板已归档');

  console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('\n测试中断：', e.status, JSON.stringify(e.data));
  process.exit(1);
});
