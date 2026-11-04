import { useEffect, useState } from 'react';
import { App as AntApp, Button, Card, Col, Empty, Form, Input, Row, Space, Tag, Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import { renderFieldInput, FieldDef } from '../components/DynamicForm';

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
  const [selected, setSelected] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/flow/definitions').then((r) => {
      setDefs(r.data.filter((d: any) => d.status === 'PUBLISHED' && d.startRule?.mode !== 'AUTO_ON_REPORT'));
    });
  }, []);

  const fields: FieldDef[] = selected?.contentTemplate?.schema?.fields || [];

  const submit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const { data } = await api.post('/flow/start', {
        definitionCode: selected.code,
        title: values.title || `${selected.name}-${new Date().toLocaleDateString('zh-CN')}`,
        formData: values,
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
                      borderColor: active ? '#185fa5' : undefined,
                      boxShadow: active ? '0 0 0 2px rgba(24,95,165,0.12)' : undefined,
                    }}
                    bodyStyle={{ padding: 16 }}
                  >
                    <Space size={6} style={{ marginBottom: 6 }}>
                      <Text strong>{d.name}</Text>
                      <Tag color={t.color}>{t.label}</Tag>
                    </Space>
                    <div style={{ fontSize: 12, color: '#8a9099', marginBottom: 10, minHeight: 34 }}>
                      {d.description}
                    </div>
                    <Space size={4} wrap style={{ fontSize: 12 }}>
                      {d.nodes.map((n: any, i: number) => (
                        <span key={n.nodeKey}>
                          <Tag color={NODE_COLOR[n.nodeType]} style={{ marginInlineEnd: 0 }}>
                            {n.name}
                          </Tag>
                          {i < d.nodes.length - 1 && <ArrowRightOutlined style={{ color: '#c9ced6', fontSize: 10 }} />}
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
              <Form form={form} layout="vertical" requiredMark>
                <Form.Item name="title" label="事项标题" rules={[{ required: true, message: '请填写事项标题' }]}>
                  <Input placeholder="一句话概括本次事项" />
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
