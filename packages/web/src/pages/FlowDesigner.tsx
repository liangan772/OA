import { useEffect, useMemo, useState } from 'react';
import {
  App as AntApp,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SaveOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api/client';

const { Text } = Typography;

const NODE_COLOR: Record<string, string> = {
  VOTE: 'blue',
  SUMMARIZE: 'purple',
  REPORT: 'gold',
  RETURN: 'red',
  ASSIGN: 'cyan',
  EXECUTE: 'green',
};

const FLOW_TYPE = [
  { label: '审议流程', value: 'DELIBERATE' },
  { label: '审批流程', value: 'APPROVE' },
  { label: '执行流程', value: 'EXECUTE' },
  { label: '公示流程', value: 'PUBLICITY' },
];

const BRANCH_CODES = [
  { code: 'PASS', label: '通过' },
  { code: 'REJECT', label: '不通过' },
  { code: 'VETOED', label: '一票否决' },
];

const uid = () => Math.random().toString(36).slice(2, 7);

const flattenTree = (nodes: any[], depth = 0): any[] =>
  (nodes || []).flatMap((n) => [{ ...n, depth }, ...flattenTree(n.children, depth + 1)]);

const clone = (d: any) =>
  JSON.parse(
    JSON.stringify({
      ...d,
      nodes: (d.nodes || []).map((n: any) => ({ ...n, config: n.config || {} })),
    }),
  );

export default function FlowDesigner() {
  const [defs, setDefs] = useState<any[]>([]);
  const [nodeDefs, setNodeDefs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [orgTree, setOrgTree] = useState<any[]>([]);
  const [activeId, setActiveId] = useState('');
  const [draft, setDraft] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [metaForm] = Form.useForm();
  const [createForm] = Form.useForm();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();

  const load = async (keepId?: string) => {
    const [a, b, c, u, o] = await Promise.all([
      api.get('/flow/definitions'),
      api.get('/flow/nodes'),
      api.get('/flow/templates'),
      api.get('/biz/users'),
      api.get('/org/tree'),
    ]);
    setDefs(a.data);
    setNodeDefs(b.data);
    setTemplates(c.data);
    setUsers(u.data);
    setOrgTree(flattenTree(o.data));
    const target = keepId ? a.data.find((d: any) => d.id === keepId) : a.data[0];
    if (target) {
      setActiveId(target.id);
      setDraft(clone(target));
      metaForm.setFieldsValue({
        name: target.name,
        type: target.type,
        contentTemplateId: target.contentTemplateId,
        status: target.status,
      });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const nodeMeta = useMemo(() => {
    const m = new Map<string, any>();
    nodeDefs.forEach((n) => m.set(n.type, n));
    return m;
  }, [nodeDefs]);

  const nodeOptions = useMemo(
    () => (draft?.nodes || []).map((n: any) => ({ label: n.name, value: n.nodeKey })),
    [draft],
  );

  const orgOptions = useMemo(
    () =>
      orgTree.map((o: any) => ({
        label: `${'　'.repeat(o.depth)}${o.name}${o.type === 'UNIT' ? '（单位）' : ''}`,
        value: o.id,
      })),
    [orgTree],
  );

  const positionOptions = useMemo(
    () =>
      orgTree.flatMap((o: any) =>
        (o.positions || []).map((p: any) => ({
          label: `${o.name} · ${p.name}${p.isLeader ? '（负责人）' : ''}`,
          value: p.id,
        })),
      ),
    [orgTree],
  );

  const userOptions = useMemo(
    () => users.map((u: any) => ({ label: `${u.name}（${u.account}）`, value: u.id })),
    [users],
  );

  const pick = (d: any) => {
    setActiveId(d.id);
    setDraft(clone(d));
    metaForm.setFieldsValue({
      name: d.name,
      type: d.type,
      contentTemplateId: d.contentTemplateId,
      status: d.status,
    });
  };

  // ---------------- 节点编排 ----------------

  const makeNode = (type: string) => {
    const meta = nodeMeta.get(type);
    return {
      nodeKey: `${type.toLowerCase()}_${uid()}`,
      nodeType: type,
      name: meta?.name || type,
      config: { ...(meta?.defaultConfig || {}) },
      nextNodeKey: null,
    };
  };

  const patchNode = (index: number, patch: any) => {
    const nodes = [...draft.nodes];
    nodes[index] = { ...nodes[index], ...patch };
    setDraft({ ...draft, nodes });
  };

  /** 在 index 处插入节点，并自动把前驱接到新节点 */
  const insertNode = (index: number, type: string) => {
    const node = makeNode(type);
    const nodes = [...draft.nodes];
    const prev = index > 0 ? nodes[index - 1] : null;
    const next = nodes[index] || null;

    node.nextNodeKey = next?.nodeKey ?? null;
    if (prev) prev.nextNodeKey = node.nodeKey;

    nodes.splice(index, 0, node);
    setDraft({ ...draft, nodes });
  };

  const appendNode = (type: string) => insertNode(draft.nodes.length, type);

  const removeNode = (index: number) => {
    const nodes = [...draft.nodes];
    const removed = nodes.splice(index, 1)[0];
    for (const n of nodes) {
      if (n.nextNodeKey === removed.nodeKey) n.nextNodeKey = removed.nextNodeKey ?? null;
      const branches = n.config?.branches;
      if (branches) {
        for (const k of Object.keys(branches)) {
          if (branches[k] === removed.nodeKey) branches[k] = removed.nextNodeKey ?? null;
        }
      }
    }
    setDraft({ ...draft, nodes });
  };

  const moveNode = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= draft.nodes.length) return;
    const nodes = [...draft.nodes];
    [nodes[index], nodes[target]] = [nodes[target], nodes[index]];
    nodes.forEach((n: any, i: number) => {
      n.nextNodeKey = i < nodes.length - 1 ? nodes[i + 1].nodeKey : null;
    });
    setDraft({ ...draft, nodes });
    message.info('已按新顺序重新串联节点');
  };

  const relink = () => {
    const nodes = draft.nodes.map((n: any, i: number) => ({
      ...n,
      nextNodeKey: i < draft.nodes.length - 1 ? draft.nodes[i + 1].nodeKey : null,
    }));
    setDraft({ ...draft, nodes });
    message.success('已重置为线性流程');
  };

  // ---------------- 节点配置 ----------------

  const openConfig = (node: any) => {
    const meta = nodeMeta.get(node.nodeType);
    const fields = meta?.configSchema?.fields || [];
    const initial: any = {};

    fields.forEach((f: any) => {
      if (f.type === 'branches') {
        initial[f.key] = { ...(node.config?.[f.key] || {}) };
        return;
      }
      initial[f.key] =
        node.config?.[f.key] !== undefined ? node.config[f.key] : meta?.defaultConfig?.[f.key];
    });

    form.resetFields();
    form.setFieldsValue(initial);
    setEditing({ node, fields });
  };

  const saveNodeConfig = async () => {
    const values = await form.validateFields();
    const config: any = {};
    editing.fields.forEach((f: any) => {
      const v = values[f.key];
      if (f.type === 'branches') {
        const cleaned: any = {};
        Object.entries(v || {}).forEach(([k, val]) => {
          if (val) cleaned[k] = val;
        });
        if (Object.keys(cleaned).length) config[f.key] = cleaned;
        return;
      }
      if (v !== undefined && v !== '' && v !== null) config[f.key] = v;
    });

    const idx = draft.nodes.findIndex((n: any) => n.nodeKey === editing.node.nodeKey);
    if (idx >= 0) patchNode(idx, { config });
    setEditing(null);
    message.success('节点配置已更新，记得保存模板');
  };

  // ---------------- 保存与发起 ----------------

  const save = async () => {
    if (!draft.nodes.length) {
      message.warning('至少需要一个节点');
      return;
    }
    setSaving(true);
    try {
      const meta = await metaForm.validateFields();
      await api.post('/flow/definitions', {
        code: draft.code,
        ...meta,
        startRule: draft.startRule ?? { mode: 'MANUAL', allowRole: 'ALL' },
        nodes: draft.nodes.map((n: any, i: number) => ({
          nodeKey: n.nodeKey,
          nodeType: n.nodeType,
          name: n.name,
          config: n.config,
          nextNodeKey: n.nextNodeKey ?? null,
          sort: i + 1,
        })),
      });
      message.success('模板已保存');
      await load();
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const createDefinition = async () => {
    const v = await createForm.validateFields();
    try {
      const { data } = await api.post('/flow/definitions', {
        code: v.code,
        name: v.name,
        type: v.type,
        contentTemplateId: v.contentTemplateId,
        status: 'DRAFT',
        startRule: { mode: 'MANUAL', allowRole: 'ALL' },
        nodes: [makeNode(v.firstNodeType || 'VOTE')],
      });
      message.success('已创建，可开始编排');
      setCreateOpen(false);
      createForm.resetFields();
      await load(data.id);
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const launch = () => {
    navigate(`/flow/start?code=${encodeURIComponent(draft.code)}`);
  };

  return (
    <div className="page">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>
            流程设计
          </h2>
          <div className="muted">节点类型与顺序完全自由：任意插入、调序、改后继、配分支</div>
        </div>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建模板
          </Button>
          {draft && (
            <Button icon={<PlayCircleOutlined />} onClick={launch}>
              试跑
            </Button>
          )}
          {draft && (
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
              保存
            </Button>
          )}
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={6}>
          <Card size="small" title="流程模板" bodyStyle={{ padding: 10 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              {defs.map((d) => (
                <div
                  key={d.id}
                  onClick={() => pick(d)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: activeId === d.id ? 'var(--accent-soft)' : 'transparent',
                    border: `1px solid ${activeId === d.id ? 'var(--accent)' : 'transparent'}`,
                    transition: 'all .2s var(--ease)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{d.name}</span>
                    {d.status !== 'PUBLISHED' && (
                      <Tag
                        color={d.status === 'ARCHIVED' ? 'default' : 'orange'}
                        bordered={false}
                        style={{ marginInlineEnd: 0, fontSize: 11 }}
                      >
                        {d.status === 'ARCHIVED' ? '已归档' : '草稿'}
                      </Tag>
                    )}
                  </div>
                  <div className="muted" style={{ marginTop: 3 }}>
                    {d.code} · {d.nodes.length} 节点
                  </div>
                </div>
              ))}
              {!defs.length && <Empty description="暂无模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            </Space>
          </Card>
        </Col>

        <Col span={18}>
          {draft ? (
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Card size="small" title="模板信息">
                <Form form={metaForm} layout="vertical">
                  <Row gutter={14}>
                    <Col span={9}>
                      <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入名称' }]}>
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="type" label="流程类型" rules={[{ required: true }]}>
                        <Select options={FLOW_TYPE} />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                        <Select
                          options={[
                            { label: '已发布', value: 'PUBLISHED' },
                            { label: '草稿', value: 'DRAFT' },
                            { label: '已归档', value: 'ARCHIVED' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item label="编码">
                        <Input value={draft.code} disabled />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item name="contentTemplateId" label="内容模板">
                        <Select
                          allowClear
                          placeholder="不绑定内容模板"
                          options={templates.map((t) => ({
                            label: `${t.name}（${t.code}）`,
                            value: t.id,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </Card>

              <Card
                size="small"
                title="节点编排"
                extra={
                  <Space>
                    <Tooltip title="按当前顺序把每个节点串到下一个节点">
                      <Button size="small" icon={<LinkOutlined />} onClick={relink}>
                        线性串联
                      </Button>
                    </Tooltip>
                    <Select
                      size="small"
                      placeholder="追加节点"
                      style={{ width: 150 }}
                      value={null}
                      onChange={(v) => appendNode(v)}
                      options={nodeDefs.map((n) => ({ label: n.name, value: n.type }))}
                    />
                  </Space>
                }
              >
                <div
                  style={{
                    padding: '10px 0',
                    borderRadius: 10,
                    background: 'var(--accent-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontSize: 13,
                    color: 'var(--accent)',
                  }}
                >
                  <ThunderboltOutlined /> 流程开始
                </div>

                {draft.nodes.length === 0 && (
                  <div style={{ padding: '28px 0' }}>
                    <Empty description="还没有节点，从右上角追加一个" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  </div>
                )}

                {draft.nodes.map((n: any, i: number) => (
                  <div key={n.nodeKey}>
                    <InsertBar index={i} onInsert={insertNode} nodeDefs={nodeDefs} />

                    <div
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        padding: '11px 14px',
                        background: 'var(--surface)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Tag color={NODE_COLOR[n.nodeType]} bordered={false} style={{ marginInlineEnd: 0 }}>
                          {nodeMeta.get(n.nodeType)?.name || n.nodeType}
                        </Tag>
                        <Input
                          size="small"
                          value={n.name}
                          onChange={(e) => patchNode(i, { name: e.target.value })}
                          style={{ width: 190, fontWeight: 500 }}
                          variant="borderless"
                        />
                        <Text type="secondary" style={{ fontSize: 11.5 }}>
                          {n.nodeKey}
                        </Text>
                        <div style={{ flex: 1 }} />
                        <Button
                          size="small"
                          type="text"
                          icon={<ArrowUpOutlined />}
                          disabled={i === 0}
                          onClick={() => moveNode(i, -1)}
                        />
                        <Button
                          size="small"
                          type="text"
                          icon={<ArrowDownOutlined />}
                          disabled={i === draft.nodes.length - 1}
                          onClick={() => moveNode(i, 1)}
                        />
                        <Button size="small" type="text" icon={<SettingOutlined />} onClick={() => openConfig(n)} />
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => removeNode(i)}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, paddingLeft: 2 }}>
                        <ArrowRightOutlined style={{ color: 'var(--text-3)', fontSize: 11 }} />
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>下一步</span>
                        <Select
                          size="small"
                          style={{ width: 210 }}
                          allowClear
                          placeholder="流程结束"
                          value={n.nextNodeKey || undefined}
                          onChange={(v) => patchNode(i, { nextNodeKey: v || null })}
                          options={nodeOptions.filter((o: any) => o.value !== n.nodeKey)}
                        />
                        {n.config?.branches && Object.keys(n.config.branches).length > 0 && (
                          <Tag color="purple" bordered={false}>
                            {Object.keys(n.config.branches).length} 条分支
                          </Tag>
                        )}
                      </div>
                    </div>

                    {i === draft.nodes.length - 1 && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: '9px 0',
                          borderRadius: 10,
                          background: 'var(--surface-muted)',
                          textAlign: 'center',
                          fontSize: 12.5,
                          color: 'var(--text-3)',
                        }}
                      >
                        流程结束
                      </div>
                    )}
                  </div>
                ))}

                {draft.nodes.length > 0 && (
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    style={{ marginTop: 12 }}
                    onClick={() => appendNode('VOTE')}
                  >
                    追加节点
                  </Button>
                )}
              </Card>
            </Space>
          ) : (
            <Card>
              <Empty description="选择左侧模板，或新建一个" />
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title={`节点配置 · ${editing?.node?.name || ''}`}
        open={!!editing}
        onOk={saveNodeConfig}
        onCancel={() => setEditing(null)}
        okText="应用"
        width={660}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {editing?.fields?.map((f: any) => {
            if (f.type === 'branches') {
              return (
                <div key={f.key} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>{f.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                    结论码对应的目标节点，留空表示在该结论下流程结束
                  </div>
                  {BRANCH_CODES.map((b) => (
                    <Form.Item key={b.code} name={[f.key, b.code]} style={{ marginBottom: 8 }}>
                      <Select allowClear placeholder={`${b.label} → 流程结束`} options={nodeOptions} />
                    </Form.Item>
                  ))}
                </div>
              );
            }
            if (f.type === 'userPicker' || f.type === 'orgPicker' || f.type === 'positionPicker') {
              const options =
                f.type === 'userPicker' ? userOptions : f.type === 'orgPicker' ? orgOptions : positionOptions;
              return (
                <Form.Item key={f.key} name={f.key} label={f.label}>
                  <Select
                    mode="multiple"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="不限"
                    options={options}
                  />
                </Form.Item>
              );
            }
            if (f.type === 'select') {
              return (
                <Form.Item key={f.key} name={f.key} label={f.label}>
                  <Select options={f.options || []} allowClear />
                </Form.Item>
              );
            }
            if (f.type === 'boolean') {
              return (
                <Form.Item key={f.key} name={f.key} label={f.label} valuePropName="checked">
                  <Switch />
                </Form.Item>
              );
            }
            if (f.type === 'number') {
              return (
                <Form.Item key={f.key} name={f.key} label={f.label}>
                  <InputNumber style={{ width: '100%' }} />
                </Form.Item>
              );
            }
            return (
              <Form.Item key={f.key} name={f.key} label={f.label}>
                <Input />
              </Form.Item>
            );
          })}
        </Form>
      </Modal>

      <Modal
        title="新建流程模板"
        open={createOpen}
        onOk={createDefinition}
        onCancel={() => setCreateOpen(false)}
        okText="创建"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：专项事项审议" />
          </Form.Item>
          <Form.Item
            name="code"
            label="模板编码"
            rules={[{ required: true, message: '请输入唯一编码' }]}
            extra="同一编码即同一个模板，再次保存会覆盖其节点编排"
          >
            <Input placeholder="如：DELIBERATE-02" />
          </Form.Item>
          <Form.Item name="type" label="流程类型" rules={[{ required: true }]} initialValue="DELIBERATE">
            <Select options={FLOW_TYPE} />
          </Form.Item>
          <Form.Item name="contentTemplateId" label="内容模板">
            <Select
              allowClear
              placeholder="可稍后绑定"
              options={templates.map((t) => ({ label: t.name, value: t.id }))}
            />
          </Form.Item>
          <Form.Item name="firstNodeType" label="首个节点" initialValue="VOTE">
            <Select options={nodeDefs.map((n) => ({ label: `${n.name}（${n.type}）`, value: n.type }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

/** 节点之间的插入条：悬停出现，选择类型后原地下插 */
function InsertBar({
  index,
  onInsert,
  nodeDefs,
}: {
  index: number;
  onInsert: (index: number, type: string) => void;
  nodeDefs: any[];
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hover ? (
        <Select
          size="small"
          autoFocus
          defaultOpen
          placeholder="在此插入节点"
          style={{ width: 200 }}
          onBlur={() => setHover(false)}
          onChange={(v) => {
            onInsert(index, v);
            setHover(false);
          }}
          options={nodeDefs.map((n) => ({ label: n.name, value: n.type }))}
        />
      ) : (
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text-3)',
            opacity: 0.45,
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'repeating-linear-gradient(to right, var(--border-strong) 0 3px, transparent 3px 7px)' }} />
          <PlusOutlined style={{ fontSize: 10 }} />
          <div style={{ flex: 1, height: 1, background: 'repeating-linear-gradient(to right, var(--border-strong) 0 3px, transparent 3px 7px)' }} />
        </div>
      )}
    </div>
  );
}
