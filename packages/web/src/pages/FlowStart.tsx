import { useEffect, useState } from 'react';
import { App as AntApp, Button, Card, Col, Empty, Form, Input, Row, Select, Space, Tag, Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import { renderFieldInput, FieldDef } from '../components/DynamicForm';
import { useAuth } from '../store/auth';

const { Text } = Typography;

const FLOW_TYPE: Record<string, { label: string; color: string }> = {
  DELIBERATE: { label: '审议流程', color: 'blue' },
  APPROVE: { label: '审批流程', color: 'purple' },
  EXECUTE: { label: '执行流程', color: 'green' },
  PUBLICITY: { label: '公示流程', color: 'orange' },
};

const NODE_COLOR: Record<string, string> = {
  VOTE: 'blue',
  SUMMARIZE: 'purple',
  REPORT: 'gold',
  RETURN: 'red',
  ASSIGN: 'cyan',
  EXECUTE: 'green',
};

export default function FlowStart() {
  const [defs, setDefs] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();

  useEffect(() => {
    Promise.all([api.get('/flow/definitions'), api.get('/org/list')]).then(([d, o]) => {
      // 只排除已归档模板；审批、公示等流程同样可以在控制台直接发起
      const list = d.data.filter((x: any) => x.status !== 'ARCHIVED');
      setDefs(list);
      setOrgs(o.data);
      const code = params.get('code');
      if (code) {
        const hit = list.find((x: any) => x.code === code);
        if (hit) setSelected(hit);
      }
    });
  }, []);

  const fields: FieldDef[] = selected?.contentTemplate?.schema?.fields || [];

  const submit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const { title, orgId, ...formData } = values;
      const { data } = await api.post('/flow/start', {
        definitionCode: selected.code,
        title: title || `${selected.name}-${new Date().toLocaleDateString('zh-CN')}`,
        orgId,
        formData,
      });
      message.success('流程已发起');
      navigate(`/flow/instance/${data.id}`);
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <h2 className="page-title">发起流程</h2>

      <Row gutter={16}>
        <Col span={selected ? 9 : 24}>
          <Row gutter={[12, 12]}>
            {defs.map((d) => {
              const t = FLOW_TYPE[d.type] || { label: d.type, color: 'default' };
              const active = selected?.id === d.id;
              return (
                <Col span={selected ? 24 : 8} key={d.id}>
                  <Card
                    hoverable
                    size="small"
                    onClick={() => {
                      setSelected(d);
                      form.resetFields();
                    }}
                    style={{
                      height: '100%',
                      borderColor: active ? 'var(--accent)' : undefined,
                      boxShadow: active ? '0 0 0 3px var(--accent-soft)' : undefined,
                      transition: 'all .25s var(--ease)',
                    }}
                    bodyStyle={{ padding: 18 }}
                  >
                    <Space size={6} style={{ marginBottom: 6 }}>
                      <Text strong>{d.name}</Text>
                      <Tag color={t.color} bordered={false}>
                        {t.label}
                      </Tag>
                    </Space>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: 'var(--text-3)',
                        marginBottom: 14,
                        minHeight: 40,
                        lineHeight: 1.6,
                      }}
                    >
                      {d.description}
                    </div>
                    <Space size={4} wrap style={{ fontSize: 12 }}>
                      {d.nodes.map((n: any, i: number) => (
                        <span key={n.nodeKey}>
                          <Tag color={NODE_COLOR[n.nodeType]} style={{ marginInlineEnd: 0 }}>
                            {n.name}
                          </Tag>
                          {i < d.nodes.length - 1 && <ArrowRightOutlined style={{ color: 'var(--text-3)', fontSize: 10 }} />}
                        </span>
                      ))}
                    </Space>
                  </Card>
                </Col>
              );
            })}
            {!defs.length && (
              <Col span={24}>
                <Empty description="暂无可发起的流程模板" />
              </Col>
            )}
          </Row>
        </Col>

        {selected && (
          <Col span={15}>
            <Card
              title={`填写：${selected.name}`}
              extra={
                <Button size="small" onClick={() => setSelected(null)}>
                  重新选择
                </Button>
              }
            >
              <Form form={form} layout="vertical" requiredMark initialValues={{ orgId: user?.primaryOrgId }}>
                <Form.Item name="title" label="事项标题" rules={[{ required: true, message: '请填写事项标题' }]}>
                  <Input placeholder="一句话概括本次事项" />
                </Form.Item>

                <Form.Item
                  name="orgId"
                  label="发起组织"
                  extra="默认以你所在部门发起；控制台可直接指定任意单位或部门"
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="选择发起组织"
                    options={orgs.map((o: any) => ({
                      label: `${o.name}${o.type === 'UNIT' ? '（单位）' : ''}`,
                      value: o.id,
                    }))}
                  />
                </Form.Item>

                {fields.filter((f) => f.key !== 'title').map((f) => (
                  <Form.Item
                    key={f.key}
                    name={f.key}
                    label={f.label}
                    rules={f.required ? [{ required: true, message: `请填写${f.label}` }] : []}
                  >
                    {renderFieldInput(f)}
                  </Form.Item>
                ))}

                <Button type="primary" onClick={submit} loading={submitting} size="large">
                  提交
                </Button>
              </Form>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}
