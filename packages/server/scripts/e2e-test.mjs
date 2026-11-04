/**
 * 端到端链路自测：覆盖 发起 → 表态 → 总结 → 上报 → 上级审批 → 通过/退回 → 一票否决
 * 运行：node scripts/e2e-test.mjs   （需后端已启动）
 */
const BASE = process.env.API_BASE || 'http://localhost:3001/api';

let pass = 0;
let fail = 0;

const ok = (cond, msg, extra) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.log(`  ✗ ${msg}`, extra ?? '');
  }
};

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
    const err = new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const login = async (account) => (await call('POST', '/auth/login', null, { account, password: '123456' })).token;

const todoOf = async (token, instanceId) => {
  const list = await call('GET', '/flow/todo', token);
  return list.filter((t) => t.instanceId === instanceId);
};

const act = async (token, taskId, action, opinion) =>
  call('POST', `/flow/tasks/${taskId}/complete`, token, { action, opinion });

const detail = (token, id) => call('GET', `/flow/instances/${id}`, token);

async function main() {
  console.log('\n[1] 登录与基础数据');
  const admin = await login('admin');
  const wang = await login('wang');
  const zhao = await login('zhao');
  ok(!!admin && !!wang && !!zhao, '三个账号登录成功');

  const tree = await call('GET', '/org/tree', admin);
  ok(tree.length >= 1, '组织树可读取', tree.length);
  const cityBureau = tree.find((n) => n.name === '市局');
  ok(!!cityBureau, '市局节点存在');

  const health = await call('GET', '/health', null);
  ok(health.db === true, '健康检查：数据库连通');
  console.log(`     Redis: ${health.redis ? '已连接' : '未连接（降级直通）'}`);

  console.log('\n[2] 下级发起审议流程（区局业务科）');
  const inst = await call('POST', '/flow/start', wang, {
    definitionCode: 'DELIBERATE-01',
    title: '关于调整业务受理窗口设置的请示',
    formData: {
      category: 'BIZ',
      urgency: 'NORMAL',
      reason: '现有窗口数量不足以应对业务量增长，群众排队时间过长。',
      basis: '《关于优化政务服务的若干规定》第 12 条',
      proposal: '增加 2 个综合受理窗口，调整人员排班。',
    },
  });
  ok(inst.status === 'RUNNING', '流程实例创建成功', inst.status);

  const d1 = await detail(wang, inst.id);
  ok(d1.definition.nodes.length === 3, '审议流程含 3 个节点');
  const voteNode = d1.nodeInstances.find((n) => n.nodeType === 'VOTE');
  ok(voteNode?.tasks.length === 2, 'DEPT_ALL 规则解析出 2 名表态人', voteNode?.tasks.length);

  console.log('\n[3] 表态');
  let wangTodo = await todoOf(wang, inst.id);
  let zhaoTodo = await todoOf(zhao, inst.id);
  ok(wangTodo.length === 1 && zhaoTodo.length === 1, '两人各收到 1 条表态待办');

  await act(wang, wangTodo[0].taskId, 'AGREE', '同意，建议尽快落实');
  let d2 = await detail(wang, inst.id);
  const voteNi = d2.nodeInstances.find((n) => n.nodeType === 'VOTE');
  ok(voteNi.status === 'ACTIVE', '仅一人表态时节点仍处于处理中');

  await act(zhao, zhaoTodo[0].taskId, 'AGREE', '附议');
  d2 = await detail(wang, inst.id);
  const voteNi2 = d2.nodeInstances.find((n) => n.nodeType === 'VOTE');
  ok(voteNi2.status === 'DONE', '全部表态后表态节点完成');
  ok(voteNi2.result?.agree === 2, '统计：同意 2 票', voteNi2.result);

  console.log('\n[4] 总结节点');
  wangTodo = await todoOf(wang, inst.id);
  const sumTodo = wangTodo.find((t) => t.nodeType === 'SUMMARIZE');
  ok(!!sumTodo, '总结人（部门负责人）收到总结待办');
  await act(wang, sumTodo.taskId, 'PASS', '经部门研究，同意上报');
  d2 = await detail(wang, inst.id);
  const sumNi = d2.nodeInstances.find((n) => n.nodeType === 'SUMMARIZE');
  ok(sumNi.status === 'DONE', '总结节点完成');

  console.log('\n[5] 上报节点 → 上级自动创建审批实例');
  d2 = await detail(wang, inst.id);
  const reportNi = d2.nodeInstances.find((n) => n.nodeType === 'REPORT');
  ok(reportNi.status === 'WAITING', '上报节点进入等待状态', reportNi.status);
  ok(d2.children?.length === 1, '自动生成 1 个上级审批实例', d2.children?.length);
  ok(reportNi.result?.targetOrgName === '办公室', '跨单位寻址命中市局办公室', reportNi.result?.targetOrgName);
  ok(reportNi.result?.crossUnit === true, '识别为跨单位上报');

  const childId = d2.children[0].id;
  const dChild = await detail(admin, childId);
  ok(dChild.definition.type === 'APPROVE', '子实例是审批流程');
  ok(dChild.parent?.id === inst.id, '子实例正确回指父流程');

  console.log('\n[6] 上级审批：一票否决');
  let adminTodo = await todoOf(admin, childId);
  const adminVote = adminTodo.find((t) => t.nodeType === 'VOTE');
  ok(!!adminVote, '上级负责人收到表态待办');
  await act(admin, adminVote.taskId, 'DISAGREE', '窗口调整涉及预算，暂不批准');
  const dVeto = await detail(admin, childId);
  ok(dVeto.instance.status === 'VETOED', '负责人否决 → 审批实例被一票否决', dVeto.instance.status);
  const vetoTask = dVeto.nodeInstances.flatMap((n) => n.tasks || []).find((t) => t.isVeto);
  ok(!!vetoTask, '否决记录已留痕');

  console.log('\n[7] 否决回传：下级回到上报节点等待补正');
  const dBack = await detail(wang, inst.id);
  ok(dBack.instance.status === 'RUNNING', '父流程被唤醒继续运行', dBack.instance.status);
  ok(dBack.instance.round === 2, '轮次递增到 2', dBack.instance.round);
  const redoTodo = await todoOf(wang, inst.id);
  ok(redoTodo.some((t) => t.nodeType === 'REPORT'), '发起人收到补正待办');

  console.log('\n[8] 补正后重新上报');
  const redo = redoTodo.find((t) => t.nodeType === 'REPORT');
  await act(wang, redo.taskId, 'RESUBMIT', '已补充预算测算说明，重新上报');
  const d3 = await detail(wang, inst.id);
  ok(d3.children.length === 2, '生成第 2 轮审批实例', d3.children.length);
  const child2 = d3.children.find((c) => c.status === 'RUNNING') || d3.children[0];
  const dC2 = await detail(admin, child2.id);
  ok(dC2.instance.status === 'RUNNING', '第 2 轮审批实例进行中');

  console.log('\n[9] 上级通过');
  adminTodo = await todoOf(admin, child2.id);
  const v2 = adminTodo.find((t) => t.nodeType === 'VOTE');
  await act(admin, v2.taskId, 'AGREE', '同意');

  // 另一名办公室副主任也需表态
  const chen = await login('chen');
  const chenTodo = await todoOf(chen, child2.id);
  if (chenTodo.length) {
    await act(chen, chenTodo.find((t) => t.nodeType === 'VOTE').taskId, 'AGREE', '同意');
  }

  adminTodo = await todoOf(admin, child2.id);
  const s2 = adminTodo.find((t) => t.nodeType === 'SUMMARIZE');
  ok(!!s2, '上级总结待办已生成');
  await act(admin, s2.taskId, 'PASS', '同意，按程序办理');

  const dFinal = await detail(admin, child2.id);
  ok(dFinal.instance.status === 'APPROVED', '审批实例通过', dFinal.instance.status);

  const dParentFinal = await detail(wang, inst.id);
  ok(dParentFinal.instance.status === 'APPROVED', '父流程随上级通过而结束', dParentFinal.instance.status);

  console.log('\n[10] 业务系统');
  const docs = await call('GET', '/biz/docs', admin);
  ok(Array.isArray(docs), '文档列表可读', docs.length);
  const mails = await call('GET', '/biz/mails?box=inbox', wang);
  ok(Array.isArray(mails), '邮件列表可读', mails.length);
  const collects = await call('GET', '/biz/collects', zhao);
  ok(collects.length >= 1, '收集表列表可读', collects.length);
  if (collects.length) {
    await call('POST', `/biz/collects/${collects[0].id}/response`, zhao, {
      data: { dept: '区局业务科', item: '需要办公室协调场地', target: '办公室', deadline: '2026-12-31' },
    });
    const cd = await call('GET', `/biz/collects/${collects[0].id}`, zhao);
    ok(!!cd.mine, '收集表填报成功');
  }

  console.log('\n[11] 权限边界');
  try {
    const other = await detail(zhao, child2.id);
    ok(other.instance.id === child2.id, '可查看与自己相关的上级流程');
  } catch {
    ok(false, '查看流程详情失败');
  }
  try {
    await call('POST', `/flow/tasks/not-exist/complete`, zhao, { action: 'AGREE' });
    ok(false, '不存在的待办应当报错');
  } catch (e) {
    ok(e.status === 404, '非法待办被拒绝', e.status);
  }

  console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('\n测试中断：', e.message);
  process.exit(1);
});
