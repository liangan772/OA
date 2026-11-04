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
  Typography,
} from 'antd';
import { ArrowRightOutlined, PlusOutlined, SaveOutlined, SettingOutlined, DeleteOutlined } from '@ant-design/icons';
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

export default function FlowDesigner() {
  const [defs, setDefs] = useState<any[]>([]);
  const [nodeDefs, setNodeDefs] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [draft, setDraft] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const { message } = AntApp.useApp();

  const load = async () => {
    const [a, b] = await Promise.all([api.get('/flow/definitions'), api.get('/flow/nodes')]);
    setDefs(a.data);
    setNodeDefs(b.data);
    if (!activeId && a.data.length) {
      setActiveId(a.data[0].id);
      setDraft(JSON.parse(JSON.stringify({ ...a.data[0], nodes: a.data[0].nodes })));
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

  const pick = (d: any) => {
    setActiveId(d.id);
    setDraft(JSON.parse(JSON.stringify(d)));
  };

  const openConfig = (node: any) => {
    const meta = nodeMeta.get(node.nodeType);
    const fields = meta?.configSchema?.fields || [];
    const initial: any = {};
    fields.forEach((f: any) => {
      let v = node.config?.[f.key];
      if (v === undefined) v = meta?.defaultConfig?.[f.key];
      if (f.type === 'branches') v = v ? JSON.stringify(v, null, 2) : '';
      initial[f.key] = v;
    });
    form.setFieldsValue(initial);
    setEditing({ node, fields });
  };

  const saveNode = async () => {
    const values = await form.validateFields();
    const config: any = {};
    editing.fields.forEach((f: any) => {
      let v = values[f.key];
      if (f.type === 'branches' && typeof v === 'string' && v.trim()) {
        try {
          v = JSON.parse(v);
        } catch {
          v = {};
        }
      }
      if (v !== undefined && v !== '') config[f.key] = v;
    });
    setDraft({
      ...draft,
      nodes: draft.nodes.map((n: any) =>
        n.nodeKey === editing.node.nodeKey ? { ...n, config } : n,
      ),
    });
    setEditing(null);
    message.success('配置已更新，记得保存模板');
  };

  const addNode = (type: string) => {
    const meta = nodeMeta.get(type);
    const key = `${type.toLowerCase()}_${draft.nodes.length + 1}`;
    const nodes = [
      ...draft.nodes,
      {
        nodeKey: key,
        nodeType: type,
        name: meta?.name || type,
        config: { ...(meta?.defaultConfig || {}) },
        nextNodeKey: null,
        sort: draft.nodes.length + 1,
      },
    ];
    // 前一个节点默认指向新节点
    if (nodes.length > 1) nodes[nodes.length - 2] = { ...nodes[nodes.length - 2], nextNodeKey: key };
    setDraft({ ...draft, nodes });
  };

  const removeNode = (nodeKey: string) => {
    const idx = draft.nodes.findIndex((n: any) => n.nodeKey === nodeKey);
    const nodes = draft.nodes.filter((n: any) => n.nodeKey !== nodeKey);
    if (idx > 0 && nodes[idx - 1]) nodes[idx - 1] = { ...nodes[idx - 1], nextNodeKey: nodes[idx]?.nodeKey ?? null };
    setDraft({ ...draft, nodes });
  };

  const save = async () => {
    try {
      await api.post('/flow/definitions', {
        code: draft.code,
        name: draft.name,
        type: draft.type,
        description: draft.description,
        contentTemplateId: draft.contentTemplateId,
        status: draft.status,
        startRule: draft.startRule,
        nodes: draft.nodes,
      });
      message.success('模板已保存并发布');
      await load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  return (
    <div className="page">
      <h2 className="page-title">流程设计</h2>

      <Row gutter={16}>
        <Col span={6}>
          <Card size="small" title="流程模板" bodyStyle={{ padding: 10 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {defs.map((d) => (
                <div
                  key={d.id}
                  onClick={() => pick(d)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: activeId === d.id ? '#eef4fb' : 'var(--surface-muted)',
                    border: `1px solid ${activeId === d.id ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{d.name}</div>
                  <div className="muted" style={{ marginTop: 2 }}>
                    {d.code} · {d.nodes.length} 个节点 · v{d.version}
                  </div>
                </div>
              ))}
              {!defs.length && <Empty description="暂无模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            </Space>
          </Card>
        </Col>

        <Col span={18}>
          {draft ? (
            <Card
              size="small"
              title={
                <Space>
                  <span>{draft.name}</span>
                  <Tag color="blue">{FLOW_TYPE.find((t) => t.value === draft.type)?.label || draft.type}</Tag>
                </Space>
              }
              extra={
                <Space>
                  <Select
                    size="small"
                    placeholder="添加节点"
                    style={{ width: 140 }}
                    value={null}
                    onChange={(v) => addNode(v)}
                    options={nodeDefs.map((n) => ({
                      label: `${n.name}（${n.type}）`,
                      value: n.type,
                    }))}
                  />
                  <Button size="small" type="primary" icon={<SaveOutlined />} onClick={save}>
                    保存
                  </Button>
                </Space>
              }
            >
              <div style={{ padding: '8px 4px' }}>
                <Space direction="vertical" style={{ width: '100%' }} size={0}>
                  {draft.nodes.map((n: any, i: number) => (
                    <div key={n.nodeKey} className="node-row">
                      <div className="node-dot active" />
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--surface-muted)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '10px 14px',
                        }}
                      >
                        <Space size={10}>
                          <Tag color={NODE_COLOR[n.nodeType]} style={{ marginInlineEnd: 0 }}>
                            {nodeMeta.get(n.nodeType)?.name || n.nodeType}
                          </Tag>
                          <Text strong style={{ fontSize: 13 }}>
                            {n.name}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {n.nodeKey}
                          </Text>
                          <ArrowRightOutlined style={{ color: 'var(--text-3)', fontSize: 11 }} />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {n.nextNodeKey || '流程结束'}
                          </Text>
                        </Space>
                        <Space size={2}>
                          <Button size="small" type="link" icon={<SettingOutlined />} onClick={() => openConfig(n)}>
                            配置
                          </Button>
                          <Button size="small" type="link" danger icon={<DeleteOutlined />} onClick={() => removeNode(n.nodeKey)} />
                        </Space>
                      </div>
                      {i < draft.nodes.length - 1 && (
                        <div style={{ height: 14, marginLeft: -16, borderLeft: '2px solid var(--border)' }} />
                      )}
                    </div>
                  ))}
                </Space>
                <Button
                  type="dashed"
                  block
                  icon={<PlusOutlined />}
                  style={{ marginTop: 14 }}
                  onClick={() => addNode('VOTE')}
                >
                  追加节点
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <Empty description="请选择左侧流程模板" />
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title={`节点配置：${editing?.node?.name || ''}`}
        open={!!editing}
        onOk={saveNode}
        onCancel={() => setEditing(null)}
        okText="应用"
        width={620}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {editing?.fields?.map((f: any) => {
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
            if (f.type === 'branches') {
              return (
                <Form.Item
                  key={f.key}
                  name={f.key}
                  label={f.label}
                  extra='按结论分流，JSON 格式，如 {"PASS": null, "REJECT": "ret_1"}；null 表示流程结束'
                >
                  <Input.TextArea rows={3} />
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
    </div>
  );
}
